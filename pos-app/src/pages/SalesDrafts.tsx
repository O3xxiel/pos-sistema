// pos-app/src/pages/SalesDrafts.tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSales } from '../state/sales';

export default function SalesDraftsPage() {
  const { drafts, loading, loadDrafts, deleteSale, refreshDrafts } = useSales();
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]); // Incluir loadDrafts en las dependencias

  // Recargar borradores cuando se regresa a esta página (con debounce para evitar llamadas duplicadas)
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const handleFocus = () => {
      console.log('🔄 SalesDrafts - Página enfocada, programando recarga...');
      // Debounce para evitar múltiples llamadas rápidas
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        console.log('🔄 SalesDrafts - Ejecutando recarga de borradores...');
        refreshDrafts();
      }, 500); // Esperar 500ms antes de recargar
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      clearTimeout(timeoutId);
    };
  }, [refreshDrafts]);

  const handleDeleteSale = async (saleId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este borrador? Esta acción no se puede deshacer.')) {
      return;
    }

    setDeleting(saleId);
    try {
      await deleteSale(saleId);
      
      // Mostrar notificación de éxito
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 fade-in';
      notification.textContent = '✓ Borrador eliminado exitosamente';
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 3000);
      
    } catch (error) {
      console.error('Error deleting sale:', error);
      
      // Mostrar notificación de error
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 fade-in';
      notification.textContent = '✗ Error al eliminar el borrador';
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 5000);
    } finally {
      setDeleting(null);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-GT', {
      style: 'currency',
      currency: 'GTQ'
    }).format(price);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('es-ES', {
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
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
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
          <h1 className="text-2xl font-bold text-gray-900">Mis Borradores de Ventas</h1>
          <p className="text-gray-600 mt-1">
            {drafts.length} borradores guardados
          </p>
        </div>
        
        <Link to="/sales/new" className="btn-primary mt-4 sm:mt-0">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Nueva Venta
        </Link>
      </div>

      {/* Drafts List */}
      {drafts.length === 0 ? (
        <div className="text-center py-12">
          <svg className="mx-auto w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-500 text-lg">No hay borradores guardados</p>
          <p className="text-gray-400 mt-1">Crea una nueva venta para comenzar</p>
          <Link to="/sales/new" className="btn-primary mt-4">
            Crear Primera Venta
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {drafts.map((draft) => (
            <div key={draft.id} className="card hover:shadow-md transition-shadow duration-200">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {draft.customerName || 'Sin cliente'}
                    </h3>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      BORRADOR
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                    <div>
                      <span className="font-medium">ID:</span> {draft.id.slice(0, 8)}...
                    </div>
                    <div>
                      <span className="font-medium">Items:</span> {draft.items.length}
                    </div>
                    <div>
                      <span className="font-medium">Total:</span> 
                      <span className="font-semibold text-green-600 ml-1">
                        {formatPrice(draft.grandTotal)}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Actualizado:</span> {formatDate(draft.updatedAt)}
                    </div>
                  </div>

                  {draft.customerName && (
                    <div className="text-sm text-gray-600 mb-2">
                      <span className="font-medium">Cliente:</span> {draft.customerName} (#{draft.customerCode})
                    </div>
                  )}

                  {draft.notes && (
                    <div className="text-sm text-gray-600 bg-gray-50 rounded p-2 mb-2">
                      <span className="font-medium">Notas:</span> {draft.notes}
                    </div>
                  )}

                  {/* Items Preview */}
                  {draft.items.length > 0 && (
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Productos:</span>
                      <div className="mt-1 space-y-1">
                        {draft.items.slice(0, 3).map((item) => (
                          <div key={item.id} className="flex justify-between">
                            <span>{item.productName} ({item.qty} {item.unitCode})</span>
                            <span className="font-medium">{formatPrice(item.lineTotal)}</span>
                          </div>
                        ))}
                        {draft.items.length > 3 && (
                          <div className="text-gray-500 italic">
                            ... y {draft.items.length - 3} productos más
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2 ml-4">
                  <Link
                    to={`/sales/new?id=${draft.id}`}
                    className="btn-outline text-sm"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Editar
                  </Link>
                  
                  <button
                    onClick={() => handleDeleteSale(draft.id)}
                    disabled={deleting === draft.id || loading}
                    className={`p-2 rounded-lg transition-colors ${
                      deleting === draft.id || loading
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'text-red-600 hover:text-red-800 hover:bg-red-50'
                    }`}
                    title={deleting === draft.id ? 'Eliminando...' : 'Eliminar borrador'}
                  >
                    {deleting === draft.id ? (
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
      )}
    </div>
  );
}


