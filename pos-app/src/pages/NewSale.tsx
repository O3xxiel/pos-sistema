// pos-app/src/pages/NewSale.tsx
import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSales } from '../state/sales';
import { useNetwork } from '../shared/useNetwork';
import { SyncService } from '../data/sync';
import { syncProducts } from '../data/catalog';
import { db } from '../offline/db';
import CustomerSelector from '../components/sales/CustomerSelector';
import ProductSearch, { type ProductSearchRef } from '../components/sales/ProductSearch';
import SaleItemsManager from '../components/sales/SaleItemsManager';
import SaleTotals from '../components/sales/SaleTotals';
import type { CustomerForSale, ProductForSale, UnitCode } from '../types/sales';

export default function NewSalePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const saleId = searchParams.get('id');
  const { online } = useNetwork();
  
  const {
    currentSale,
    loading,
    createNewSale,
    loadSale,
    saveSale,
    setCustomer,
    addProduct,
    updateItem,
    removeItem,
    updateSale,
    clearCurrentSale,
    confirmSale,
  } = useSales();

  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  
  // Ref para el componente ProductSearch
  const productSearchRef = useRef<ProductSearchRef>(null);

  // Auto-save deshabilitado temporalmente para evitar interferencias
  // useEffect(() => {
  //   if (currentSale && currentSale.items.length > 0 && !isSearching) {
  //     const timeoutId = setTimeout(async () => {
  //       await handleSave(false); // Auto-save silencioso
  //     }, 15000); // Auto-save después de 15 segundos de inactividad
  //
  //     return () => clearTimeout(timeoutId);
  //   }
  // }, [currentSale?.items.length, currentSale?.customerId, isSearching]);

  // Manejar navegación pendiente
  useEffect(() => {
    if (pendingNavigation) {
      const timer = setTimeout(() => {
        navigate(pendingNavigation);
        setPendingNavigation(null);
      }, 100); // Pequeño delay para asegurar que el render se complete
      
      return () => clearTimeout(timer);
    }
  }, [pendingNavigation, navigate]);

  useEffect(() => {
    if (saleId) {
      // Cargar venta existente
      loadSale(saleId);
    } else {
      // Solo crear nueva venta si no hay una venta actual
      // Esto evita crear borradores duplicados cuando se regresa del dashboard
      if (!currentSale) {
        createNewSale();
      }
    }

    // Cleanup al desmontar
    return () => {
      // Limpiar navegación pendiente
      setPendingNavigation(null);
    };
  }, [saleId, createNewSale, currentSale, loadSale]); // Incluir todas las dependencias necesarias

  const handleSave = async (showNotification = true) => {
    if (!currentSale) return;

    setSaving(true);
    try {
      await saveSale();
      setLastSaved(new Date().toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }));
      
      if (showNotification) {
        // Mostrar notificación de guardado
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 fade-in';
        notification.textContent = '✓ Borrador guardado - Preparando nueva venta...';
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
        
        // Limpiar la venta después de guardar manualmente
        setTimeout(() => {
          clearCurrentSale();
          createNewSale();
          setLastSaved(null);
          // Resetear también el componente de búsqueda de productos
          productSearchRef.current?.reset();
        }, 1500); // Esperar un poco para que el usuario vea la notificación
      }
    } catch (error) {
      console.error('Error saving sale:', error);
      if (showNotification) {
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 fade-in';
        notification.textContent = '✗ Error al guardar';
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCustomerSelect = useCallback((customer: CustomerForSale) => {
    setCustomer(customer);
  }, [setCustomer]);

  const handleProductAdd = useCallback((product: ProductForSale, unitCode: UnitCode, qty: number) => {
    addProduct(product, unitCode, qty);
  }, [addProduct]);

  const handleNotesChange = (notes: string) => {
    updateSale({ notes });
  };

  const handleGoBack = () => {
    navigate('/');
  };

  const handleConfirmSale = async () => {
    if (!currentSale || !canSave) return;

    setConfirming(true);
    try {
      if (online) {
        // Modo online: confirmar directamente con el servidor
        console.log('Confirming sale online with ID:', currentSale.id);
        const confirmedSale = await confirmSale(currentSale.id);
        console.log('Sale confirmed successfully:', confirmedSale);
        
        // Preparar navegación inmediatamente
        const params = new URLSearchParams({
          folio: confirmedSale.folio || 'N/A',
          total: currentSale.grandTotal.toString(),
          customer: currentSale.customerName || 'Cliente General'
        });
        
        console.log('NewSale - Preparing navigation with params:', {
          folio: confirmedSale.folio,
          total: currentSale.grandTotal,
          customer: currentSale.customerName,
          urlParams: params.toString()
        });
        
        // Limpiar la venta actual después de confirmar exitosamente
        clearCurrentSale();
        
        // Navegar inmediatamente usando requestAnimationFrame para evitar errores de React
        requestAnimationFrame(() => {
          const navigationUrl = `/sales/success?${params.toString()}`;
          console.log('NewSale - Navigating to:', navigationUrl);
          setPendingNavigation(navigationUrl);
        });
      } else {
        // Modo offline: guardar como PENDING_SYNC
        console.log('Saving sale offline with ID:', currentSale.id);
        await SyncService.saveOfflineSale(currentSale);
        
        // Mostrar comprobante provisional
        const params = new URLSearchParams({
          folio: `OFF-${currentSale.id.slice(-8)}`, // Folio provisional
          total: currentSale.grandTotal.toString(),
          customer: currentSale.customerName || 'Cliente General',
          offline: 'true'
        });
        
        console.log('NewSale - Preparing offline navigation with params:', {
          folio: `OFF-${currentSale.id.slice(-8)}`,
          total: currentSale.grandTotal,
          customer: currentSale.customerName,
          urlParams: params.toString()
        });
        
        // Limpiar la venta actual después de guardar offline
        clearCurrentSale();
        
        // Navegar a página de éxito con indicador offline
        requestAnimationFrame(() => {
          const navigationUrl = `/sales/success?${params.toString()}`;
          console.log('NewSale - Navigating to:', navigationUrl);
          setPendingNavigation(navigationUrl);
        });
      }
      
    } catch (error: any) {
      console.error('Error confirming sale:', error);
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 fade-in';
      notification.textContent = `✗ Error: ${error.message || 'No se pudo confirmar la venta'}`;
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 5000);
    } finally {
      setConfirming(false);
    }
  };

  // Función para forzar sincronización completa
  const handleForceSync = async () => {
    if (!confirm('¿Estás seguro de que deseas forzar una sincronización completa? Esto limpiará todos los datos locales y los volverá a descargar del servidor.')) {
      return;
    }

    try {
      setSyncing(true);
      console.log('🔄 Iniciando sincronización forzada desde ventas...');
      
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
      
      // Mostrar notificación de éxito
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 fade-in';
      notification.textContent = `✅ Sincronización forzada completada. ${result.saved} productos actualizados.`;
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 4000);
      
    } catch (error) {
      console.error('❌ Error en sincronización forzada:', error);
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 fade-in';
      notification.textContent = `❌ Error en sincronización: ${error instanceof Error ? error.message : 'Error desconocido'}`;
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 5000);
    } finally {
      setSyncing(false);
    }
  };

  const canSave = currentSale && currentSale.customerId > 0 && currentSale.items.length > 0;

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-48 bg-gray-200 rounded"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentSale) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="text-center py-12">
          <svg className="mx-auto w-12 h-12 text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-gray-500 text-lg">Error al cargar la venta</p>
          <button onClick={handleGoBack} className="btn-primary mt-4">
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={handleGoBack}
            className="btn-outline p-2"
            title="Volver"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {saleId ? 'Editar Venta - Surtidora Katy' : 'Nueva Venta - Surtidora Katy'}
            </h1>
            <p className="text-gray-600">
              {saleId ? `Editando borrador ${saleId.slice(0, 8)}...` : 'Crear un nuevo borrador de venta'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 mt-4 sm:mt-0">
          {lastSaved && (
            <span className="text-sm text-gray-500">
              Guardado: {lastSaved}
            </span>
          )}
          
          <button
            onClick={() => handleSave(true)}
            disabled={!canSave || saving || confirming}
            className="btn-secondary"
          >
            {saving ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Guardando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Guardar Borrador
              </>
            )}
          </button>
          
          <button
            onClick={handleForceSync}
            disabled={syncing || saving || confirming}
            className={`px-4 py-2 rounded-lg text-sm font-medium shadow-md transition-all duration-200 flex items-center ${
              syncing
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700 text-white hover:shadow-lg'
            }`}
            title="Forzar sincronización completa (limpia todo y vuelve a descargar)"
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
            onClick={handleConfirmSale}
            disabled={!canSave || saving || confirming}
            className="btn-primary"
          >
            {confirming ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Confirmando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Confirmar Venta
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Customer and Product Selection */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Selection */}
          <div className="card">
            <CustomerSelector
              selectedCustomer={currentSale.customerId > 0 ? {
                id: currentSale.customerId,
                code: currentSale.customerCode,
                name: currentSale.customerName,
                nit: null,
                isActive: true,
              } : null}
              onCustomerSelect={handleCustomerSelect}
            />
          </div>

          {/* Product Search */}
          <div className="card">
            <ProductSearch ref={productSearchRef} onProductAdd={handleProductAdd} />
          </div>

          {/* Sale Items */}
          <SaleItemsManager
            items={currentSale.items}
            onUpdateItem={updateItem}
            onRemoveItem={removeItem}
          />
        </div>

        {/* Right Column - Totals and Summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-20">
            <SaleTotals
              sale={currentSale}
              onNotesChange={handleNotesChange}
            />
          </div>
        </div>
      </div>

      {/* Mobile Buttons */}
      <div className="lg:hidden fixed bottom-4 right-4 flex flex-col space-y-2">
        <button
          onClick={() => handleSave(true)}
          disabled={!canSave || saving || confirming}
          className="btn-secondary rounded-full w-14 h-14 shadow-lg"
          title="Guardar borrador"
        >
          {saving ? (
            <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          )}
        </button>
        
        <button
          onClick={handleConfirmSale}
          disabled={!canSave || saving || confirming}
          className="btn-primary rounded-full w-14 h-14 shadow-lg"
          title="Confirmar venta"
        >
          {confirming ? (
            <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
