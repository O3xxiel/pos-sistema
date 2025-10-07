import { useEffect, useState } from 'react';
import { db } from '../offline/db';
import { deleteProduct, syncProducts } from '../data/catalog';
import type { ProductRow } from '../offline/db';
import ProductFormSimplified from '../components/forms/ProductFormSimplified';
import ProductUnitsManager from '../components/ProductUnitsManager';
import { useToast } from '../hooks/useToast';
import { useStock } from '../hooks/useStock';

export default function ProductsPage() {
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [showUnitsManager, setShowUnitsManager] = useState(false);
  const [selectedProductForUnits, setSelectedProductForUnits] = useState<ProductRow | null>(null);
  const toast = useToast();
  
  // Hook para obtener stock
  const { getProductStock, loading: stockLoading, syncStock } = useStock();

  useEffect(() => {
    const load = async () => {
      try {
      const all = await db.catalog_products.toArray();
      setRows(all);
      } catch (error) {
        console.error('Error loading products:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = q
    ? rows.filter(r =>
        r.name.toLowerCase().includes(q.toLowerCase()) ||
        r.sku.toLowerCase().includes(q.toLowerCase()) ||
        (r.barcode && r.barcode.toLowerCase().includes(q.toLowerCase()))
      )
    : rows;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-GT', {
      style: 'currency',
      currency: 'GTQ'
    }).format(price);
  };

  const handleCreateProduct = () => {
    setEditingProduct(null);
    setShowForm(true);
  };

  const handleEditProduct = (product: ProductRow) => {
    setEditingProduct(product);
    setShowForm(true);
  };

  const handleDeleteProduct = async (productId: number) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este producto?')) {
      return;
    }

    setDeleting(productId);
    try {
      // Intentar eliminar del backend primero
      try {
        await deleteProduct(productId);
        console.log('✅ Producto eliminado del backend');
        toast.success('Producto eliminado correctamente');
      } catch (error) {
        console.error('Error eliminando del backend:', error);
        
        // Si el producto no existe en el backend (404), solo eliminarlo localmente
        if (error instanceof Error && (error.message.includes('404') || error.message.includes('Not Found'))) {
          console.log('⚠️ Producto no existe en backend, eliminando solo localmente');
          await db.catalog_products.delete(productId);
          setRows(rows.filter(p => p.id !== productId));
          toast.success('Producto eliminado (solo local - no existía en servidor)');
          return;
        }
        
        // Para otros errores, mostrar mensaje específico
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        console.error('Error específico:', errorMessage);
        toast.error(`Error al eliminar del backend: ${errorMessage}`);
        return;
      }
      
      // Solo eliminar localmente si el backend fue exitoso
      await db.catalog_products.delete(productId);
      setRows(rows.filter(p => p.id !== productId));
      console.log('✅ Producto eliminado localmente');
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Error al eliminar producto');
    } finally {
      setDeleting(null);
    }
  };

  const reloadProducts = async () => {
    try {
      const all = await db.catalog_products.toArray();
      setRows(all);
    } catch (error) {
      console.error('Error reloading products:', error);
    }
  };

  const handleSyncProducts = async () => {
    try {
      setSyncing(true);
      console.log('🔄 Iniciando sincronización manual de productos...');
      
      // Limpiar cache de sincronización para forzar sincronización completa
      await db.meta.delete('lastSyncProducts');
      await db.meta.delete('lastSyncCustomers');
      
      // Limpiar productos locales para evitar datos desincronizados
      await db.catalog_products.clear();
      
      const result = await syncProducts();
      console.log('✅ Sincronización completada:', result);
      
      // Verificar que las unidades se guardaron correctamente
      const syncedProducts = await db.catalog_products.toArray();
      console.log('🔍 Verificando productos sincronizados:');
      syncedProducts.forEach(product => {
        console.log(`- ${product.name}: ${product.units?.length || 0} unidades`, product.units);
      });
      
      // Recargar la lista después de sincronizar
      await reloadProducts();
      
      toast.success(`Sincronización completada. ${result.saved} productos actualizados.`);
    } catch (error) {
      console.error('❌ Error sincronizando productos:', error);
      toast.error(`Error sincronizando productos: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setSyncing(false);
    }
  };


  // Función para forzar sincronización completa
  const handleForceSync = async () => {
    if (!confirm('¿Estás seguro de que deseas forzar una sincronización completa? Esto limpiará todos los datos locales y los volverá a descargar del servidor.')) {
      return;
    }

    try {
      setSyncing(true);
      console.log('🔄 Iniciando sincronización forzada...');
      
      // Limpiar TODOS los datos locales
      await db.catalog_products.clear();
      await db.meta.clear();
      
      console.log('🧹 Datos locales limpiados');
      
      // Sincronizar productos
      const result = await syncProducts();
      console.log('✅ Sincronización completada:', result);
      
      // Verificar que las unidades se guardaron correctamente
      const syncedProducts = await db.catalog_products.toArray();
      console.log('🔍 Verificando productos sincronizados:');
      syncedProducts.forEach(product => {
        console.log(`- ${product.name}: ${product.units?.length || 0} unidades`, product.units);
      });
      
      // Recargar la lista
      await reloadProducts();
      
      toast.success(`Sincronización forzada completada. ${result.saved} productos actualizados.`);
    } catch (error) {
      console.error('❌ Error en sincronización forzada:', error);
      toast.error(`Error en sincronización: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveProduct = async () => {
    try {
      // Recargar la lista completa desde la base de datos
      await reloadProducts();
      
      // Sincronizar el stock para mostrar valores actualizados
      await syncStock();

      setShowForm(false);
      setEditingProduct(null);
      
      // Mostrar notificación de éxito
      toast.success(
        editingProduct ? 'Producto actualizado correctamente' : 'Producto creado correctamente'
      );
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Error al guardar el producto');
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingProduct(null);
  };

  const handleManageUnits = (product: ProductRow) => {
    setSelectedProductForUnits(product);
    setShowUnitsManager(true);
  };

  const handleCloseUnitsManager = () => {
    setShowUnitsManager(false);
    setSelectedProductForUnits(null);
  };


  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="h-12 bg-gray-200 rounded mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Catálogo de Productos - Surtidora Katy</h1>
          <p className="text-gray-600 mt-1">
            {filtered.length} de {rows.length} productos
          </p>
        </div>
        
        {/* Actions */}
        <div className="flex items-center space-x-3 mt-4 sm:mt-0">
          <button
            onClick={handleSyncProducts}
            disabled={syncing}
            className={`px-4 py-2 rounded-lg text-sm font-medium shadow-md transition-all duration-200 flex items-center ${
              syncing
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 text-white hover:shadow-lg'
            }`}
            title="Sincronizar productos con el servidor"
          >
            {syncing ? (
              <>
                <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Sincronizando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sincronizar
              </>
            )}
          </button>
          <button
            onClick={handleForceSync}
            disabled={syncing}
            className={`px-4 py-2 rounded-lg text-sm font-medium shadow-md transition-all duration-200 flex items-center ${
              syncing
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700 text-white hover:shadow-lg'
            }`}
            title="Forzar sincronización completa (limpia todo y vuelve a descargar)"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Sincronización Forzada
          </button>
          <button
            onClick={handleCreateProduct}
            className="btn-primary"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Nuevo Producto
          </button>
          
          {/* View Mode Toggle */}
          <div className="flex items-center space-x-1 border rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
              title="Vista de cuadrícula"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
              title="Vista de lista"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      <input
          type="text"
          placeholder="Buscar por nombre, SKU o código de barras..."
          className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white placeholder-gray-500 text-base"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
        {q && (
          <button
            onClick={() => setQ('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
          >
            <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Products Grid/List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <svg className="mx-auto w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <p className="text-gray-500 text-lg">
            {q ? 'No se encontraron productos' : 'No hay productos disponibles'}
          </p>
          <p className="text-gray-400 mt-1">
            {q ? 'Intenta con otros términos de búsqueda' : 'Sincroniza para cargar el catálogo'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.slice(0, 100).map(product => (
            <div key={product.id} className="card hover:shadow-md transition-shadow duration-200 group cursor-pointer">
              {/* Product Image Placeholder */}
              <div className="w-full h-32 bg-gray-100 rounded-lg mb-4 flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              
              {/* Product Info */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                  {product.name}
                </h3>
                
                <div className="space-y-1 text-sm text-gray-600 mb-3">
                  <div className="flex justify-between">
                    <span>SKU:</span>
                    <span className="font-medium">{product.sku}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Unidad:</span>
                    <span className="font-medium">{product.unitBase}</span>
                  </div>
                  {product.barcode && (
                    <div className="flex justify-between">
                      <span>Código:</span>
                      <span className="font-medium text-xs">{product.barcode}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Stock:</span>
                    <span className={`font-medium ${
                      stockLoading ? 'text-gray-400' : 
                      getProductStock(product.id) > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {stockLoading ? 'Cargando...' : `${getProductStock(product.id)} ${product.unitBase}`}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-green-600">
                    {formatPrice(product.priceBase)}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    product.isActive 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {product.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                
                {/* Actions */}
                <div className="flex items-center justify-end space-x-2 mt-4 pt-4 border-t border-gray-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleManageUnits(product);
                    }}
                    className="text-green-600 hover:text-green-800 p-1 rounded"
                    title="Gestionar unidades"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditProduct(product);
                    }}
                    className="text-blue-600 hover:text-blue-800 p-1 rounded"
                    title="Editar producto"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProduct(product.id);
                    }}
                    disabled={deleting === product.id}
                    className="text-red-600 hover:text-red-800 p-1 rounded disabled:opacity-50"
                    title="Eliminar producto"
                  >
                    {deleting === product.id ? (
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Producto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    SKU
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Precio
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unidad
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filtered.slice(0, 100).map(product => (
                  <tr key={product.id} className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-6 py-4 whitespace-nowrap">
            <div>
                        <div className="text-sm font-medium text-gray-900">{product.name}</div>
                        {product.barcode && (
                          <div className="text-sm text-gray-500">Código: {product.barcode}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {product.sku}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${
                        stockLoading ? 'text-gray-400' : 
                        getProductStock(product.id) > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {stockLoading ? 'Cargando...' : `${getProductStock(product.id)} ${product.unitBase}`}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                      {formatPrice(product.priceBase)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {product.unitBase}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        product.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {product.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleManageUnits(product);
                          }}
                          className="text-green-600 hover:text-green-800"
                          title="Gestionar unidades"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditProduct(product);
                          }}
                          className="text-blue-600 hover:text-blue-800"
                          title="Editar producto"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProduct(product.id);
                          }}
                          disabled={deleting === product.id}
                          className="text-red-600 hover:text-red-800 disabled:opacity-50"
                          title="Eliminar producto"
                        >
                          {deleting === product.id ? (
                            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
            </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Show more indicator */}
      {filtered.length > 100 && (
        <div className="text-center mt-6 p-4 bg-blue-50 rounded-lg">
          <p className="text-blue-700">
            Mostrando los primeros 100 productos de {filtered.length} encontrados.
            Usa la búsqueda para encontrar productos específicos.
          </p>
        </div>
      )}

      {/* Product Form Modal */}
      {showForm && (
        <ProductFormSimplified
          product={editingProduct}
          onCancel={handleCloseForm}
          onSave={handleSaveProduct}
        />
      )}

      {/* Units Manager Modal */}
      {showUnitsManager && selectedProductForUnits && (
        <ProductUnitsManager
          productId={selectedProductForUnits.id}
          productName={selectedProductForUnits.name}
          onClose={handleCloseUnitsManager}
        />
      )}

      
      {/* Toast Container */}
      <toast.ToastContainer />
    </div>
  );
}
