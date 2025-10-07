// pos-app/src/types/stock.ts

export type StockItem = {
  id: number;
  warehouseId: number;
  productId: number;
  qty: number;
  updatedAt: string;
  product: {
    id: number;
    sku: string;
    name: string;
    barcode: string | null;
    unitBase: string;
    priceBase: number;
    isActive: boolean;
  };
  warehouse: {
    id: number;
    code: string;
    name: string;
  };
};

export type StockSummary = {
  productId: number;
  productName: string;
  sku: string;
  availableQty: number;
  unitBase: string;
  lastUpdated: string;
};






