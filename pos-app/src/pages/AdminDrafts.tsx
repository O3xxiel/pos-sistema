// pos-app/src/pages/AdminDrafts.tsx
import { useState, useEffect } from 'react';
import { getAllSalesDrafts } from '../data/api';
import { usePermissions } from '../hooks/usePermissions';

interface DraftSale {
  id: number;
  uuid: string | null;
  folio: string | null;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  createdAt: string;
  updatedAt: string;
  customer: {
    name: string;
    nit: string | null;
  } | null;
  seller: {
    username: string;
    fullName: string | null;
  } | null;
  items: Array<{
    id: number;
    quantity: number;
    unitPrice: number;
    total: number;
    product: {
      name: string;
      sku: string;
    };
  }>;
}

export default function AdminDrafts() {
  const [drafts, setDrafts] = useState<DraftSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const permissions = usePermissions();

  useEffect(() => {
    loadDrafts();
  }, []);

  // Verificar permisos después de los hooks
  if (!permissions.isAdmin()) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-red-800">Acceso Denegado</h2>
          <p className="text-red-600">Solo los administradores pueden ver esta página.</p>
        </div>
      </div>
    );
  }

  const loadDrafts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getAllSalesDrafts();
      setDrafts(response.sales);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar los borradores');
    } finally {
      setLoading(false);
    }
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-GT', {
      style: 'currency',
      currency: 'GTQ',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-red-800">Error</h2>
          <p className="text-red-600">{error}</p>
          <button
            onClick={loadDrafts}
            className="mt-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm"
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Todos los Borradores de Ventas
        </h1>
        <p className="text-gray-600">
          Gestiona todos los borradores de todos los vendedores
        </p>
      </div>

      {/* Stats Card */}
      <div className="mb-6">
        <div className="card">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total de Borradores</p>
              <p className="text-2xl font-bold text-gray-900">{drafts.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Drafts List */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {drafts.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay borradores</h3>
            <p className="mt-1 text-sm text-gray-500">
              No se encontraron borradores en el sistema.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {drafts.map((draft) => (
              <li key={draft.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Borrador
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {draft.folio ? `Folio: ${draft.folio}` : `ID: ${draft.id}`}
                        </p>
                        <p className="text-sm text-gray-500">
                          Vendedor: {draft.seller?.fullName || draft.seller?.username} | 
                          Cliente: {draft.customer?.name || 'Sin cliente'}
                        </p>
                        <p className="text-sm text-gray-500">
                          Creado: {formatDate(draft.createdAt)} | 
                          Actualizado: {formatDate(draft.updatedAt)}
                        </p>
                        <p className="text-sm text-gray-500">
                          Items: {draft.items.length} | 
                          Subtotal: {formatCurrency(draft.subtotal)} | 
                          Impuestos: {formatCurrency(draft.tax)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(draft.total)}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

