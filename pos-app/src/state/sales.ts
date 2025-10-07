// pos-app/src/state/sales.ts
import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../offline/db';
import { confirmSale as confirmSaleAPI } from '../data/catalog';
import { getSalesDrafts, saveSaleDraft, fetchWithAuth, API_URL } from '../data/api';
import type { SaleDraft, SaleItem, ProductForSale, CustomerForSale, UnitCode } from '../types/sales';

type SalesState = {
  // Estado actual de la venta en edición
  currentSale: SaleDraft | null;
  
  // Lista de borradores guardados
  drafts: SaleDraft[];
  
  // Estado de carga
  loading: boolean;
  
  // Acciones
  createNewSale: () => void;
  loadSale: (saleId: string) => Promise<void>;
  saveSale: () => Promise<void>;
  deleteSale: (saleId: string) => Promise<void>;
  loadDrafts: () => Promise<void>;
  
  // Gestión de cliente
  setCustomer: (customer: CustomerForSale) => void;
  
  // Gestión de items
  addProduct: (product: ProductForSale, unitCode: UnitCode, qty: number) => void;
  updateItem: (itemId: string, updates: Partial<SaleItem>) => void;
  removeItem: (itemId: string) => void;
  updateSale: (updates: Partial<SaleDraft>) => void;
  
  // Cálculos
  calculateTotals: () => void;
  
  // Confirmación de venta
  confirmSale: (saleId: string) => Promise<void>;
  
  // Utilidades
  clearCurrentSale: () => void;
  
  // Recarga segura de borradores
  refreshDrafts: () => Promise<void>;
};

const createEmptySale = (): SaleDraft => {
  return {
    id: uuidv4(),
    customerId: 0,
    customerName: '',
    customerCode: '',
    warehouseId: 1, // Por defecto warehouse 1
    sellerId: 1, // Fallback temporal, se actualizará con el usuario actual
    items: [],
    subtotal: 0,
    taxTotal: 0,
    grandTotal: 0,
    notes: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

const calculateItemTotal = (item: Partial<SaleItem>): number => {
  const { qty = 0, priceUnit = 0, discount = 0 } = item;
  return (qty * priceUnit) - discount;
};

const calculateSaleTotals = (items: SaleItem[]) => {
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  
  // Calcular impuestos por producto según su taxRate
  let taxTotal = 0;
  items.forEach(item => {
    // Si el producto tiene taxRate > 0, aplicar impuesto
    if (item.productTaxRate && item.productTaxRate > 0) {
      taxTotal += item.lineTotal * (item.productTaxRate / 100);
    }
  });
  
  const grandTotal = subtotal + taxTotal;
  
  return { subtotal, taxTotal, grandTotal };
};

export const useSales = create<SalesState>((set, get) => ({
  currentSale: null,
  drafts: [],
  loading: false,

  createNewSale: () => {
    const { currentSale } = get();
    // Solo crear una nueva venta si no hay una venta actual
    if (!currentSale) {
      const newSale = createEmptySale();
      
      // Actualizar el sellerId con el usuario autenticado
      import('../state/auth').then(({ useAuth }) => {
        const { user } = useAuth.getState();
        if (user?.id) {
          set({ 
            currentSale: { 
              ...newSale, 
              sellerId: user.id 
            } 
          });
          console.log('🆕 Creando nueva venta con sellerId:', user.id);
        } else {
          set({ currentSale: newSale });
          console.log('🆕 Creando nueva venta con sellerId por defecto:', newSale.sellerId);
        }
      });
    } else {
      console.log('⚠️ No se creó nueva venta, ya existe una venta actual:', currentSale.id);
    }
  },

  loadSale: async (saleId: string) => {
    set({ loading: true });
    try {
      // Primero intentar cargar desde el API
      try {
        const response = await fetchWithAuth(`${API_URL}/sales/${saleId}`);
        const sale = response;
        
        // Convertir la respuesta del API al formato esperado por el frontend
        const frontendSale = {
          id: sale.uuid || sale.id.toString(),
          customerId: sale.customerId || 0,
          customerName: sale.customer?.name || '',
          customerCode: sale.customer?.nit || '',
          warehouseId: sale.warehouseId || 1,
          items: sale.items.map(item => ({
            id: item.id.toString(),
            productId: item.productId,
            productName: item.product.name,
            productSku: item.product.sku,
            unitCode: item.unitCode,
            qty: item.qty,
            qtyBase: item.qtyBase,
            priceUnit: item.priceUnit,
            discount: item.discount,
            lineTotal: item.lineTotal,
          })),
          subtotal: sale.subtotal || 0,
          taxTotal: sale.taxTotal || 0,
          grandTotal: sale.grandTotal || 0,
          createdAt: sale.createdAt,
          updatedAt: sale.updatedAt || sale.createdAt,
        };
        
        set({ currentSale: frontendSale });
        console.log('✅ Borrador cargado desde API:', frontendSale);
      } catch (apiError) {
        console.warn('Error cargando desde API, intentando local:', apiError);
        // Fallback a base de datos local
        const sale = await db.sales_drafts.get(saleId);
        if (sale) {
          set({ currentSale: sale });
        }
      }
    } catch (error) {
      console.error('Error loading sale:', error);
    } finally {
      set({ loading: false });
    }
  },

  saveSale: async () => {
    const { currentSale } = get();
    if (!currentSale) return;

    set({ loading: true });
    try {
      const updatedSale = {
        ...currentSale,
        updatedAt: new Date().toISOString(),
      };
      
      // Validar que el cliente existe (usar cliente por defecto si no es válido)
      const validCustomerId = updatedSale.customerId && updatedSale.customerId > 0 ? updatedSale.customerId : 5;
      
        // Guardar en el API (convertir strings a números)
        const draftPayload = {
          customerId: Number(validCustomerId),
          warehouseId: Number(updatedSale.warehouseId || 1),
          subtotal: Number(updatedSale.subtotal),
          taxTotal: Number(updatedSale.taxTotal || 0),
          total: Number(updatedSale.grandTotal), // Usar grandTotal en lugar de total
          items: updatedSale.items.map(item => ({
            productId: Number(item.productId),
            quantity: Number(item.qty), // Mapear qty a quantity para el backend
            unitPrice: Number(item.priceUnit), // Mapear priceUnit a unitPrice para el backend
            total: Number(item.lineTotal), // Mapear lineTotal a total para el backend
          })),
        };
      
      console.log('📤 Enviando borrador al API:', draftPayload);
      console.log('📤 CustomerId original:', updatedSale.customerId, 'CustomerId validado:', validCustomerId);
      
      const savedDraft = await saveSaleDraft(draftPayload);
      
      // Actualizar el currentSale con el ID del servidor
      const updatedCurrentSale = {
        ...updatedSale,
        id: savedDraft.uuid || savedDraft.id.toString(),
        serverId: savedDraft.id, // Guardar el ID numérico del servidor para eliminación
      };
      
      set({ currentSale: updatedCurrentSale });
      
      // Recargar la lista de borradores
      await get().loadDrafts();
    } catch (error) {
      console.error('Error saving sale:', error);
      // Fallback a base de datos local si falla el API
      try {
        const updatedSale = {
          ...currentSale,
          updatedAt: new Date().toISOString(),
        };
        await db.sales_drafts.put(updatedSale);
        set({ currentSale: updatedSale });
      } catch (localError) {
        console.error('Error saving to local storage:', localError);
      }
    } finally {
      set({ loading: false });
    }
  },

  deleteSale: async (saleId: string) => {
    set({ loading: true });
    try {
      const { drafts } = get();
      const draft = drafts.find(d => d.id === saleId);
      
      if (!draft) {
        throw new Error('Borrador no encontrado');
      }
      
      console.log('🗑️ Eliminando borrador:', { id: saleId, serverId: draft.serverId });
      
      if (draft.serverId) {
        // Si es un borrador del servidor, eliminarlo del API
        console.log('🌐 Eliminando borrador del servidor con ID:', draft.serverId);
        await fetchWithAuth(`${API_URL}/sales/${draft.serverId}`, {
          method: 'DELETE'
        });
        console.log('✅ Borrador eliminado del servidor');
      } else {
        // Si es un borrador local, eliminarlo de la base de datos local
        console.log('🗑️ Eliminando borrador local');
        await db.sales_drafts.delete(saleId);
        console.log('✅ Borrador local eliminado');
      }
      
      // Eliminar de la lista local inmediatamente
      const updatedDrafts = drafts.filter(d => d.id !== saleId);
      set({ drafts: updatedDrafts });
      console.log('✅ Borrador eliminado de la lista local, quedan:', updatedDrafts.length);
      
      // Si es la venta actual, limpiarla
      const { currentSale } = get();
      if (currentSale?.id === saleId) {
        console.log('🧹 Limpiando venta actual');
        set({ currentSale: null });
      }
      
      // Recargar la lista de borradores para sincronizar
      console.log('🔄 Recargando borradores para sincronizar...');
      await get().loadDrafts();
      
    } catch (error) {
      console.error('❌ Error eliminando borrador:', error);
      throw error; // Re-lanzar el error para que se muestre en la UI
    } finally {
      set({ loading: false });
    }
  },

  loadDrafts: async () => {
    const { loading } = get();
    
    // Evitar cargas duplicadas simultáneas
    if (loading) {
      console.log('⚠️ loadDrafts - Ya hay una carga en progreso, saltando...');
      return;
    }
    
    set({ loading: true });
    try {
      console.log('📥 loadDrafts - Iniciando carga de borradores...');
      
      // Cargar borradores desde el API (ya filtrados por vendedor)
      const response = await getSalesDrafts();
      console.log('📥 loadDrafts - Response from API:', response);
      console.log('📥 loadDrafts - Number of sales found:', response.sales.length);
      const drafts = response.sales.map(sale => {
        console.log(`📥 loadDrafts - Mapping sale: API ID=${sale.id}, UUID=${sale.uuid}, Status=${sale.status}`);
        return {
          id: sale.uuid || sale.id.toString(),
          serverId: sale.id, // ID numérico del servidor
          customerId: sale.customerId || 0,
          customerName: sale.customer?.name || '',
          customerCode: sale.customer?.nit || '',
          warehouseId: sale.warehouseId || 1,
        items: sale.items.map(item => ({
          id: item.id.toString(),
          productId: item.productId,
          productName: item.product.name,
          productSku: item.product.sku,
          unitCode: item.unitCode as UnitCode,
          qty: item.qty,
          qtyBase: item.qtyBase,
          priceUnit: item.priceUnit,
          discount: item.discount,
          lineTotal: item.lineTotal,
        })),
        subtotal: sale.subtotal || 0,
        taxTotal: sale.taxTotal || 0,
        grandTotal: sale.grandTotal || 0,
        createdAt: sale.createdAt,
        updatedAt: sale.updatedAt || sale.createdAt,
        };
      });
      set({ drafts });
      console.log('✅ loadDrafts - Borradores cargados exitosamente:', drafts.length);
    } catch (error: any) {
      console.error('Error loading drafts:', error);
      
      // Si es un error de autenticación (401), el logout ya se hizo en fetchWithAuth
      if (error.message && error.message.includes('401')) {
        console.log('🔐 Error de autenticación detectado, ya se hizo logout en fetchWithAuth');
        set({ drafts: [] });
        return;
      }
      
      // Fallback a base de datos local si falla el API por otras razones
      try {
        const localDrafts = await db.sales_drafts.orderBy('updatedAt').reverse().toArray();
        console.log('📥 loadDrafts - Fallback a borradores locales:', localDrafts.length);
        set({ drafts: localDrafts });
      } catch (localError) {
        console.error('Error loading local drafts:', localError);
        set({ drafts: [] });
      }
    } finally {
      set({ loading: false });
    }
  },

  setCustomer: (customer: CustomerForSale) => {
    const { currentSale } = get();
    if (!currentSale) return;

    const updatedSale = {
      ...currentSale,
      customerId: customer.id,
      customerName: customer.name,
      customerCode: customer.code,
      updatedAt: new Date().toISOString(),
    };

    set({ currentSale: updatedSale });
  },

  addProduct: (product: ProductForSale, unitCode: UnitCode, qty: number) => {
    const { currentSale } = get();
    if (!currentSale) return;

    // Encontrar la unidad seleccionada
    const selectedUnit = product.units.find(u => u.unitCode === unitCode) || 
                        { unitCode: product.unitBase, factor: 1 };

    // Calcular precio por unidad
    const priceUnit = product.priceBase * selectedUnit.factor;
    
    // Crear nuevo item
    const newItem: SaleItem = {
      id: uuidv4(),
      productId: product.id,
      productSku: product.sku,
      productName: product.name,
      unitCode,
      unitFactor: selectedUnit.factor,
      qty,
      qtyBase: qty * selectedUnit.factor,
      priceUnit,
      discount: 0,
      lineTotal: calculateItemTotal({ qty, priceUnit, discount: 0 }),
      productTaxRate: product.taxRate,
      availableUnits: product.units,
    };

    const updatedItems = [...currentSale.items, newItem];
    const totals = calculateSaleTotals(updatedItems);

    const updatedSale = {
      ...currentSale,
      items: updatedItems,
      ...totals,
      updatedAt: new Date().toISOString(),
    };

    set({ currentSale: updatedSale });
  },

  updateItem: (itemId: string, updates: Partial<SaleItem>) => {
    const { currentSale } = get();
    if (!currentSale) return;

    const updatedItems = currentSale.items.map(item => {
      if (item.id !== itemId) return item;

      const updatedItem = { ...item, ...updates };
      
      // Recalcular qtyBase si cambió qty o unitFactor
      if (updates.qty !== undefined || updates.unitFactor !== undefined) {
        updatedItem.qtyBase = updatedItem.qty * updatedItem.unitFactor;
      }
      
      // Recalcular lineTotal
      updatedItem.lineTotal = calculateItemTotal(updatedItem);
      
      return updatedItem;
    });

    const totals = calculateSaleTotals(updatedItems);

    const updatedSale = {
      ...currentSale,
      items: updatedItems,
      ...totals,
      updatedAt: new Date().toISOString(),
    };

    set({ currentSale: updatedSale });
  },

  removeItem: (itemId: string) => {
    const { currentSale } = get();
    if (!currentSale) return;

    const updatedItems = currentSale.items.filter(item => item.id !== itemId);
    const totals = calculateSaleTotals(updatedItems);

    const updatedSale = {
      ...currentSale,
      items: updatedItems,
      ...totals,
      updatedAt: new Date().toISOString(),
    };

    set({ currentSale: updatedSale });
  },

  calculateTotals: () => {
    const { currentSale } = get();
    if (!currentSale) return;

    const totals = calculateSaleTotals(currentSale.items);
    const updatedSale = {
      ...currentSale,
      ...totals,
      updatedAt: new Date().toISOString(),
    };

    set({ currentSale: updatedSale });
  },

  updateSale: (updates: Partial<SaleDraft>) => {
    const { currentSale } = get();
    if (!currentSale) return;

    const updatedSale = {
      ...currentSale,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    set({ currentSale: updatedSale });
  },

  clearCurrentSale: () => {
    console.log('🧹 Limpiando venta actual');
    set({ currentSale: null });
  },

  refreshDrafts: async () => {
    const { loading } = get();
    
    if (loading) {
      console.log('⚠️ refreshDrafts - Ya hay una carga en progreso, saltando...');
      return;
    }
    
    console.log('🔄 refreshDrafts - Recargando borradores de forma segura...');
    try {
      await get().loadDrafts();
      console.log('✅ refreshDrafts - Borradores recargados exitosamente');
    } catch (error) {
      console.error('❌ refreshDrafts - Error recargando borradores:', error);
    }
  },

  confirmSale: async (saleId: string) => {
    const { drafts, currentSale } = get();
    
    // Buscar el borrador
    const draft = drafts.find(d => d.id === saleId) || currentSale;
    if (!draft) {
      throw new Error('Sale not found');
    }

    if (draft.items.length === 0) {
      throw new Error('Cannot confirm sale without items');
    }

    if (draft.customerId === 0) {
      throw new Error('Cannot confirm sale without customer');
    }

    set({ loading: true });
    try {
      // Obtener el ID del usuario actual
      const { useAuth } = await import('../state/auth');
      const { user } = useAuth.getState();
      const sellerId = user?.id || 1; // Fallback temporal, debe ser el usuario actual

      // Preparar datos para la API (convertir strings a números)
      const saleData = {
        customerId: Number(draft.customerId),
        warehouseId: Number(draft.warehouseId || 1),
        sellerId: Number(sellerId),
        items: draft.items.map(item => ({
          productId: Number(item.productId),
          unitCode: item.unitCode,
          qty: Number(item.qty),
          qtyBase: Number(item.qtyBase),
          priceUnit: Number(item.priceUnit),
          discount: Number(item.discount || 0),
          lineTotal: Number(item.lineTotal),
        })),
        subtotal: Number(draft.subtotal),
        taxTotal: Number(draft.taxTotal || 0),
        grandTotal: Number(draft.grandTotal),
        uuid: draft.id, // Para idempotencia
      };

      console.log('📤 Confirmando venta:', saleData);

      // Crear y confirmar venta directamente
      let confirmedSale;
      if (draft.serverId) {
        // Si es un borrador del API, confirmarlo directamente
        console.log('📤 Confirmando borrador existente con ID:', draft.serverId);
        console.log('📤 Draft original ID:', draft.id);
        console.log('📤 Draft serverId:', draft.serverId);
        console.log('📤 Datos a enviar:', saleData);
        
        console.log(`🌐 Llamando a: ${API_URL}/sales/${draft.serverId}/confirm`);
        confirmedSale = await fetchWithAuth(`${API_URL}/sales/${draft.serverId}/confirm`, {
          method: 'POST',
          body: JSON.stringify(saleData)
        });
        console.log('✅ Borrador confirmado exitosamente:', confirmedSale);
      } else {
        // Si no hay borrador en el servidor, crear y confirmar nueva venta directamente
        console.log('📤 Creando y confirmando nueva venta directamente');
        confirmedSale = await confirmSaleAPI(saleData);
        console.log('✅ Venta creada y confirmada exitosamente:', confirmedSale);
      }
      
      // Eliminar el borrador de la lista local inmediatamente
      console.log('🗑️ Eliminando borrador confirmado de la lista local');
      const { drafts } = get();
      const updatedDrafts = drafts.filter(d => d.id !== saleId);
      set({ drafts: updatedDrafts });
      console.log('✅ Borrador eliminado de la lista local, quedan:', updatedDrafts.length);
      
      // Eliminar de la base de datos local si es necesario
      try {
        if (!draft.serverId) {
          // Si es un borrador local, eliminarlo de la base de datos
          console.log('🗑️ Eliminando borrador local de la base de datos');
          await db.sales_drafts.delete(saleId);
        }
      } catch (apiError) {
        console.warn('Error eliminando borrador de la base de datos:', apiError);
      }
      
      // No recargar inmediatamente para evitar problemas de concurrencia
      // La eliminación local es suficiente para la experiencia del usuario
      console.log('✅ Borrador eliminado exitosamente de la lista local');
      
      // Si era la venta actual, limpiarla
      if (currentSale?.id === saleId) {
        set({ currentSale: null });
      }

      console.log('✅ Venta confirmada exitosamente:', confirmedSale);
      return confirmedSale;
    } catch (error) {
      console.error('Error confirming sale:', error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },
}));
