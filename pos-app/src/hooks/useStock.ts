// pos-app/src/hooks/useStock.ts
import { useState, useEffect } from 'react';
import { getStock } from '../data/catalog';
import type { StockItem, StockSummary } from '../types/stock';

export function useStock(warehouseId: number = 1) {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStock = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('🔄 useStock - Cargando stock para warehouse:', warehouseId);
      const data = await getStock(warehouseId);
      console.log('📦 useStock - Datos recibidos:', data);
      console.log('📦 useStock - Tipo de datos:', Array.isArray(data) ? 'Array' : typeof data);
      console.log('📦 useStock - Cantidad de elementos:', Array.isArray(data) ? data.length : 'No es array');
      setStock(data);
    } catch (err) {
      setError('Error al cargar el inventario');
      console.error('❌ useStock - Error loading stock:', err);
    } finally {
      setLoading(false);
    }
  };

  // Función para sincronizar stock después de crear/actualizar productos
  const syncStock = async () => {
    console.log('🔄 useStock - Sincronizando stock después de cambios...');
    await loadStock();
  };

  useEffect(() => {
    loadStock();
  }, [warehouseId]);

  // Función para obtener stock de un producto específico
  const getProductStock = (productId: number): number => {
    const stockItem = stock.find(item => item.productId === productId);
    return stockItem?.qty || 0;
  };

  // Función para verificar si hay stock suficiente
  const hasEnoughStock = (productId: number, requiredQty: number): boolean => {
    const available = getProductStock(productId);
    return available >= requiredQty;
  };

  // Resumen de stock para mostrar en interfaces
  const stockSummary: StockSummary[] = stock.map(item => ({
    productId: item.productId,
    productName: item.product.name,
    sku: item.product.sku,
    availableQty: item.qty,
    unitBase: item.product.unitBase,
    lastUpdated: item.updatedAt
  }));

  // Log para debugging
  console.log('📊 useStock - stockSummary generado:', stockSummary);
  console.log('📊 useStock - stockSummary length:', stockSummary.length);

  return {
    stock,
    stockSummary,
    loading,
    error,
    loadStock,
    syncStock,
    getProductStock,
    hasEnoughStock
  };
}




