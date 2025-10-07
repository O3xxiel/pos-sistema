// pos-app/src/pages/AdminOfflineSales.tsx
import { useState, useEffect } from 'react';
import { getAllOfflineSales } from '../data/api';
import { usePermissions } from '../hooks/usePermissions';

interface OfflineSale {
  id: number;
  uuid: string;
  folio: string | null;
  status: string;
  total: number;
  createdAt: string;
  syncedAt: string | null;
  lastError: string | null;
  retryCount: number;
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

interface StatusCounts {
  PENDING_SYNC: number;
  CONFIRMED: number;
  REVIEW_REQUIRED: number;
}

export default function AdminOfflineSales() {
  const [sales, setSales] = useState<OfflineSale[]>([]);
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({
    PENDING_SYNC: 0,
    CONFIRMED: 0,
    REVIEW_REQUIRED: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const permissions = usePermissions();

  // Verificar permisos
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

  useEffect(() => {
    loadSales();
  }, [filterStatus]);

  const loadSales = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllOfflineSales(filterStatus || undefined);
      setSales(data.sales);
      setStatusCounts(data.statusCounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar las ventas');
    } finally {
      setLoading(false);
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
          } else if (lastError.includes('Cliente/Producto no encontrado')) {
            return 'Cliente/Producto no encontrado';
          } else if (lastError.includes('Error de sistema')) {
            return 'Error de sistema';
          }
        }
        return 'Requiere revisión';
      default:
        return 'Desconocido';
    }
  };

  const getStatusColor = (status: string, lastError?: string) => {
    switch (status) {
      case 'PENDING_SYNC':
        return 'bg-yellow-100 text-yellow-800';
      case 'CONFIRMED':
        return 'bg-green-100 text-green-800';
      case 'REVIEW_REQUIRED':
        if (lastError?.includes('Stock insuficiente') || lastError?.includes('stock')) {
          return 'bg-red-100 text-red-800';
        } else if (lastError?.includes('Venta duplicada')) {
          return 'bg-orange-100 text-orange-800';
        }
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
            onClick={loadSales}
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
          Ventas Offline - Administración
        </h1>
        <p className="text-gray-600">
          Gestiona todas las ventas offline de todos los vendedores
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="card">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-yellow-100">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pendientes</p>
              <p className="text-2xl font-bold text-gray-900">{statusCounts.PENDING_SYNC}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Confirmadas</p>
              <p className="text-2xl font-bold text-gray-900">{statusCounts.CONFIRMED}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-red-100">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Requieren Revisión</p>
              <p className="text-2xl font-bold text-gray-900">{statusCounts.REVIEW_REQUIRED}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <div className="flex space-x-4">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos los estados</option>
            <option value="PENDING_SYNC">Pendientes</option>
            <option value="CONFIRMED">Confirmadas</option>
            <option value="REVIEW_REQUIRED">Requieren Revisión</option>
          </select>
          <button
            onClick={loadSales}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium"
          >
            Actualizar
          </button>
        </div>
      </div>

      {/* Sales List */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {sales.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay ventas offline</h3>
            <p className="mt-1 text-sm text-gray-500">
              No se encontraron ventas offline con los filtros seleccionados.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {sales.map((sale) => (
              <li key={sale.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(sale.status, sale.lastError)}`}>
                          {getStatusText(sale.status, sale.lastError)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {sale.folio ? `Folio: ${sale.folio}` : `UUID: ${sale.uuid.substring(0, 8)}...`}
                        </p>
                        <p className="text-sm text-gray-500">
                          Vendedor: {sale.seller?.fullName || sale.seller?.username} | 
                          Cliente: {sale.customer?.name || 'Sin cliente'} | 
                          {formatDate(sale.createdAt)}
                        </p>
                        <p className="text-sm text-gray-500">
                          Total: {formatCurrency(sale.total)} | 
                          Items: {sale.items.length} | 
                          Reintentos: {sale.retryCount}
                        </p>
                        {sale.lastError && (
                          <p className="text-xs text-red-600 mt-1">
                            Error: {sale.lastError}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(sale.total)}
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


