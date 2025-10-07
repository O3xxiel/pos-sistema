import { fetchWithAuth } from './api';
import { db } from '../offline/db';
import type { ProductRow, CustomerRow } from '../offline/db';

type Page<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  lastUpdatedAt: string | null;
};


export async function syncProducts() {
  const meta = await db.meta.get('lastSyncProducts');
  const since = meta?.value;
  let page = 1;
  const pageSize = 200;
  let totalSaved = 0;
  const allBackendProducts: ProductRow[] = [];

  // Trae páginas hasta completar
  while (true) {
    const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (since) qs.set('updated_since', since);
    const data: Page<ProductRow> = await fetchWithAuth(`/catalog/products?${qs.toString()}`);

    if (data.items.length) {
      const rows = data.items.map(p => {
        const mappedProduct = { ...p, updatedAt: new Date(p.updatedAt as string).toISOString() };
        console.log(`🔄 Sincronizando producto: ${mappedProduct.name}`, {
          id: mappedProduct.id,
          sku: mappedProduct.sku,
          units: mappedProduct.units,
          unitsLength: mappedProduct.units?.length || 0
        });
        return mappedProduct;
      });
      allBackendProducts.push(...rows);
      totalSaved += rows.length;
    }
    if (!data.hasMore) {
      break;
    }
    page += 1;
  }

  // Si es una sincronización completa (sin 'since'), eliminar productos que ya no existen en el backend
  if (!since) {
    console.log('🔄 Sincronización completa: eliminando productos obsoletos...');
    const backendIds = new Set(allBackendProducts.map(p => p.id));
    const localProducts = await db.catalog_products.toArray();
    const productsToDelete = localProducts.filter(p => !backendIds.has(p.id));
    
    if (productsToDelete.length > 0) {
      console.log(`🗑️ Eliminando ${productsToDelete.length} productos obsoletos:`, productsToDelete.map(p => `${p.name} (${p.sku})`));
      await db.catalog_products.bulkDelete(productsToDelete.map(p => p.id));
    }
  }

  // Guardar todos los productos del backend
  if (allBackendProducts.length > 0) {
    await db.catalog_products.bulkPut(allBackendProducts);
  }

  await db.meta.put({ key: 'lastSyncProducts', value: new Date().toISOString() });
  return { saved: totalSaved };
}

export async function syncCustomers() {
  console.log('🔄 Iniciando sincronización de clientes...');
  const meta = await db.meta.get('lastSyncCustomers');
  const since = meta?.value;
  console.log('📅 Última sincronización de clientes:', since || 'Nunca');
  
  let page = 1;
  const pageSize = 200;
  let totalSaved = 0;

  while (true) {
    const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (since) qs.set('updated_since', since);
    
    console.log(`📡 Solicitando página ${page} de clientes...`);
    const data: Page<CustomerRow> = await fetchWithAuth(`/catalog/customers?${qs.toString()}`);
    console.log(`📊 Página ${page}: ${data.items.length} clientes recibidos`);

    if (data.items.length) {
      const rows = data.items.map(c => ({ ...c, updatedAt: new Date(c.updatedAt as string).toISOString() }));
      await db.catalog_customers.bulkPut(rows);
      totalSaved += rows.length;
      console.log(`💾 Guardados ${rows.length} clientes en la base de datos local`);
    }
    if (!data.hasMore) {
      await db.meta.put({ key: 'lastSyncCustomers', value: new Date().toISOString() });
      console.log('✅ Sincronización de clientes completada');
      break;
    }
    page += 1;
  }
  console.log(`🎉 Total de clientes sincronizados: ${totalSaved}`);
  return { saved: totalSaved };
}

export async function getLastSyncTimes() {
  const [p, c] = await Promise.all([
    db.meta.get('lastSyncProducts'),
    db.meta.get('lastSyncCustomers'),
  ]);
  return {
    products: p?.value ?? null,
    customers: c?.value ?? null,
  };
}

// Funciones para crear/actualizar productos
export async function createProduct(productData: Omit<ProductRow, 'id' | 'updatedAt'> & { initialStock?: number }) {
  return await fetchWithAuth('/catalog/products', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(productData),
  });
}

export async function updateProduct(id: number, productData: Partial<ProductRow> & { initialStock?: number }) {
  return await fetchWithAuth(`/catalog/products/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(productData),
  });
}

export async function deleteProduct(id: number) {
  return await fetchWithAuth(`/catalog/products/${id}`, {
    method: 'DELETE',
  });
}

// Funciones para crear/actualizar clientes
export async function createCustomer(customerData: Omit<CustomerRow, 'id' | 'updatedAt'>) {
  return await fetchWithAuth('/catalog/customers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(customerData),
  });
}

export async function updateCustomer(id: number, customerData: Partial<CustomerRow>) {
  return await fetchWithAuth(`/catalog/customers/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(customerData),
  });
}

export async function deleteCustomer(id: number) {
  return await fetchWithAuth(`/catalog/customers/${id}`, {
    method: 'DELETE',
  });
}

export async function getStock(warehouseId: number = 1) {
  console.log('📦 Solicitando stock para warehouse:', warehouseId);
  try {
    const result = await fetchWithAuth(`/catalog/stock?warehouseId=${warehouseId}`, {
      method: 'GET',
    });
    console.log('📦 Stock recibido:', result);
    return result;
  } catch (error) {
    console.error('❌ Error obteniendo stock:', error);
    throw error;
  }
}

// Funciones para confirmación de ventas
export async function confirmSale(saleData: {
  customerId: number;
  warehouseId?: number;
  sellerId: number;
  items: Array<{
    productId: number;
    unitCode: string;
    qty: number;
    qtyBase: number;
    priceUnit: number;
    discount?: number;
    lineTotal: number;
  }>;
  subtotal: number;
  taxTotal?: number;
  grandTotal: number;
  uuid?: string;
}) {
  return await fetchWithAuth(`/sales/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(saleData),
  });
}

// ==================== UNIDADES DE MEDIDA ====================

export async function getProductUnits(productId: number) {
  return fetchWithAuth(`/catalog/units/product/${productId}`);
}

export async function createProductUnit(productId: number, unitData: {
  unitCode: string;
  unitName: string;
  factor: number;
}) {
  return fetchWithAuth(`/catalog/units/product/${productId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(unitData),
  });
}

export async function updateProductUnit(unitId: number, unitData: {
  unitCode?: string;
  unitName?: string;
  factor?: number;
  isActive?: boolean;
}) {
  return fetchWithAuth(`/catalog/units/${unitId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(unitData),
  });
}

export async function deleteProductUnit(unitId: number) {
  return fetchWithAuth(`/catalog/units/${unitId}`, {
    method: 'DELETE',
  });
}

export async function getStandardUnits() {
  return fetchWithAuth(`/catalog/units/standard`);
}

export async function initializeStandardUnits(productId: number) {
  return fetchWithAuth(`/catalog/units/product/${productId}/initialize`, {
    method: 'POST',
  });
}
