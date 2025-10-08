import { useEffect, useState } from 'react';
import { useNetwork } from '../shared/useNetwork';
import { getLastSyncTimes, syncCustomers, syncProducts } from '../data/catalog';
import { useAutoSync } from '../hooks/useAutoSync';

function fmt(ts: string | null) {
  if (!ts) return 'Nunca';
  const d = new Date(ts);
  return d.toLocaleString('es-ES', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

export default function SyncBar() {
  const { online, isSyncing, pendingSyncCount, syncNow } = useNetwork();
  const { isAutoSyncing } = useAutoSync();
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [last, setLast] = useState<{ products: string | null; customers: string | null }>({
    products: null, customers: null,
  });

  const refreshMeta = async () => setLast(await getLastSyncTimes());

  useEffect(() => { refreshMeta(); }, []);

  const forceInitialSync = async () => {
    try {
      setLoading(true);
      console.log('🔄 Forzando sincronización inicial...');
      
      // Sincronizar productos y clientes
      await Promise.all([
        syncProducts(),
        syncCustomers()
      ]);
      
      // Actualizar metadatos
      await refreshMeta();
      
      console.log('✅ Sincronización inicial completada');
      
      // Mostrar notificación de éxito
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 fade-in';
      notification.textContent = '✓ Sincronización inicial completada';
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 3000);
      
    } catch (e: any) {
      console.error('❌ Error en sincronización inicial:', e);
      
      // Mostrar notificación de error
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 fade-in';
      notification.textContent = `✗ Error: ${e.message || e}`;
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setLoading(true);
      await syncProducts();
      await syncCustomers();
      await refreshMeta();
      // Mostrar notificación de éxito más elegante
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 fade-in';
      notification.textContent = '✓ Sincronización completada';
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 3000);
    } catch (e: any) {
      // Mostrar notificación de error más elegante
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 fade-in';
      notification.textContent = `✗ Error: ${e.message || e}`;
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncSales = async () => {
    try {
      const result = await syncNow();
      if (result) {
        // Mostrar notificación diferente según el resultado
        if (result.reviewRequired > 0) {
          // Hay ventas que requieren revisión
          const notification = document.createElement('div');
          notification.className = 'fixed top-4 right-4 bg-orange-500 text-white px-6 py-4 rounded-lg shadow-lg z-50 fade-in';
          notification.innerHTML = `
            <div class="flex items-center">
              <svg class="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
              </svg>
              <div>
                <div class="font-semibold">⚠️ Sincronización con conflictos</div>
                <div class="text-sm">${result.synced} ventas confirmadas</div>
                <div class="text-sm">${result.reviewRequired} ventas requieren revisión por stock insuficiente</div>
              </div>
            </div>
          `;
          document.body.appendChild(notification);
          setTimeout(() => notification.remove(), 6000);
        } else {
          // Todas las ventas se confirmaron
          const notification = document.createElement('div');
          notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg z-50 fade-in';
          notification.innerHTML = `
            <div class="flex items-center">
              <svg class="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <div>
                <div class="font-semibold">✓ Sincronización exitosa</div>
                <div class="text-sm">${result.synced} ventas confirmadas</div>
                ${result.resolved > 0 ? `<div class="text-sm">${result.resolved} ventas resueltas por el admin</div>` : ''}
              </div>
            </div>
          `;
          document.body.appendChild(notification);
          setTimeout(() => notification.remove(), 4000);
        }
      }
    } catch (e: any) {
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-4 rounded-lg shadow-lg z-50 fade-in';
      notification.innerHTML = `
        <div class="flex items-center">
          <svg class="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div>
            <div class="font-semibold">✗ Error de sincronización</div>
            <div class="text-sm">${e.message || e}</div>
          </div>
        </div>
      `;
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 5000);
    }
  };

  const handleCheckStatus = async () => {
    try {
      const { SyncService } = await import('../data/sync');
      const result = await SyncService.checkOfflineSalesStatus();
      
      if (result.removed > 0 || result.updated > 0) {
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg z-50 fade-in';
        notification.innerHTML = `
          <div class="flex items-center">
            <svg class="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div>
              <div class="font-semibold">✅ Estado actualizado</div>
              <div class="text-sm">${result.removed} ventas resueltas por el admin</div>
              ${result.updated > 0 ? `<div class="text-sm">${result.updated} ventas actualizadas</div>` : ''}
            </div>
          </div>
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
      } else {
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-blue-500 text-white px-6 py-4 rounded-lg shadow-lg z-50 fade-in';
        notification.innerHTML = `
          <div class="flex items-center">
            <svg class="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div>
              <div class="font-semibold">ℹ️ Sin cambios</div>
              <div class="text-sm">No hay ventas resueltas por el administrador</div>
            </div>
          </div>
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
      }
    } catch (e: any) {
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-4 rounded-lg shadow-lg z-50 fade-in';
      notification.innerHTML = `
        <div class="flex items-center">
          <svg class="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div>
            <div class="font-semibold">✗ Error verificando estado</div>
            <div class="text-sm">${e.message || e}</div>
          </div>
        </div>
      `;
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 5000);
    }
  };

  return (
    <div className="w-full bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Estado de conexión */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${online ? 'bg-green-500' : 'bg-gray-400'} ${online ? 'animate-pulse' : ''}`} />
              <span className={`text-sm font-medium ${online ? 'text-green-700' : 'text-gray-500'}`}>
                {online ? 'Conectado' : 'Sin conexión'}
              </span>
              {isAutoSyncing && (
                <div className="flex items-center space-x-1 text-blue-600">
                  <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-xs">Auto-sync</span>
                </div>
              )}
            </div>
            
            {/* Contador de ventas pendientes */}
            {pendingSyncCount > 0 && (
              <div className="flex items-center space-x-3">
                <div className="bg-orange-100 text-orange-800 text-sm px-3 py-1 rounded-full font-medium">
                  {pendingSyncCount} venta{pendingSyncCount > 1 ? 's' : ''} pendiente{pendingSyncCount > 1 ? 's' : ''}
                </div>
              </div>
            )}
            
            {/* Botón para mostrar detalles */}
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              {showDetails ? 'Ocultar detalles' : 'Ver detalles'}
            </button>
          </div>

          {/* Botones de sincronización */}
          <div className="flex items-center space-x-2 sm:space-x-3 overflow-x-auto">
            {/* Botón para verificar estado de ventas */}
            <button
              onClick={handleCheckStatus}
              disabled={isSyncing || !online}
              className={`flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                isSyncing || !online
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md'
              }`}
              title={!online ? 'Requiere conexión a internet' : 'Verificar estado de ventas pendientes'}
            >
              <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="hidden sm:inline">Verificar</span>
            </button>
            
            {/* Botón de sincronización de ventas */}
            <button
              onClick={handleSyncSales}
              disabled={isSyncing || !online}
              className={`flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                isSyncing || !online
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white shadow-sm hover:shadow-md'
              }`}
              title={!online ? 'Requiere conexión a internet' : 'Sincronizar ventas offline con el servidor'}
            >
              {isSyncing ? (
                <>
                  <svg className="animate-spin w-3 h-3 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="hidden sm:inline">Sincronizando...</span>
                </>
              ) : (
                <>
                  <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="hidden sm:inline">Sincronizar Ventas</span>
                </>
              )}
            </button>

            {/* Botón de sincronización de catálogos */}
            <button
              onClick={handleSync}
              disabled={loading || !online}
              className={`flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                loading || !online
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md'
              }`}
              title={!online ? 'Requiere conexión a internet' : 'Sincronizar catálogos con el servidor'}
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-3 h-3 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="hidden sm:inline">Sincronizando...</span>
                </>
              ) : (
                <>
                  <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span className="hidden sm:inline">Sincronizar Catálogos</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Detalles de sincronización */}
        {showDetails && (
          <div className="border-t border-gray-100 py-3 slide-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs mb-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Productos:</span>
                <span className="font-medium text-gray-900">{fmt(last.products)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Clientes:</span>
                <span className="font-medium text-gray-900">{fmt(last.customers)}</span>
              </div>
            </div>
            
            {/* Botón de sincronización inicial si nunca se ha sincronizado */}
            {(!last.products && !last.customers) && (
              <div className="flex items-center justify-center pt-2 border-t border-gray-100">
                <button
                  onClick={forceInitialSync}
                  disabled={loading || !online}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    loading || !online
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-orange-600 hover:bg-orange-700 text-white shadow-sm hover:shadow-md'
                  }`}
                  title={!online ? 'Requiere conexión a internet' : 'Realizar sincronización inicial de catálogos'}
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Sincronizando...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>Sincronización Inicial</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
