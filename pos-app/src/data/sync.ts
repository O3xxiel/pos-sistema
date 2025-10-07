// pos-app/src/data/sync.ts
import { API_URL, fetchWithAuth } from './api';
import { db } from '../offline/db';
import { useAuth } from '../state/auth';
import type { OfflineSaleRow } from '../offline/db';
import type { SaleDraft } from '../types/sales';

export interface SyncResult {
  synced: number;
  reviewRequired: number;
  results: Array<{
    id: string;
    status: 'CONFIRMED' | 'REVIEW_REQUIRED';
    folio?: string;
    error?: string;
    message: string;
  }>;
}

export class SyncService {
  /**
   * Obtiene el token de autenticación actual
   */
  private static async getAuthToken(): Promise<string> {
    const { accessToken, isAuthenticated } = useAuth.getState();
    
    
    if (!accessToken || !isAuthenticated) {
      console.error('❌ SyncService - No hay token válido disponible');
      throw new Error('No authentication token available. Please log in first.');
    }
    
    return accessToken;
  }

  /**
   * Sincroniza todas las ventas offline pendientes con el servidor
   */
  static async syncOfflineSales(): Promise<SyncResult> {
    try {
      // 1. Obtener todas las ventas pendientes de sincronización (PENDING_SYNC y REVIEW_REQUIRED) del vendedor actual
      const { user } = useAuth.getState();
      const currentSellerId = user?.id;
      
      if (!currentSellerId) {
        console.error('❌ No se puede sincronizar: usuario no autenticado');
        throw new Error('Usuario no autenticado. No se puede sincronizar ventas offline.');
      }
      
      const pendingSales = await db.offline_sales
        .where('status')
        .anyOf(['PENDING_SYNC', 'REVIEW_REQUIRED'])
        .filter(sale => sale.sellerId === currentSellerId)
        .toArray();


      if (pendingSales.length === 0) {
        return {
          synced: 0,
          reviewRequired: 0,
          results: []
        };
      }

      console.log(`Sincronizando ${pendingSales.length} ventas offline...`);
      console.log('📦 Ventas pendientes:', pendingSales.map(s => ({ id: s.id, status: s.status, customer: s.customerName, total: s.grandTotal })));

      // 2. Preparar datos para envío
      const salesToSync = pendingSales.map(sale => ({
        id: sale.id,
        customerId: sale.customerId,
        warehouseId: sale.warehouseId,
        sellerId: sale.sellerId,
        subtotal: sale.subtotal,
        taxTotal: sale.taxTotal,
        grandTotal: sale.grandTotal,
        items: sale.items.map(item => ({
          id: item.id,
          productId: item.productId,
          productSku: item.productSku,
          productName: item.productName,
          unitCode: item.unitCode,
          unitFactor: item.unitFactor,
          qty: item.qty,
          qtyBase: item.qtyBase,
          priceUnit: item.priceUnit,
          discount: item.discount,
          lineTotal: item.lineTotal
        })),
        notes: sale.notes,
        createdAt: sale.createdAt
      }));
      
      console.log('📤 Datos preparados para envío:', salesToSync.map(s => ({ id: s.id, customerId: s.customerId, total: s.grandTotal })));

      // 3. Obtener token de autenticación
      const token = await this.getAuthToken();

      // 4. Enviar al servidor
      const requestBody = { sales: salesToSync };
      console.log('📤 Enviando al servidor:', {
        url: `${API_URL}/sales/sync`,
        method: 'POST',
        body: requestBody,
        salesCount: salesToSync.length
      });
      
      const response = await fetch(`${API_URL}/sales/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        let errorMessage = `Sync failed: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (e) {
          // Si no se puede parsear el error, usar el mensaje por defecto
        }
        
        // Si es un error 401, forzar logout
        if (response.status === 401) {
          console.error('🔐 SyncService - Token expirado o inválido, forzando logout');
          useAuth.getState().forceLogout();
          throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
        }
        
        throw new Error(errorMessage);
      }

      const result: SyncResult = await response.json();
      console.log('📥 Respuesta del servidor:', result);

      // 4. Actualizar estado local de las ventas sincronizadas
      console.log('🔄 Procesando resultados de sincronización...');
      for (const saleResult of result.results) {
        console.log(`Processing sync result for sale ${saleResult.id}:`, saleResult);
        
        if (saleResult.status === 'CONFIRMED') {
          // Obtener los datos actualizados del servidor usando el folio
          try {
            console.log(`🔍 Obteniendo datos actualizados para venta ${saleResult.id} con folio ${saleResult.folio}`);
            const updatedSaleData = await this.getSaleByFolio(saleResult.folio!);
            
            if (updatedSaleData) {
              // Actualizar con los datos completos del servidor
              await db.offline_sales.update(saleResult.id, {
                status: 'CONFIRMED',
                folio: saleResult.folio,
                subtotal: Number(updatedSaleData.subtotal),
                taxTotal: Number(updatedSaleData.taxTotal),
                grandTotal: Number(updatedSaleData.grandTotal),
                items: updatedSaleData.items.map((item: any) => ({
                  id: item.id.toString(),
                  productId: item.productId,
                  productSku: item.product?.sku || '',
                  productName: item.product?.name || 'Producto',
                  unitCode: item.unitCode,
                  unitFactor: 1,
                  qty: item.qty,
                  qtyBase: item.qtyBase,
                  priceUnit: Number(item.priceUnit),
                  discount: Number(item.discount || 0),
                  lineTotal: Number(item.lineTotal),
                  productTaxRate: Number(item.product?.taxRate || 0),
                  availableUnits: []
                })),
                syncedAt: new Date().toISOString()
              });
              console.log(`✅ Venta ${saleResult.id} actualizada con datos del servidor`);
            } else {
              // Fallback: solo actualizar folio y estado
              await db.offline_sales.update(saleResult.id, {
                status: 'CONFIRMED',
                folio: saleResult.folio,
                syncedAt: new Date().toISOString()
              });
              console.log(`⚠️ No se pudieron obtener datos actualizados para venta ${saleResult.id}`);
            }
          } catch (error) {
            console.error(`❌ Error obteniendo datos actualizados para venta ${saleResult.id}:`, error);
            // Fallback: solo actualizar folio y estado
            await db.offline_sales.update(saleResult.id, {
              status: 'CONFIRMED',
              folio: saleResult.folio,
              syncedAt: new Date().toISOString()
            });
          }
          
          console.log(`Sale ${saleResult.id} confirmed with folio ${saleResult.folio}`);
        } else if (saleResult.status === 'REVIEW_REQUIRED') {
          console.log(`Sale ${saleResult.id} requires review. Error: ${saleResult.error}, Message: ${saleResult.message}`);
          await db.offline_sales.update(saleResult.id, {
            status: 'REVIEW_REQUIRED',
            lastError: saleResult.error,
            retryCount: ((await db.offline_sales.get(saleResult.id))?.retryCount || 0) + 1
          });
        }
      }

      console.log(`Sincronización completada: ${result.synced} confirmadas, ${result.reviewRequired} requieren revisión`);

      // Limpiar ventas falsamente marcadas como duplicadas
      try {
        console.log('🧹 Limpiando ventas falsamente marcadas como duplicadas...');
        const cleanedCount = await this.cleanFalseDuplicateSales();
        if (cleanedCount > 0) {
          console.log(`✅ Se limpiaron ${cleanedCount} ventas falsamente marcadas como duplicadas`);
        }
      } catch (error) {
        console.error('⚠️ Error limpiando ventas duplicadas:', error);
        // No lanzar el error para no interrumpir la sincronización
      }

      return result;
    } catch (error) {
      console.error('Error durante la sincronización:', error);
      throw error;
    }
  }

  /**
   * Guarda una venta como offline (PENDING_SYNC)
   */
  static async saveOfflineSale(saleDraft: SaleDraft): Promise<string> {
    // Obtener el ID del usuario autenticado actual
    const { user } = useAuth.getState();
    const currentSellerId = user?.id;
    
    if (!currentSellerId) {
      console.error('❌ No se puede guardar venta offline: usuario no autenticado');
      throw new Error('Usuario no autenticado. No se puede guardar venta offline.');
    }
    
    console.log(`💾 Guardando venta offline con sellerId: ${currentSellerId} (usuario: ${user?.username})`);
    
    // Verificar si ya existe una venta con este ID y corregir el sellerId si es necesario
    const existingSale = await db.offline_sales.get(saleDraft.id);
    if (existingSale && existingSale.sellerId !== currentSellerId) {
      console.log(`🔧 Corrigiendo sellerId de venta existente: ${existingSale.sellerId} → ${currentSellerId}`);
      await db.offline_sales.update(saleDraft.id, { sellerId: currentSellerId });
      console.log(`✅ Venta offline corregida: ${saleDraft.id} con sellerId: ${currentSellerId}`);
      return saleDraft.id;
    }
    
    const offlineSale: OfflineSaleRow = {
      id: saleDraft.id,
      status: 'PENDING_SYNC',
      customerId: saleDraft.customerId,
      customerName: saleDraft.customerName,
      customerCode: saleDraft.customerCode,
      warehouseId: saleDraft.warehouseId,
      sellerId: currentSellerId, // Usar el ID del usuario autenticado actual
      subtotal: saleDraft.subtotal,
      taxTotal: saleDraft.taxTotal,
      grandTotal: saleDraft.grandTotal,
      items: saleDraft.items,
      notes: saleDraft.notes,
      createdAt: saleDraft.createdAt,
      retryCount: 0
    };

    await db.offline_sales.add(offlineSale);
    console.log(`✅ Venta offline guardada: ${saleDraft.id} con sellerId: ${currentSellerId}`);
    
    return saleDraft.id;
  }

  /**
   * Obtiene todas las ventas offline por estado (filtradas por vendedor actual)
   */
  static async getOfflineSalesByStatus(status: 'PENDING_SYNC' | 'CONFIRMED' | 'REVIEW_REQUIRED') {
    // Obtener el ID del usuario autenticado actual
    const { user } = useAuth.getState();
    const currentSellerId = user?.id;
    
    if (!currentSellerId) {
      console.warn('⚠️ No hay usuario autenticado, no se pueden obtener ventas offline');
      return [];
    }
    
    console.log(`🔍 Obteniendo ventas offline con estado ${status} para vendedor ${currentSellerId}`);
    
    return await db.offline_sales
      .where('status')
      .equals(status)
      .filter(sale => sale.sellerId === currentSellerId)
      .toArray();
  }

  /**
   * Obtiene el conteo de ventas pendientes de sincronización (filtradas por vendedor actual)
   */
  static async getPendingSyncCount(): Promise<number> {
    // Obtener el ID del usuario autenticado actual
    const { user } = useAuth.getState();
    const currentSellerId = user?.id;
    
    if (!currentSellerId) {
      console.warn('⚠️ No hay usuario autenticado, no se pueden contar ventas offline');
      return 0;
    }
    
    const pendingCount = await db.offline_sales
      .where('status')
      .equals('PENDING_SYNC')
      .filter(sale => sale.sellerId === currentSellerId)
      .count();
    
    const reviewCount = await db.offline_sales
      .where('status')
      .equals('REVIEW_REQUIRED')
      .filter(sale => sale.sellerId === currentSellerId)
      .count();
    
    return pendingCount + reviewCount;
  }

  /**
   * Fuerza la verificación del estado de ventas offline
   */
  static async forceStatusCheck(): Promise<{ updated: number; removed: number }> {
    console.log('🔄 Forzando verificación de estado de ventas offline...');
    return await this.checkOfflineSalesStatus();
  }


  /**
   * Reintenta sincronizar una venta específica (solo si pertenece al vendedor actual)
   */
  static async retrySync(saleId: string): Promise<SyncResult> {
    const { user } = useAuth.getState();
    const currentSellerId = user?.id;
    
    if (!currentSellerId) {
      throw new Error('Usuario no autenticado. No se puede reintentar sincronización.');
    }
    
    const sale = await db.offline_sales.get(saleId);
    if (!sale) {
      throw new Error(`Venta offline ${saleId} no encontrada`);
    }
    
    // Verificar que la venta pertenece al vendedor actual
    if (sale.sellerId !== currentSellerId) {
      throw new Error(`No tienes permisos para reintentar esta venta. La venta pertenece al vendedor ${sale.sellerId}`);
    }

    // Cambiar estado a PENDING_SYNC para reintentar
    await db.offline_sales.update(saleId, {
      status: 'PENDING_SYNC',
      lastError: undefined
    });

    return await this.syncOfflineSales();
  }

  /**
   * Limpia ventas offline con sellerId incorrecto (ID 1 que no existe)
   */
  static async cleanBadOfflineSales(): Promise<number> {
    console.log('🧹 Limpiando ventas offline con sellerId incorrecto...');
    
    // Obtener todas las ventas offline
    const allSales = await db.offline_sales.toArray();
    console.log(`📊 Total de ventas offline: ${allSales.length}`);
    
    // Filtrar las que tienen sellerId = 1 (incorrecto)
    const badSales = allSales.filter(sale => sale.sellerId === 1);
    console.log(`❌ Ventas con sellerId incorrecto (ID 1): ${badSales.length}`);
    
    if (badSales.length > 0) {
      console.log('🗑️ Eliminando ventas incorrectas...');
      
      // Eliminar una por una usando el ID (que sí está indexado)
      for (const sale of badSales) {
        await db.offline_sales.delete(sale.id);
        console.log(`🗑️ Eliminada venta: ${sale.id}`);
      }
      
      console.log(`✅ Se eliminaron ${badSales.length} ventas offline incorrectas`);
    } else {
      console.log('✅ No hay ventas offline con sellerId incorrecto');
    }
    
    return badSales.length;
  }

  /**
   * Diagnostica ventas offline problemáticas
   */
  static async diagnoseOfflineSales(): Promise<void> {
    console.log('🔍 Diagnóstico de ventas offline...');
    
    const allSales = await db.offline_sales.toArray();
    console.log(`📊 Total de ventas offline: ${allSales.length}`);
    
    // Agrupar por estado
    const byStatus = allSales.reduce((acc, sale) => {
      acc[sale.status] = (acc[sale.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('📈 Ventas por estado:', byStatus);
    
    // Buscar ventas con sellerId problemático
    const badSellerIds = allSales.filter(sale => sale.sellerId === 1);
    if (badSellerIds.length > 0) {
      console.log(`❌ Ventas con sellerId incorrecto (ID 1): ${badSellerIds.length}`);
      badSellerIds.forEach(sale => {
        console.log(`  - ${sale.id}: ${sale.customerName} - Q${sale.grandTotal} - ${sale.status}`);
      });
    }
    
    // Buscar ventas con UUIDs duplicados
    const uuids = allSales.map(sale => sale.id);
    const duplicateUuids = uuids.filter((uuid, index) => uuids.indexOf(uuid) !== index);
    if (duplicateUuids.length > 0) {
      console.log(`⚠️ UUIDs duplicados encontrados: ${duplicateUuids.length}`);
      duplicateUuids.forEach(uuid => {
        const sales = allSales.filter(sale => sale.id === uuid);
        console.log(`  - UUID ${uuid}: ${sales.length} ventas`);
        sales.forEach(sale => {
          console.log(`    * ${sale.status} - Q${sale.grandTotal} - ${sale.createdAt}`);
        });
      });
    }
    
    // Buscar ventas muy antiguas
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const oldSales = allSales.filter(sale => new Date(sale.createdAt) < oneWeekAgo);
    if (oldSales.length > 0) {
      console.log(`⏰ Ventas antiguas (>1 semana): ${oldSales.length}`);
      oldSales.forEach(sale => {
        console.log(`  - ${sale.id}: ${sale.status} - ${sale.createdAt}`);
      });
    }
    
    // Buscar ventas con muchos reintentos
    const retrySales = allSales.filter(sale => (sale.retryCount || 0) > 3);
    if (retrySales.length > 0) {
      console.log(`🔄 Ventas con muchos reintentos (>3): ${retrySales.length}`);
      retrySales.forEach(sale => {
        console.log(`  - ${sale.id}: ${sale.retryCount} reintentos - ${sale.lastError || 'Sin error'}`);
      });
    }
    
    console.log('✅ Diagnóstico completado');
  }

  /**
   * Diagnostica productos en la base de datos local
   */
  static async diagnoseProducts(): Promise<void> {
    console.log('🔍 Diagnóstico de productos...');
    
    const allProducts = await db.catalog_products.toArray();
    console.log(`📊 Total de productos: ${allProducts.length}`);
    
    // Verificar productos sin unidades
    const productsWithoutUnits = allProducts.filter(p => !p.units || p.units.length === 0);
    if (productsWithoutUnits.length > 0) {
      console.log(`❌ Productos sin unidades: ${productsWithoutUnits.length}`);
      productsWithoutUnits.forEach(product => {
        console.log(`  - ${product.name} (${product.sku}): unidades =`, product.units);
      });
    }
    
    // Verificar productos con unidades
    const productsWithUnits = allProducts.filter(p => p.units && p.units.length > 0);
    console.log(`✅ Productos con unidades: ${productsWithUnits.length}`);
    
    // Mostrar algunos ejemplos
    productsWithUnits.slice(0, 3).forEach(product => {
      console.log(`  - ${product.name} (${product.sku}):`, product.units);
    });
    
    // Verificar productos activos
    const activeProducts = allProducts.filter(p => p.isActive);
    console.log(`🟢 Productos activos: ${activeProducts.length}`);
    
    console.log('✅ Diagnóstico de productos completado');
  }

  /**
   * Fuerza la sincronización de productos desde el backend
   */
  static async forceSyncProducts(): Promise<void> {
    console.log('🔄 Forzando sincronización de productos...');
    
    try {
      const { syncProducts } = await import('./catalog');
      const result = await syncProducts();
      console.log(`✅ Sincronización de productos completada: ${result.saved} productos actualizados`);
      
      // Diagnosticar después de la sincronización
      await this.diagnoseProducts();
    } catch (error) {
      console.error('❌ Error sincronizando productos:', error);
      throw error;
    }
  }

  /**
   * Limpia ventas marcadas como duplicadas pero que en realidad se procesaron correctamente
   */
  static async cleanFalseDuplicateSales(): Promise<number> {
    console.log('🔍 Verificando ventas marcadas como duplicadas...');
    
    const { user } = useAuth.getState();
    const currentSellerId = user?.id;
    
    if (!currentSellerId) {
      console.log('❌ No hay usuario autenticado');
      return 0;
    }
    
    // Obtener ventas marcadas como duplicadas del vendedor actual
    const duplicateSales = await db.offline_sales
      .where('status')
      .equals('REVIEW_REQUIRED')
      .filter(sale => 
        sale.sellerId === currentSellerId && 
        sale.lastError?.includes('Venta duplicada')
      )
      .toArray();
    
    console.log(`📊 Ventas marcadas como duplicadas: ${duplicateSales.length}`);
    
    let cleanedCount = 0;
    
    for (const sale of duplicateSales) {
      try {
        // Verificar si la venta realmente existe en el servidor
        if (sale.folio) {
          const serverSale = await this.getSaleByFolio(sale.folio);
          if (serverSale) {
            // La venta existe en el servidor, actualizar estado a CONFIRMED
            console.log(`✅ Venta ${sale.id} realmente se procesó correctamente, actualizando estado...`);
            await db.offline_sales.update(sale.id, {
              status: 'CONFIRMED',
              lastError: undefined,
              syncedAt: new Date().toISOString()
            });
            cleanedCount++;
          }
        } else {
          // Si no tiene folio, verificar por UUID
          console.log(`🔍 Verificando venta ${sale.id} por UUID...`);
          const serverSale = await this.getSaleByUuid(sale.id);
          if (serverSale) {
            // La venta existe en el servidor, actualizar estado a CONFIRMED
            console.log(`✅ Venta ${sale.id} existe en el servidor, actualizando estado...`);
            await db.offline_sales.update(sale.id, {
              status: 'CONFIRMED',
              folio: serverSale.folio,
              lastError: undefined,
              syncedAt: new Date().toISOString()
            });
            cleanedCount++;
          }
        }
      } catch (error) {
        console.log(`⚠️ No se pudo verificar venta ${sale.id}:`, error);
      }
    }
    
    // También verificar ventas que están en CONFIRMED pero tienen lastError de duplicada
    const confirmedWithError = await db.offline_sales
      .where('status')
      .equals('CONFIRMED')
      .filter(sale => 
        sale.sellerId === currentSellerId && 
        sale.lastError?.includes('Venta duplicada')
      )
      .toArray();
    
    console.log(`📊 Ventas confirmadas con error de duplicada: ${confirmedWithError.length}`);
    
    for (const sale of confirmedWithError) {
      try {
        console.log(`🧹 Limpiando error de duplicada en venta confirmada ${sale.id}...`);
        await db.offline_sales.update(sale.id, {
          lastError: undefined,
          syncedAt: new Date().toISOString()
        });
        cleanedCount++;
      } catch (error) {
        console.log(`⚠️ No se pudo limpiar error en venta ${sale.id}:`, error);
      }
    }
    
    console.log(`✅ Se limpiaron ${cleanedCount} ventas falsamente marcadas como duplicadas`);
    return cleanedCount;
  }

  /**
   * Limpia ventas offline duplicadas o problemáticas
   */
  static async cleanDuplicateOfflineSales(): Promise<number> {
    console.log('🧹 Limpiando ventas offline duplicadas...');
    
    const allSales = await db.offline_sales.toArray();
    console.log(`📊 Total de ventas offline: ${allSales.length}`);
    
    let cleanedCount = 0;
    
    // 1. Limpiar ventas con sellerId incorrecto (ID 1)
    const badSellerSales = allSales.filter(sale => sale.sellerId === 1);
    if (badSellerSales.length > 0) {
      console.log(`🗑️ Eliminando ${badSellerSales.length} ventas con sellerId incorrecto...`);
      for (const sale of badSellerSales) {
        await db.offline_sales.delete(sale.id);
        cleanedCount++;
        console.log(`🗑️ Eliminada venta con sellerId incorrecto: ${sale.id}`);
      }
    }
    
    // 2. Limpiar ventas duplicadas por UUID
    const uuids = allSales.map(sale => sale.id);
    const duplicateUuids = [...new Set(uuids.filter((uuid, index) => uuids.indexOf(uuid) !== index))];
    
    if (duplicateUuids.length > 0) {
      console.log(`🗑️ Eliminando ${duplicateUuids.length} UUIDs duplicados...`);
      for (const uuid of duplicateUuids) {
        const sales = allSales.filter(sale => sale.id === uuid);
        // Mantener solo la más reciente, eliminar las demás
        const sortedSales = sales.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const toDelete = sortedSales.slice(1);
        
        console.log(`🔄 UUID ${uuid}: manteniendo venta más reciente, eliminando ${toDelete.length} duplicadas`);
        for (const sale of toDelete) {
          await db.offline_sales.delete(sale.id);
          cleanedCount++;
          console.log(`🗑️ Eliminada venta duplicada: ${sale.id}`);
        }
      }
    }
    
    // 3. Limpiar ventas muy antiguas que no se han sincronizado
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const oldPendingSales = allSales.filter(sale => 
      sale.status === 'PENDING_SYNC' && 
      new Date(sale.createdAt) < oneWeekAgo
    );
    
    if (oldPendingSales.length > 0) {
      console.log(`🗑️ Eliminando ${oldPendingSales.length} ventas antiguas pendientes...`);
      for (const sale of oldPendingSales) {
        await db.offline_sales.delete(sale.id);
        cleanedCount++;
        console.log(`🗑️ Eliminada venta antigua: ${sale.id}`);
      }
    }
    
    // 4. Limpiar ventas con muchos reintentos fallidos
    const failedRetrySales = allSales.filter(sale => (sale.retryCount || 0) > 5);
    if (failedRetrySales.length > 0) {
      console.log(`🗑️ Eliminando ${failedRetrySales.length} ventas con muchos reintentos fallidos...`);
      for (const sale of failedRetrySales) {
        await db.offline_sales.delete(sale.id);
        cleanedCount++;
        console.log(`🗑️ Eliminada venta con muchos reintentos: ${sale.id}`);
      }
    }
    
    console.log(`✅ Limpieza completada: ${cleanedCount} ventas eliminadas`);
    return cleanedCount;
  }

  /**
   * Verifica el estado actualizado de las ventas offline en el servidor
   * y actualiza la base de datos local en consecuencia
   */
  static async checkOfflineSalesStatus(sellerId?: number): Promise<{ updated: number; removed: number }> {
    try {
      const { user } = useAuth.getState();
      const currentSellerId = sellerId || user?.id;

      if (!currentSellerId) {
        console.warn('⚠️ No hay usuario autenticado, no se puede verificar estado de ventas');
        return { updated: 0, removed: 0 };
      }

      console.log(`🔍 Verificando estado de ventas offline para vendedor ${currentSellerId}`);

      const token = await this.getAuthToken();
      const url = sellerId 
        ? `${API_URL}/sales/offline/status?sellerId=${sellerId}`
        : `${API_URL}/sales/offline/status`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Error verificando estado: ${response.status}`);
      }

      const serverStatus = await response.json();
      console.log('📊 Estado del servidor:', serverStatus);

      // Obtener ventas locales que están en REVIEW_REQUIRED o CONFIRMED
      const localReviewSales = await db.offline_sales
        .where('status')
        .anyOf(['REVIEW_REQUIRED', 'CONFIRMED'])
        .filter(sale => sale.sellerId === currentSellerId)
        .toArray();

      console.log(`📊 Ventas locales en REVIEW_REQUIRED o CONFIRMED: ${localReviewSales.length}`);

      let updatedCount = 0;
      let removedCount = 0;

      // Verificar cada venta local
      for (const localSale of localReviewSales) {
        // Buscar la venta en el servidor por UUID
        const serverSale = serverStatus.sales.find((s: any) => s.uuid === localSale.id);

        if (!serverSale) {
          // La venta ya no está en el servidor (fue eliminada o cancelada)
          console.log(`✅ Venta ${localSale.id} ya no está en el servidor, eliminando de local`);
          await db.offline_sales.delete(localSale.id);
          removedCount++;
        } else if (serverSale.status !== localSale.status) {
          // La venta cambió de estado en el servidor
          console.log(`🔄 Venta ${localSale.id} cambió de estado de ${localSale.status} a ${serverSale.status}, actualizando local`);
          
          // Si la venta se confirmó, actualizar con todos los datos del servidor
          if (serverSale.status === 'CONFIRMED') {
            await db.offline_sales.update(localSale.id, {
              status: serverSale.status,
              folio: serverSale.folio,
              subtotal: Number(serverSale.subtotal),
              taxTotal: Number(serverSale.taxTotal),
              grandTotal: Number(serverSale.grandTotal),
              items: serverSale.items.map((item: any) => ({
                id: item.id.toString(),
                productId: item.productId,
                productSku: item.product?.sku || '',
                productName: item.product?.name || 'Producto',
                unitCode: item.unitCode,
                unitFactor: 1,
                qty: item.qty,
                qtyBase: item.qtyBase,
                priceUnit: Number(item.priceUnit),
                discount: Number(item.discount || 0),
                lineTotal: Number(item.lineTotal),
                productTaxRate: Number(item.product?.taxRate || 0),
                availableUnits: []
              })),
              syncedAt: new Date().toISOString(),
              lastError: undefined
            });
          } else {
            // Para otros estados, solo actualizar estado y folio
            await db.offline_sales.update(localSale.id, {
              status: serverSale.status,
              folio: serverSale.folio,
            });
          }
        } else {
          // La venta mantiene el mismo estado, pero puede haber cambios en los datos
          // Verificar si hay diferencias en los totales o items
          const localTotal = localSale.grandTotal;
          const serverTotal = Number(serverSale.grandTotal);
          
          if (Math.abs(localTotal - serverTotal) > 0.01) {
            console.log(`🔄 Venta ${localSale.id} tiene totales diferentes (local: ${localTotal}, servidor: ${serverTotal}), actualizando local`);
            
            // Actualizar los datos locales con los datos del servidor
            await db.offline_sales.update(localSale.id, {
              subtotal: Number(serverSale.subtotal),
              taxTotal: Number(serverSale.taxTotal),
              grandTotal: Number(serverSale.grandTotal),
              items: serverSale.items.map((item: any) => ({
                id: item.id.toString(),
                productId: item.productId,
                productSku: item.product?.sku || '',
                productName: item.product?.name || 'Producto',
                unitCode: item.unitCode,
                unitFactor: 1,
                qty: item.qty,
                qtyBase: item.qtyBase,
                priceUnit: Number(item.priceUnit),
                discount: Number(item.discount || 0),
                lineTotal: Number(item.lineTotal),
                productTaxRate: Number(item.product?.taxRate || 0),
                availableUnits: []
              })),
            });
            updatedCount++;
          }
        }
      }

      console.log(`✅ Verificación completada: ${updatedCount} actualizadas, ${removedCount} eliminadas`);
      
      // No mostrar notificación automática aquí para evitar duplicados
      // Las notificaciones se manejan en el hook useNetwork
      
      return { updated: updatedCount, removed: removedCount };

    } catch (error) {
      console.error('❌ Error verificando estado de ventas offline:', error);
      return { updated: 0, removed: 0 };
    }
  }

  /**
   * Limpia todas las ventas offline pendientes del vendedor actual
   */
  static async clearPendingOfflineSales(): Promise<number> {
    try {
      const { user } = useAuth.getState();
      const currentSellerId = user?.id;

      if (!currentSellerId) {
        console.warn('⚠️ No hay usuario autenticado, no se pueden limpiar ventas offline');
        return 0;
      }

      console.log(`🧹 Limpiando ventas offline pendientes para vendedor ${currentSellerId}`);

      // Obtener todas las ventas pendientes del vendedor actual
      const pendingSales = await db.offline_sales
        .where('status')
        .anyOf(['PENDING_SYNC', 'REVIEW_REQUIRED'])
        .filter(sale => sale.sellerId === currentSellerId)
        .toArray();

      console.log(`📊 Encontradas ${pendingSales.length} ventas pendientes para limpiar`);

      // Eliminar cada venta
      let deletedCount = 0;
      for (const sale of pendingSales) {
        await db.offline_sales.delete(sale.id);
        deletedCount++;
        console.log(`🗑️ Eliminada venta ${sale.id} (${sale.status})`);
      }

      console.log(`✅ Limpieza completada: ${deletedCount} ventas eliminadas`);
      return deletedCount;

    } catch (error) {
      console.error('❌ Error limpiando ventas offline pendientes:', error);
      return 0;
    }
  }

  /**
   * Obtiene los datos completos de una venta desde el servidor usando el UUID
   */
  static async getSaleByUuid(uuid: string): Promise<any> {
    try {
      const { user } = useAuth.getState();
      const currentSellerId = user?.id;

      if (!currentSellerId) {
        throw new Error('Usuario no autenticado');
      }

      const token = await this.getAuthToken();
      const response = await fetch(`${API_URL}/sales/by-uuid/${uuid}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null; // Venta no encontrada
        }
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error obteniendo venta por UUID:', error);
      return null;
    }
  }

  /**
   * Obtiene los datos completos de una venta desde el servidor usando el folio
   */
  static async getSaleByFolio(folio: string): Promise<any> {
    try {
      const { user } = useAuth.getState();
      const currentSellerId = user?.id;

      if (!currentSellerId) {
        throw new Error('Usuario no autenticado');
      }

      console.log(`🔍 Obteniendo venta con folio ${folio} para vendedor ${currentSellerId}`);
      
      const response = await fetchWithAuth(`/sales?folio=${folio}&limit=1`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.sales && data.sales.length > 0) {
        const sale = data.sales[0];
        console.log(`✅ Venta encontrada: ${sale.id} (${sale.folio})`);
        return sale;
      } else {
        console.log(`⚠️ No se encontró venta con folio ${folio}`);
        return null;
      }
    } catch (error) {
      console.error(`❌ Error obteniendo venta con folio ${folio}:`, error);
      throw error;
    }
  }
}


