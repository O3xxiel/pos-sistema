// pos-app/src/pages/OfflineSales.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SyncService } from '../data/sync';
import { useNetwork } from '../shared/useNetwork';
import { useAuth } from '../state/auth';
import Receipt from '../components/Receipt';
import notificationManager from '../utils/notifications';
import type { OfflineSaleRow } from '../offline/db';

export default function OfflineSalesPage() {
  const navigate = useNavigate();
  const { online, isSyncing, syncNow } = useNetwork();
  const { user } = useAuth();
  const [offlineSales, setOfflineSales] = useState<OfflineSaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReceipt, setShowReceipt] = useState(false);
  const [selectedSale, setSelectedSale] = useState<OfflineSaleRow | null>(null);

  useEffect(() => {
    loadOfflineSales();
    
    // Verificar cambios en el servidor cada 15 segundos para detectar cambios de admin
    const interval = setInterval(async () => {
      try {
        const result = await SyncService.checkOfflineSalesStatus();
        if (result.updated > 0 || result.removed > 0) {
          console.log('🔄 Cambios detectados en ventas offline, recargando...');
          await loadOfflineSales();
        }
      } catch (error) {
        console.error('Error verificando estado de ventas offline:', error);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const loadOfflineSales = async () => {
    try {
      setLoading(true);
      const pending = await SyncService.getOfflineSalesByStatus('PENDING_SYNC');
      const reviewRequired = await SyncService.getOfflineSalesByStatus('REVIEW_REQUIRED');
      const confirmed = await SyncService.getOfflineSalesByStatus('CONFIRMED');
      
      setOfflineSales([...pending, ...reviewRequired, ...confirmed]);
    } catch (error) {
      console.error('Error loading offline sales:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      const result = await syncNow();
      if (result) {
        // Verificar estado de ventas que estaban en revisión (igual que automática)
        const statusCheck = await SyncService.checkOfflineSalesStatus();
        
        // Recargar la lista después de sincronizar
        await loadOfflineSales();
        
        // Mostrar notificación con información completa
        const message = `${result.synced} confirmadas, ${result.reviewRequired} requieren revisión${
          statusCheck.updated > 0 ? `, ${statusCheck.updated} actualizadas` : ''
        }${statusCheck.removed > 0 ? `, ${statusCheck.removed} resueltas` : ''}`;
        
        notificationManager.show({
          type: 'success',
          title: '✓ Sincronización completada',
          message: message,
          duration: 4000
        });
      }
    } catch (error: any) {
      notificationManager.show({
        type: 'error',
        title: '✗ Error',
        message: error.message || 'No se pudo sincronizar',
        duration: 5000
      });
    }
  };

  const handleRetry = async (saleId: string) => {
    try {
      const result = await SyncService.retrySync(saleId);
      await loadOfflineSales();
      
      notificationManager.show({
        type: 'success',
        title: '✓ Reintento completado',
        message: `${result.synced} confirmadas, ${result.reviewRequired} requieren revisión`,
        duration: 4000
      });
    } catch (error: any) {
      notificationManager.show({
        type: 'error',
        title: '✗ Error',
        message: error.message || 'No se pudo reintentar',
        duration: 5000
      });
    }
  };

  const handleForceCheck = async () => {
    try {
      const result = await SyncService.forceStatusCheck();
      await loadOfflineSales();
      
      notificationManager.show({
        type: 'info',
        title: '✓ Verificación completada',
        message: `${result.updated} actualizadas, ${result.removed} eliminadas`,
        duration: 4000
      });
    } catch (error: any) {
      notificationManager.show({
        type: 'error',
        title: '✗ Error',
        message: error.message || 'No se pudo verificar estado',
        duration: 5000
      });
    }
  };

  const handleViewDetails = (saleId: string) => {
    const sale = offlineSales.find(s => s.id === saleId);
    if (!sale) return;

    // Crear modal con detalles de la venta
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-semibold">Detalles de Venta ${saleId.slice(-8)}</h3>
          <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        
        <div class="space-y-4">
          <div>
            <h4 class="font-medium text-gray-900">Información General</h4>
            <div class="mt-2 space-y-1 text-sm">
              <div><span class="font-medium">Cliente:</span> ${sale.customerName}</div>
              <div><span class="font-medium">Total:</span> $${sale.grandTotal.toFixed(2)}</div>
              <div><span class="font-medium">Estado:</span> <span class="px-2 py-1 text-xs rounded-full ${getStatusColor(sale.status, sale.lastError)}">${getStatusText(sale.status, sale.lastError)}</span></div>
              <div><span class="font-medium">Fecha:</span> ${formatDate(sale.createdAt)}</div>
              ${sale.lastError ? `<div><span class="font-medium">Error:</span> <span class="text-red-600">${getErrorMessage(sale.lastError)}</span></div>` : ''}
            </div>
          </div>
          
          <div>
            <h4 class="font-medium text-gray-900">Productos</h4>
            <div class="mt-2 space-y-2">
              ${sale.items.map(item => `
                <div class="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <div>
                    <div class="font-medium">${item.productName}</div>
                    <div class="text-sm text-gray-600">SKU: ${item.productSku}</div>
                  </div>
                  <div class="text-right">
                    <div>${item.qty} ${item.unitCode}</div>
                    <div class="text-sm text-gray-600">$${item.priceUnit.toFixed(2)} c/u</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  };

  const handleShowReceipt = (sale: OfflineSaleRow) => {
    setSelectedSale(sale);
    setShowReceipt(true);
  };

  const getStatusColor = (status: string, lastError?: string) => {
    switch (status) {
      case 'PENDING_SYNC':
        return 'bg-yellow-100 text-yellow-800';
      case 'CONFIRMED':
        return 'bg-green-100 text-green-800';
      case 'REVIEW_REQUIRED':
        if (lastError) {
          if (lastError.includes('Stock insuficiente') || lastError.includes('stock')) {
            return 'bg-orange-100 text-orange-800'; // Naranja para stock
          } else if (lastError.includes('Venta duplicada')) {
            return 'bg-blue-100 text-blue-800'; // Azul para duplicados
          } else if (lastError.includes('Datos inválidos')) {
            return 'bg-purple-100 text-purple-800'; // Púrpura para datos inválidos
          } else if (lastError.includes('Recurso no encontrado') || lastError.includes('Referencia inválida') || lastError.includes('Registro no encontrado')) {
            return 'bg-indigo-100 text-indigo-800'; // Índigo para recursos no encontrados
          } else if (lastError.includes('Error de base de datos')) {
            return 'bg-red-100 text-red-800'; // Rojo para errores de sistema
          } else if (lastError.includes('Tiempo de espera agotado')) {
            return 'bg-yellow-100 text-yellow-800'; // Amarillo para timeout
          } else if (lastError.includes('Error de conexión')) {
            return 'bg-gray-100 text-gray-800'; // Gris para problemas de conexión
          } else if (lastError.includes('No autorizado')) {
            return 'bg-red-100 text-red-800'; // Rojo para problemas de autorización
          } else if (lastError.includes('Error del sistema') || lastError.includes('Error técnico')) {
            return 'bg-red-100 text-red-800'; // Rojo para errores técnicos
          }
        }
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string, lastError?: string) => {
    switch (status) {
      case 'PENDING_SYNC':
        return 'Pendiente de sincronización';
      case 'CONFIRMED':
        return 'Confirmada';
      case 'REVIEW_REQUIRED':
        if (lastError) {
          if (lastError.includes('Stock insuficiente') || lastError.includes('stock')) {
            return 'Sin stock disponible';
          } else if (lastError.includes('Venta duplicada')) {
            return 'Ya procesada';
          } else if (lastError.includes('Datos inválidos')) {
            return 'Datos incorrectos';
          } else if (lastError.includes('Recurso no encontrado') || lastError.includes('Referencia inválida') || lastError.includes('Registro no encontrado')) {
            return 'Cliente/Producto no encontrado';
          } else if (lastError.includes('Error de base de datos')) {
            return 'Error de sistema';
          } else if (lastError.includes('Tiempo de espera agotado')) {
            return 'Timeout';
          } else if (lastError.includes('Error de conexión')) {
            return 'Sin conexión';
          } else if (lastError.includes('No autorizado')) {
            return 'Sin permisos';
          } else if (lastError.includes('Error del sistema') || lastError.includes('Error técnico')) {
            return 'Error técnico';
          }
        }
        return 'Requiere revisión';
      default:
        return 'Desconocido';
    }
  };

  const getSyncStatusInfo = (sale: OfflineSaleRow) => {
    if (sale.status === 'CONFIRMED') {
      return {
        text: '✓ Sincronizada',
        color: 'text-green-600',
        icon: '✓'
      };
    } else if (sale.status === 'PENDING_SYNC') {
      return {
        text: '⏳ Pendiente',
        color: 'text-yellow-600',
        icon: '⏳'
      };
    } else if (sale.status === 'REVIEW_REQUIRED') {
      if (sale.lastError?.includes('Venta duplicada')) {
        return {
          text: '✓ Ya procesada',
          color: 'text-green-600',
          icon: '✓'
        };
      } else {
        return {
          text: '⚠️ Requiere revisión',
          color: 'text-red-600',
          icon: '⚠️'
        };
      }
    }
    return {
      text: '❓ Desconocido',
      color: 'text-gray-600',
      icon: '❓'
    };
  };

  const getErrorMessage = (error: string) => {
    if (error.includes('Stock insuficiente') || error.includes('stock')) {
      return 'No hay suficiente stock disponible para completar la venta. Revisa el inventario.';
    } else if (error.includes('Venta duplicada')) {
      return 'Esta venta ya fue procesada anteriormente. No se requiere acción.';
    } else if (error.includes('Datos inválidos')) {
      return 'Los datos de la venta contienen información incorrecta. Revisa los productos y cantidades.';
    } else if (error.includes('Recurso no encontrado') || error.includes('Referencia inválida') || error.includes('Registro no encontrado')) {
      return 'No se encontró el cliente, producto o almacén especificado. Verifica que existan en el sistema.';
    } else if (error.includes('Error de base de datos')) {
      return 'Error interno del sistema. Contacta al administrador.';
    } else if (error.includes('Tiempo de espera agotado')) {
      return 'La operación tardó demasiado tiempo. Intenta sincronizar nuevamente.';
    } else if (error.includes('Error de conexión')) {
      return 'No se pudo conectar con el servidor. Verifica tu conexión a internet.';
    } else if (error.includes('No autorizado')) {
      return 'No tienes permisos para realizar esta acción. Contacta al administrador.';
    } else if (error.includes('Error del sistema')) {
      return `Error técnico del sistema. Detalles: ${error}`;
    } else if (error.includes('Error técnico')) {
      return `Error técnico. Detalles: ${error}`;
    }
    return `Error no identificado: ${error}`; // Mostrar el error original si no coincide con ningún patrón
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Ventas Offline</h1>
          <p className="text-gray-600 mt-1">
            Gestiona las ventas realizadas sin conexión a internet
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${online ? 'bg-green-500' : 'bg-gray-400'}`} />
            <span className={`text-sm font-medium ${online ? 'text-green-700' : 'text-gray-500'}`}>
              {online ? 'Conectado' : 'Sin conexión'}
            </span>
          </div>
          
          {online && (
            <div className="flex items-center space-x-2">
              <button
                onClick={handleForceCheck}
                className="btn-secondary flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Verificar Estado</span>
              </button>
              
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="btn-primary flex items-center space-x-2"
              >
                {isSyncing ? (
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
                    <span>Sincronizar Todo</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-yellow-600">
            {offlineSales.filter(s => s.status === 'PENDING_SYNC').length}
          </div>
          <div className="text-sm text-gray-600">Pendientes</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-green-600">
            {offlineSales.filter(s => s.status === 'CONFIRMED').length}
          </div>
          <div className="text-sm text-gray-600">Confirmadas</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-red-600">
            {offlineSales.filter(s => s.status === 'REVIEW_REQUIRED').length}
          </div>
          <div className="text-sm text-gray-600">Requieren Revisión</div>
        </div>
      </div>

      {/* Sales List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {offlineSales.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay ventas offline</h3>
            <p className="mt-1 text-sm text-gray-500">Las ventas realizadas sin conexión aparecerán aquí.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Folio
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {offlineSales.map((sale) => (
                  <tr key={sale.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      {sale.status === 'CONFIRMED' ? sale.id : `OFF-${sale.id.slice(-8)}`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {sale.customerName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${sale.grandTotal.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(sale.status, sale.lastError)}`}>
                        {getStatusText(sale.status, sale.lastError)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(sale.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleShowReceipt(sale)}
                          className="text-purple-600 hover:text-purple-900 font-medium mr-2"
                        >
                          Comprobante
                        </button>
                        {sale.status === 'REVIEW_REQUIRED' && online && (
                          <>
                            <button
                              onClick={() => handleRetry(sale.id)}
                              className="text-blue-600 hover:text-blue-900 font-medium mr-2"
                            >
                              Reintentar
                            </button>
                            <button
                              onClick={() => handleViewDetails(sale.id)}
                              className="text-gray-600 hover:text-gray-900 font-medium"
                            >
                              Ver detalles
                            </button>
                          </>
                        )}
                        {(() => {
                          const syncInfo = getSyncStatusInfo(sale);
                          return (
                            <span className={`text-xs ${syncInfo.color}`}>
                              {syncInfo.text}
                            </span>
                          );
                        })()}
                      </div>
                      {sale.lastError && (
                        <div className="text-xs text-red-600 mt-1 max-w-xs truncate" title={sale.lastError}>
                          {sale.lastError}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Back Button */}
      <div className="mt-6">
        <button
          onClick={() => navigate('/')}
          className="btn-secondary"
        >
          ← Volver al inicio
        </button>
      </div>

      {/* Receipt Modal */}
      {showReceipt && selectedSale && (
        <Receipt
          sale={selectedSale}
          isOffline={selectedSale.status === 'PENDING_SYNC'}
          folio={selectedSale.status === 'CONFIRMED' ? selectedSale.id : undefined}
          sellerName={user?.username || 'Vendedor'}
          onClose={() => setShowReceipt(false)}
        />
      )}
    </div>
  );
}


