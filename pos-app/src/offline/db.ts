// src/offline/db.ts
import Dexie, { type Table } from "dexie";
import type { SaleDraft } from "../types/sales";

export type UnitCode = string; // Ahora soporta cualquier código de unidad personalizada
export type ProductUnit = { unitCode: UnitCode; unitName: string; factor: number };

export type ProductRow = {
  id: number;
  sku: string;
  name: string;
  barcode?: string | null;
  unitBase: UnitCode;
  priceBase: number;
  taxRate: number;
  isActive: boolean;
  updatedAt: string;  // ISO
  units: ProductUnit[];
};

export type CustomerRow = {
  id: number;
  code: string;
  name: string;
  nit?: string | null;
  phone?: string | null;
  address?: string | null;
  isActive: boolean;
  updatedAt: string;  // ISO
};

export type MetaRow = { key: string; value: string };

export type OfflineSaleItem = {
  id: string;
  productId: number;
  productSku: string;
  productName: string;
  unitCode: string;
  unitFactor: number;
  qty: number;
  qtyBase: number;
  priceUnit: number;
  discount: number;
  lineTotal: number;
  productTaxRate: number;
  availableUnits: Array<{ unitCode: string; factor: number }>;
};

export type OfflineSaleRow = {
  id: string; // UUID de la venta offline
  status: 'PENDING_SYNC' | 'CONFIRMED' | 'REVIEW_REQUIRED';
  folio?: string; // Folio asignado por el servidor después de sincronizar
  customerId: number;
  customerName: string;
  customerCode: string;
  warehouseId: number;
  sellerId: number;
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  items: OfflineSaleItem[]; // Array de SaleItem serializado
  notes?: string;
  createdAt: string; // ISO string
  syncedAt?: string; // ISO string
  retryCount: number;
  lastError?: string;
};

class POSDB extends Dexie {
  catalog_products!: Table<ProductRow, number>;
  catalog_customers!: Table<CustomerRow, number>;
  sales_drafts!: Table<SaleDraft, string>;
  offline_sales!: Table<OfflineSaleRow, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super("posdb");
    
    // Versión 1 - esquema original
    this.version(1).stores({
      catalog_products: "id, sku, name, updatedAt",
      catalog_customers: "id, code, name, updatedAt",
      meta: "key",
    });
    
    // Versión 2 - agregar tabla de ventas
    this.version(2).stores({
      catalog_products: "id, sku, name, updatedAt",
      catalog_customers: "id, code, name, updatedAt",
      sales_drafts: "id, customerId, createdAt, updatedAt",
      meta: "key",
    });
    
    // Versión 3 - agregar índices isActive
    this.version(3).stores({
      catalog_products: "id, sku, name, updatedAt, isActive",
      catalog_customers: "id, code, name, updatedAt, isActive",
      sales_drafts: "id, customerId, createdAt, updatedAt",
      meta: "key",
    });
    
    // Versión 4 - agregar tabla de ventas offline pendientes
    this.version(4).stores({
      catalog_products: "id, sku, name, updatedAt, isActive",
      catalog_customers: "id, code, name, updatedAt, isActive",
      sales_drafts: "id, customerId, createdAt, updatedAt",
      offline_sales: "id, status, createdAt, syncedAt",
      meta: "key",
    });
  }
}

export const db = new POSDB();

// Re-exportar tipos (solo tipos; no generan código JS)
export type {
  UnitCode as TUnitCode,
  ProductUnit as TProductUnit,
  ProductRow as TProductRow,
  CustomerRow as TCustomerRow,
  MetaRow as TMetaRow,
  OfflineSaleItem as TOfflineSaleItem,
  OfflineSaleRow as TOfflineSaleRow,
};
