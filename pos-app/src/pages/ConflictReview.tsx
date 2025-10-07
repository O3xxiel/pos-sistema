// pos-app/src/pages/ConflictReview.tsx
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchWithAuth, API_URL } from '../data/api';
import { useAuth } from '../state/auth';
import { usePermissions } from '../hooks/usePermissions';
import ConflictReviewModal from '../components/sales/ConflictReviewModal';

interface ConflictSale {
  id: number;
  uuid: string;
  folio: string;
  status: 'REVIEW_REQUIRED';
  customerId: number;
  customer: {
    id: number;
    name: string;
    code: string;
  };
  seller: {
    id: number;
    fullName: string;
    username: string;
  };
  warehouse: {
    id: number;
    name: string;
  };
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  items: Array<{
    id: number;
    productId: number;
    product: {
      id: number;
      name: string;
      sku: string;
    };
    unitCode: string;
    qty: number;
    qtyBase: number;
    priceUnit: number;
    discount: number;
    lineTotal: number;
    availableStock?: number;
    requiredStock?: number;
    stockShortage?: number;
  }>;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  lastError?: string;
  retryCount: number;
}

interface ConflictReviewAction {
  action: 'EDIT_QUANTITIES' | 'CANCEL';
  saleId: number;
  items?: Array<{
    id: number;
    newQty?: number;
    newQtyBase?: number;
  }>;
  notes?: string;
}

export default function ConflictReviewPage() {
  const { user } = useAuth();
  const permissions = usePermissions();
  const queryClient = useQueryClient();
  const [selectedSale, setSelectedSale] = useState<ConflictSale | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Verificar permisos de administrador
  if (!permissions.isAdmin()) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="text-center py-12">
          <svg className="mx-auto w-12 h-12 text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Acceso Denegado</h2>
          <p className="text-gray-600">Solo los administradores pueden acceder a esta página.</p>
        </div>
      </div>
    );
  }

  // Query para obtener ventas en conflicto
  const { data: conflictSales, isLoading, error, refetch } = useQuery({
    queryKey: ['conflictSales'],
    queryFn: async () => {
      // Primero probar el endpoint de test
      try {
        console.log('🧪 Testing conflicts endpoint...');
        const testResponse = await fetchWithAuth(`${API_URL}/sales/conflicts/test`);
        console.log('✅ Test endpoint response:', testResponse);
      } catch (testError) {
        console.error('❌ Test endpoint error:', testError);
      }
      
      const response = await fetchWithAuth(`${API_URL}/sales/conflicts`);
      return response as ConflictSale[];
    },
    refetchInterval: 30000, // Refrescar cada 30 segundos
  });

  // Mutation para resolver conflictos
  const resolveConflictMutation = useMutation({
    mutationFn: async (action: ConflictReviewAction) => {
      const response = await fetchWithAuth(`${API_URL}/sales/conflicts/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(action),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conflictSales'] });
      setShowModal(false);
      setSelectedSale(null);
    },
  });

  const handleReviewSale = (sale: ConflictSale) => {
    setSelectedSale(sale);
    setShowModal(true);
  };

  const handleResolveConflict = (action: ConflictReviewAction) => {
    resolveConflictMutation.mutate(action);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-GT', {
      style: 'currency',
      currency: 'GTQ'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-GT', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="text-center py-12">
          <svg className="mx-auto w-12 h-12 text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error al Cargar</h2>
          <p className="text-gray-600 mb-4">No se pudieron cargar las ventas en conflicto.</p>
          <button
            onClick={() => refetch()}
            className="btn-primary"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Revisión de Conflictos de Ventas
          </h1>
          <p className="text-gray-600 mt-1">
            Resolver ventas que requieren revisión administrativa
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            onClick={() => refetch()}
            className="btn-secondary"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualizar
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Ventas en Conflicto</p>
              <p className="text-2xl font-bold text-gray-900">
                {conflictSales?.length || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Reintentos Promedio</p>
              <p className="text-2xl font-bold text-gray-900">
                {conflictSales?.length ? 
                  Math.round(conflictSales.reduce((sum, sale) => sum + sale.retryCount, 0) / conflictSales.length) : 0
                }
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Valor Total</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(conflictSales?.reduce((sum, sale) => sum + sale.grandTotal, 0) || 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Conflict Sales List */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Ventas Requiriendo Revisión ({conflictSales?.length || 0})
          </h3>
        </div>
        
        {conflictSales?.length === 0 ? (
          <div className="p-6 text-center">
            <svg className="mx-auto w-12 h-12 text-green-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">¡Excelente!</h3>
            <p className="text-gray-600">No hay ventas requiriendo revisión en este momento.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {conflictSales?.map((sale) => (
              <div key={sale.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="text-lg font-medium text-gray-900">
                        Venta #{sale.folio}
                      </h4>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Requiere Revisión
                      </span>
                      {sale.retryCount > 0 && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          {sale.retryCount} reintentos
                        </span>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-600">Cliente</p>
                        <p className="font-medium text-gray-900">{sale.customer?.name || 'N/A'}</p>
                        <p className="text-sm text-gray-500">{sale.customer?.code || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Vendedor</p>
                        <p className="font-medium text-gray-900">{sale.seller?.fullName || 'N/A'}</p>
                        <p className="text-sm text-gray-500">@{sale.seller?.username || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Fecha</p>
                        <p className="font-medium text-gray-900">{formatDate(sale.createdAt)}</p>
                        <p className="text-sm text-gray-500">{sale.warehouse?.name || 'N/A'}</p>
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="text-sm text-gray-600 mb-2">Productos ({sale.items.length})</p>
                      <div className="space-y-2">
                        {sale.items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{item.product?.name || 'Producto N/A'}</p>
                              <p className="text-sm text-gray-500">
                                {item.qty} {item.unitCode} • {formatCurrency(item.priceUnit)} c/u
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-gray-900">{formatCurrency(item.lineTotal)}</p>
                              {item.stockShortage && item.stockShortage > 0 && (
                                <p className="text-sm text-red-600">
                                  Faltan {item.stockShortage} {item.unitCode}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {sale.lastError && (
                      <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-800">
                          <strong>Error:</strong> {sale.lastError}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="text-lg font-semibold text-gray-900">
                        Total: {formatCurrency(sale.grandTotal)}
                      </div>
                      <button
                        onClick={() => handleReviewSale(sale)}
                        className="btn-primary"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Revisar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && selectedSale && (
        <ConflictReviewModal
          sale={selectedSale}
          onClose={() => {
            setShowModal(false);
            setSelectedSale(null);
          }}
          onResolve={handleResolveConflict}
          isLoading={resolveConflictMutation.isPending}
        />
      )}
    </div>
  );
}
