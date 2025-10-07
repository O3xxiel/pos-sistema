// pos-app/src/components/forms/ProductForm.tsx
import { useState, useEffect } from 'react';
import { db } from '../../offline/db';
import { createProduct, updateProduct, getProductUnits, createProductUnit, updateProductUnit, deleteProductUnit, initializeStandardUnits } from '../../data/catalog';
import { useStock } from '../../hooks/useStock';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ProductRow, UnitCode, ProductUnit } from '../../offline/db';

interface ProductFormProps {
  product?: ProductRow | null;
  onSave: () => void;
  onCancel: () => void;
}

interface DynamicUnit {
  id?: number;
  unitCode: string;
  unitName: string;
  factor: number;
  isActive?: boolean;
}

// const UNIT_OPTIONS: { code: UnitCode; name: string }[] = [
//   { code: 'UND', name: 'Unidad' },
//   { code: 'DOC', name: 'Docena' },
//   { code: 'CAJ', name: 'Caja' }
// ];

export default function ProductForm({ product, onSave, onCancel }: ProductFormProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    barcode: '',
    unitBase: 'UND' as UnitCode,
    priceBase: 0,
    taxRate: 0,
    isActive: true,
    initialStock: 0,
    units: [{ unitCode: 'UND' as UnitCode, factor: 1 }] as ProductUnit[]
  });
  const [dynamicUnits, setDynamicUnits] = useState<DynamicUnit[]>([]);
  const [newUnit, setNewUnit] = useState({ unitCode: '', unitName: '', factor: 1 });
  const [editingUnitId, setEditingUnitId] = useState<number | null>(null);
  const [editedUnit, setEditedUnit] = useState<Partial<DynamicUnit>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Hook para obtener stock actual
  const { getProductStock, loadStock, syncStock } = useStock();

  // Query para obtener unidades dinámicas (solo si es un producto existente)
  const { data: productUnits } = useQuery<DynamicUnit[]>({
    queryKey: ['productUnits', product?.id],
    queryFn: () => product?.id ? getProductUnits(product.id) : Promise.resolve([]),
    enabled: !!product?.id,
  });

  // Mutaciones para gestionar unidades
  const createUnitMutation = useMutation({
    mutationFn: (unitData: { unitCode: string; unitName: string; factor: number }) =>
      product?.id ? createProductUnit(product.id, unitData) : Promise.resolve(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productUnits', product?.id] });
    },
  });

  const updateUnitMutation = useMutation({
    mutationFn: ({ unitId, data }: { unitId: number; data: Partial<DynamicUnit> }) =>
      updateProductUnit(unitId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productUnits', product?.id] });
    },
  });

  const deleteUnitMutation = useMutation({
    mutationFn: (unitId: number) => deleteProductUnit(unitId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productUnits', product?.id] });
    },
  });

  const initializeUnitsMutation = useMutation({
    mutationFn: () => product?.id ? initializeStandardUnits(product.id) : Promise.resolve(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productUnits', product?.id] });
    },
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
        units: product.units.length > 0 ? product.units : [{ unitCode: product.unitBase, unitName: 'Unidad', factor: 1 }]
      });
    }
  }, [product]);

  // Actualizar unidades dinámicas cuando cambien los datos del servidor
  useEffect(() => {
    if (productUnits) {
      setDynamicUnits(productUnits);
    }
  }, [productUnits]);

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

      // Verificar que la unidad base esté en las unidades
      const hasBaseUnit = formData.units.some(u => u.unitCode === formData.unitBase);
      if (!hasBaseUnit) {
        formData.units.unshift({ unitCode: formData.unitBase, unitName: 'Unidad', factor: 1 });
      }

      const productData: ProductRow = {
        id: product?.id || Math.floor(Math.random() * 1000000), // ID temporal más pequeño
        sku: formData.sku.trim(),
        name: formData.name.trim(),
        barcode: formData.barcode.trim() || null,
        unitBase: 'UND' as UnitCode, // Siempre UND
        priceBase: formData.priceBase,
        taxRate: formData.taxRate,
        isActive: formData.isActive,
        updatedAt: new Date().toISOString(),
        units: formData.units
      };

      let savedProduct: ProductRow;

      if (product) {
        // Actualizar producto existente
        try {
          // Intentar actualizar en el backend primero
          const productDataWithStock = { ...productData, initialStock: formData.initialStock };
          
          const backendProduct = await updateProduct(product.id, productDataWithStock);
          savedProduct = backendProduct;
          // Actualizar en la base de datos local
          await db.catalog_products.update(product.id, savedProduct);
          // Actualizar el stock después de editar el producto
          await loadStock();
        } catch (error) {
          console.warn('Failed to update product on backend:', error);
          // Verificar si es un error de permisos
          if (error instanceof Error && error.message.includes('403')) {
            throw new Error('No tienes permisos para editar productos. Solo los administradores pueden editar productos.');
          }
          // Si es otro tipo de error, guardar localmente
          await db.catalog_products.update(product.id, productData);
          savedProduct = productData;
        }
      } else {
        // Crear nuevo producto
        try {
          // Intentar crear en el backend primero
          const createData = {
            sku: productData.sku,
            name: productData.name,
            barcode: productData.barcode,
            unitBase: productData.unitBase,
            priceBase: productData.priceBase,
            taxRate: productData.taxRate,
            isActive: productData.isActive,
            initialStock: formData.initialStock,
            units: productData.units
          };
          
          
          const backendProduct = await createProduct(createData);
          savedProduct = backendProduct;
          // Guardar en la base de datos local
          await db.catalog_products.put(savedProduct);
          // Sincronizar el stock después de crear el producto
          await syncStock();
        } catch (error) {
          console.warn('Failed to create product on backend:', error);
          
          // Verificar si es un error de permisos
          if (error instanceof Error && error.message.includes('403')) {
            throw new Error('No tienes permisos para crear productos. Solo los administradores pueden crear productos.');
          }
          
          // Verificar si es un error de SKU duplicado
          if (error instanceof Error && (error.message.includes('Unique constraint failed') || error.message.includes('sku'))) {
            throw new Error(`El SKU "${formData.sku}" ya existe. Por favor, usa un SKU diferente.`);
          }
          
          // Si es otro tipo de error, guardar localmente
          await db.catalog_products.add(productData);
          savedProduct = productData;
        }
      }

      // Sincronizar stock para actualizar la información
      await syncStock();
      
      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar el producto');
    } finally {
      setLoading(false);
    }
  };

  // const addUnit = () => {
  //   setFormData(prev => ({
  //     ...prev,
  //     units: [...prev.units, { unitCode: 'UND', factor: 1 }]
  //   }));
  // };

  // const removeUnit = (index: number) => {
  //   if (formData.units.length > 1) {
  //     setFormData(prev => ({
  //       ...prev,
  //       units: prev.units.filter((_, i) => i !== index)
  //     }));
  //   }
  // };

  // const updateUnit = (index: number, field: keyof ProductUnit, value: UnitCode | number) => {
  //   setFormData(prev => ({
  //     ...prev,
  //     units: prev.units.map((unit, i) => 
  //       i === index ? { ...unit, [field]: value } : unit
  //     )
  //   }));
  // };

  // Funciones para manejar unidades dinámicas
  const handleCreateUnit = () => {
    if (newUnit.unitCode && newUnit.unitName && newUnit.factor > 0) {
      if (product?.id) {
        createUnitMutation.mutate(newUnit);
      } else {
        // Para productos nuevos, agregar a la lista local
        setDynamicUnits(prev => [...prev, { ...newUnit, id: Date.now() }]);
      }
      setNewUnit({ unitCode: '', unitName: '', factor: 1 });
    }
  };

  const handleEditClick = (unit: DynamicUnit) => {
    setEditingUnitId(unit.id!);
    setEditedUnit({ unitCode: unit.unitCode, unitName: unit.unitName, factor: unit.factor });
  };

  const handleSaveEdit = (unitId: number) => {
    if (product?.id) {
      updateUnitMutation.mutate({ unitId, data: editedUnit });
    } else {
      // Para productos nuevos, actualizar en la lista local
      setDynamicUnits(prev => 
        prev.map(unit => 
          unit.id === unitId ? { ...unit, ...editedUnit } : unit
        )
      );
    }
    setEditingUnitId(null);
    setEditedUnit({});
  };

  const handleCancelEdit = () => {
    setEditingUnitId(null);
    setEditedUnit({});
  };

  const handleDeleteUnit = (unitId: number) => {
    if (product?.id) {
      deleteUnitMutation.mutate(unitId);
    } else {
      // Para productos nuevos, eliminar de la lista local
      setDynamicUnits(prev => prev.filter(unit => unit.id !== unitId));
    }
  };

  const handleInitializeUnits = () => {
    if (product?.id) {
      initializeUnitsMutation.mutate();
    } else {
      // Para productos nuevos, agregar unidades estándar a la lista local
      const standardUnits = [
        { id: Date.now(), unitCode: 'UND', unitName: 'Unidad', factor: 1 },
        { id: Date.now() + 1, unitCode: 'DOC', unitName: 'Docena', factor: 12 },
        { id: Date.now() + 2, unitCode: 'CAJ', unitName: 'Caja', factor: 1 },
      ];
      setDynamicUnits(prev => [...prev, ...standardUnits]);
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
                  value="Unidad (UND)"
                  className="input bg-gray-100 cursor-not-allowed"
                  disabled
                  readOnly
                />
                <p className="text-xs text-gray-500 mt-1">
                  La unidad base siempre es UND. Las otras unidades se gestionan abajo
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

            {/* Unidades de medida dinámicas */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  Unidades de Medida
                </label>
                <div className="flex gap-2">
                  {(!product || dynamicUnits.length === 0) && (
                    <button
                      type="button"
                      onClick={handleInitializeUnits}
                      disabled={initializeUnitsMutation.isPending}
                      className="text-sm text-green-600 hover:text-green-700 disabled:opacity-50"
                    >
                      {initializeUnitsMutation.isPending ? 'Inicializando...' : 'Inicializar Estándar'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setNewUnit({ unitCode: '', unitName: '', factor: 1 })}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    + Agregar Unidad
                  </button>
                </div>
              </div>

              {/* Lista de unidades existentes */}
              <div className="space-y-2 mb-4">
                {dynamicUnits.map((unit) => (
                  <div key={unit.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-md border border-gray-200">
                    {editingUnitId === unit.id ? (
                      <div className="flex-1 grid grid-cols-3 gap-2 items-center">
                        <input
                          type="text"
                          value={editedUnit.unitCode || ''}
                          onChange={(e) => setEditedUnit(prev => ({ ...prev, unitCode: e.target.value }))}
                          className="px-2 py-1 border rounded-md text-sm"
                          placeholder="Código"
                        />
                        <input
                          type="text"
                          value={editedUnit.unitName || ''}
                          onChange={(e) => setEditedUnit(prev => ({ ...prev, unitName: e.target.value }))}
                          className="px-2 py-1 border rounded-md text-sm"
                          placeholder="Nombre"
                        />
                        <input
                          type="number"
                          value={editedUnit.factor || 0}
                          onChange={(e) => setEditedUnit(prev => ({ ...prev, factor: parseInt(e.target.value) }))}
                          className="px-2 py-1 border rounded-md text-sm"
                          placeholder="Factor"
                        />
                      </div>
                    ) : (
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">{unit.unitName} ({unit.unitCode})</p>
                        <p className="text-sm text-gray-600">Factor: {unit.factor} UND</p>
                      </div>
                    )}
                    <div className="flex items-center space-x-2 ml-4">
                      {editingUnitId === unit.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(unit.id!)}
                            disabled={updateUnitMutation.isPending}
                            className="p-2 rounded-full text-green-600 hover:bg-green-100 disabled:opacity-50"
                            title="Guardar cambios"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="p-2 rounded-full text-red-600 hover:bg-red-100"
                            title="Cancelar edición"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleEditClick(unit)}
                            className="p-2 rounded-full text-blue-600 hover:bg-blue-100"
                            title="Editar unidad"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteUnit(unit.id!)}
                            disabled={deleteUnitMutation.isPending}
                            className="p-2 rounded-full text-red-600 hover:bg-red-100 disabled:opacity-50"
                            title="Eliminar unidad"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Formulario para agregar nueva unidad */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="text-sm font-medium text-blue-800 mb-3">Agregar Nueva Unidad</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={newUnit.unitCode}
                    onChange={(e) => setNewUnit(prev => ({ ...prev, unitCode: e.target.value.toUpperCase() }))}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="Código (ej. BOLSA)"
                  />
                  <input
                    type="text"
                    value={newUnit.unitName}
                    onChange={(e) => setNewUnit(prev => ({ ...prev, unitName: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="Nombre (ej. Bolsa)"
                  />
                  <input
                    type="number"
                    value={newUnit.factor}
                    onChange={(e) => setNewUnit(prev => ({ ...prev, factor: parseInt(e.target.value) || 1 }))}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="Factor (ej. 30)"
                    min="1"
                  />
                </div>
                <div className="flex justify-end gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => setNewUnit({ unitCode: '', unitName: '', factor: 1 })}
                    className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateUnit}
                    disabled={createUnitMutation.isPending || !newUnit.unitCode || !newUnit.unitName || newUnit.factor <= 0}
                    className="px-4 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {createUnitMutation.isPending ? 'Creando...' : 'Crear Unidad'}
                  </button>
                </div>
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