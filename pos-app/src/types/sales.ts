// pos-app/src/types/sales.ts

export type UnitCode = string; // Ahora soporta cualquier código de unidad dinámico

export type SaleStatus = "DRAFT" | "CONFIRMED" | "PENDING_SYNC" | "REVIEW_REQUIRED" | "CANCELLED";

export type SaleItem = {
  id: string; // UUID local para identificar el item
  productId: number;
  productSku: string;
  productName: string;
  unitCode: UnitCode;
  unitFactor: number; // cuántas UND equivale esta unidad
  qty: number; // cantidad en la unidad elegida
  qtyBase: number; // cantidad convertida a UND
  priceUnit: number; // precio por la unidad elegida
  discount: number; // descuento en valor absoluto
  lineTotal: number; // total de la línea después del descuento
  productTaxRate: number; // tasa de impuesto del producto (0-100)
  availableUnits: Array<{ unitCode: UnitCode; unitName: string; factor: number }>; // unidades disponibles para este producto
};

export type SaleDraft = {
  id: string; // UUID local
  serverId?: number; // ID numérico del servidor para eliminación
  customerId: number;
  customerName: string;
  customerCode: string;
  warehouseId: number; // por ahora siempre 1
  sellerId: number; // ID del vendedor
  items: SaleItem[];
  subtotal: number;
  taxTotal: number; // por ahora 0
  grandTotal: number;
  notes?: string;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
};

export type ProductForSale = {
  id: number;
  sku: string;
  name: string;
  barcode?: string | null;
  unitBase: UnitCode;
  priceBase: number;
  taxRate: number;
  isActive: boolean;
  units: Array<{ unitCode: UnitCode; unitName: string; factor: number }>;
};

export type CustomerForSale = {
  id: number;
  code: string;
  name: string;
  nit?: string | null;
  isActive: boolean;
};


