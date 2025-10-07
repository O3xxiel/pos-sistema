import { useState, useEffect } from 'react';
import { db } from '../../offline/db';
import { createProduct, updateProduct } from '../../data/catalog';
import { useStock } from '../../hooks/useStock';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../state/auth';
import { API_URL } from '../../data/api';
import type { ProductRow, UnitCode, ProductUnit } from '../../offline/db';

interface ProductFormProps {
  product?: ProductRow | null;
  onSave: () => void;
  onCancel: () => void;
}

// API function para obtener unidades disponibles
const fetchUnits = async (accessToken: string) => {
  const response = await fetch(`${API_URL}/catalog/units/all`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) throw new Error('Error al cargar unidades');
  return response.json();
};

export default function ProductFormSimplified({ product, onSave, onCancel }: ProductFormProps) {
  const { accessToken, isAuthenticated } = useAuth();
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    barcode: '',
    unitBase: 'UND' as string,
    priceBase: 0,
    taxRate: 0,
    isActive: true,
    initialStock: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Hook para obtener stock actual
  const { getProductStock, loadStock, syncStock } = useStock();

  // Query para obtener unidades disponibles
  const { data: units } = useQuery({
    queryKey: ['units'],
    queryFn: () => fetchUnits(accessToken!),
    enabled: !!accessToken && isAuthenticated,
  });

  useEffect(() => {
    if (product) {
      const currentStock = getProductStock(product.id);
      setFormData({
        sku: product.sku,
        name: product.name,
        barcode: product.barcode || '',
        unitBase: product.unitBase,
        priceBase: product.priceBase,
        taxRate: product.taxRate,
        isActive: product.isActive,
        initialStock: currentStock,
      });
    }
  }, [product]);

  // Verificar autenticación
  if (!isAuthenticated || !accessToken) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
          <div className="p-6">
            <div className="text-yellow-800 mb-4">
              <p className="text-center">Debes iniciar sesión para gestionar productos.</p>
            </div>
            <div className="flex justify-center">
              <button onClick={onCancel} className="btn-secondary">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Verificar si el SKU ya existe (solo para productos nuevos)
    if (!product) {
      const existingProducts = await db.catalog_products.toArray();
      const existingProduct = existingProducts.find(p => p.sku.toLowerCase() === formData.sku.toLowerCase());
      if (existingProduct) {
        setError(`El SKU "${formData.sku}" ya existe. Por favor, usa un SKU diferente.`);
        setLoading(false);
        return;
      }
    }

    try {
      // Validaciones básicas
      if (!formData.sku.trim()) {
        throw new Error('El SKU es requerido');
      }
      if (!formData.name.trim()) {
        throw new Error('El nombre es requerido');
      }
      if (formData.priceBase <= 0) {
        throw new Error('El precio debe ser mayor a 0');
      }

      // Debug: Verificar que las unidades estén cargadas
      console.log('🔍 Debug - Units loaded:', units);
      console.log('🔍 Debug - Selected unitBase:', formData.unitBase);
      
      if (!units || units.length === 0) {
        throw new Error('Las unidades no se han cargado correctamente. Intenta recargar la página.');
      }

      const productData: ProductRow = {
        id: product?.id || Math.floor(Math.random() * 1000000),
        sku: formData.sku.trim(),
        name: formData.name.trim(),
        barcode: formData.barcode.trim() || null,
        unitBase: 'UND' as UnitCode, // Siempre UND
        priceBase: formData.priceBase,
        taxRate: formData.taxRate,
        isActive: formData.isActive,
        updatedAt: new Date().toISOString(),
        units: [{ unitCode: 'UND' as UnitCode, factor: 1 }] as ProductUnit[]
      };

      let savedProduct: ProductRow;

      if (product) {
        // Actualizar producto existente
        try {
          // Para la unidad base, usar un enfoque más simple
          let productDataWithStock: any = { 
            ...productData, 
            initialStock: formData.initialStock,
          };

          // Solo agregar unidades si están disponibles
          if (units && units.length > 0) {
            console.log('🔍 Debug - Updating product - Searching for unit with code:', formData.unitBase);
            console.log('🔍 Debug - Available units:', units?.map((u: any) => ({ id: u.id, code: u.code, name: u.name })));
            
            const selectedUnit = units?.find((u: any) => u.code === formData.unitBase);
            console.log('🔍 Debug - Selected unit found:', selectedUnit);
            
            if (selectedUnit) {
              productDataWithStock.units = [{
                unitId: selectedUnit.id,
                factor: 1
              }];
            } else {
              console.warn('⚠️ Unidad no encontrada, actualizando producto sin unidades');
            }
          } else {
            console.warn('⚠️ No hay unidades disponibles, actualizando producto sin unidades');
          }
          const backendProduct = await updateProduct(product.id, productDataWithStock);
          savedProduct = backendProduct;
          await db.catalog_products.update(product.id, savedProduct);
          await loadStock();
        } catch (error) {
          console.warn('Failed to update product on backend:', error);
          if (error instanceof Error && error.message.includes('403')) {
            throw new Error('No tienes permisos para editar productos. Solo los administradores pueden editar productos.');
          }
          await db.catalog_products.update(product.id, productData);
          savedProduct = productData;
        }
      } else {
        // Crear nuevo producto
        try {
          // Para la unidad base, usar un enfoque más simple
          // Si no hay unidades cargadas, crear el producto sin unidades por ahora
          let createData: any = {
            sku: productData.sku,
            name: productData.name,
            barcode: productData.barcode,
            unitBase: productData.unitBase,
            priceBase: productData.priceBase,
            taxRate: productData.taxRate,
            isActive: productData.isActive,
            initialStock: formData.initialStock,
          };

          // Solo agregar unidades si están disponibles
          if (units && units.length > 0) {
            console.log('🔍 Debug - Searching for unit with code:', formData.unitBase);
            console.log('🔍 Debug - Available units:', units?.map((u: any) => ({ id: u.id, code: u.code, name: u.name })));
            
            const selectedUnit = units?.find((u: any) => u.code === formData.unitBase);
            console.log('🔍 Debug - Selected unit found:', selectedUnit);
            
            if (selectedUnit) {
              createData.units = [{
                unitId: selectedUnit.id,
                factor: 1
              }];
            } else {
              console.warn('⚠️ Unidad no encontrada, creando producto sin unidades');
            }
          } else {
            console.warn('⚠️ No hay unidades disponibles, creando producto sin unidades');
          }
          
          const backendProduct = await createProduct(createData);
          savedProduct = backendProduct;
          await db.catalog_products.put(savedProduct);
          await syncStock();
        } catch (error) {
          console.warn('Failed to create product on backend:', error);
          
          if (error instanceof Error && error.message.includes('403')) {
            throw new Error('No tienes permisos para crear productos. Solo los administradores pueden crear productos.');
          }
          
          // Verificar si es un error de SKU duplicado
          if (error instanceof Error && (error.message.includes('Unique constraint failed') || error.message.includes('sku'))) {
            throw new Error(`El SKU "${formData.sku}" ya existe. Por favor, usa un SKU diferente.`);
          }
          
          await db.catalog_products.add(productData);
          savedProduct = productData;
        }
      }

      await loadStock();
      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar el producto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              {product ? 'Editar Producto' : 'Nuevo Producto'}
            </h2>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Información básica */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SKU *
                </label>
                <input
                  type="text"
                  value={formData.sku}
                  onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                  className="input"
                  placeholder="Ej: PROD001"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código de Barras
                </label>
                <input
                  type="text"
                  value={formData.barcode}
                  onChange={(e) => setFormData(prev => ({ ...prev, barcode: e.target.value }))}
                  className="input"
                  placeholder="Ej: 1234567890123"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre del Producto *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="input"
                placeholder="Ej: Producto de ejemplo"
                required
              />
            </div>

            {/* Precios y unidades */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unidad Base *
                </label>
                <input
                  type="text"
                  value="Unidad (UND) - u"
                  className="input bg-gray-100 cursor-not-allowed"
                  disabled
                  readOnly
                />
                <p className="text-xs text-gray-500 mt-1">
                  La unidad base siempre es UND. Las otras unidades se gestionan en "Gestión de Unidades"
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Precio Base *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.priceBase}
                  onChange={(e) => setFormData(prev => ({ ...prev, priceBase: parseFloat(e.target.value) || 0 }))}
                  className="input"
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tasa de Impuesto (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.taxRate * 100}
                  onChange={(e) => setFormData(prev => ({ ...prev, taxRate: (parseFloat(e.target.value) || 0) / 100 }))}
                  className="input"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stock Inicial
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.initialStock}
                  onChange={(e) => {
                    const value = e.target.value === '' ? 0 : Number(e.target.value);
                    setFormData(prev => ({ ...prev, initialStock: value }));
                  }}
                  className="input"
                  placeholder="0"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {product ? 'Actualizar stock actual' : 'Cantidad inicial en inventario'}
                </p>
              </div>
            </div>

            {/* Estado */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                className="mr-2"
              />
              <label htmlFor="isActive" className="text-sm text-gray-700">
                Producto activo
              </label>
            </div>

            {/* Botones */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={onCancel}
                className="btn-secondary"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
              >
                {loading ? 'Guardando...' : (product ? 'Actualizar' : 'Crear')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
