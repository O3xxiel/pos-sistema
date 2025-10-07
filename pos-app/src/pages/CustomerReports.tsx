import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCustomerSummary, getTopCustomers, getCustomerActivity } from '../data/api';
import { getCurrentDateGT, formatDisplayDate } from '../utils/dateUtils';

export default function CustomerReportsPage() {
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return firstDay.toISOString().split('T')[0];
  });
  
  const [endDate, setEndDate] = useState(getCurrentDateGT);

  // Query para resumen de clientes
  const { data: customerSummary, isLoading: summaryLoading } = useQuery({
    queryKey: ['customerSummary', startDate, endDate],
    queryFn: () => getCustomerSummary(startDate, endDate),
  });

  // Query para top clientes
  const { data: topCustomers, isLoading: topCustomersLoading } = useQuery({
    queryKey: ['topCustomers', startDate, endDate],
    queryFn: () => getTopCustomers(startDate, endDate, 10),
  });

  // Query para actividad de clientes
  const { data: customerActivity, isLoading: activityLoading } = useQuery({
    queryKey: ['customerActivity', startDate, endDate],
    queryFn: () => getCustomerActivity(startDate, endDate),
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-GT', {
      style: 'currency',
      currency: 'GTQ',
    }).format(amount);
  };

  const isLoading = summaryLoading || topCustomersLoading || activityLoading;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Reportes de Clientes</h1>
        <p className="text-gray-600">
          Análisis de clientes, compras frecuentes y actividad
        </p>
      </div>

      {/* Filtros de fecha */}
      <div className="mb-6 bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fecha de Inicio
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fecha de Fin
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Actualizar
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {/* Resumen de Clientes */}
          {customerSummary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-blue-100">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Clientes</p>
                    <p className="text-2xl font-bold text-gray-900">{customerSummary.summary.totalCustomers}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-green-100">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Con Compras</p>
                    <p className="text-2xl font-bold text-gray-900">{customerSummary.summary.customersWithSales}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-yellow-100">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Sin Compras</p>
                    <p className="text-2xl font-bold text-gray-900">{customerSummary.summary.customersWithoutSales}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-purple-100">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Ingresos Totales</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(customerSummary.summary.totalRevenue)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Top Clientes */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Top Clientes</h3>
                <p className="text-sm text-gray-600">Período: {formatDisplayDate(startDate)} - {formatDisplayDate(endDate)}</p>
              </div>
              <div className="p-6">
                {topCustomers && topCustomers.length > 0 ? (
                  <div className="space-y-4">
                    {topCustomers.map((customer: any, index: number) => (
                      <div key={customer.customerId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                            <span className="text-sm font-bold text-blue-600">#{index + 1}</span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{customer.customerName}</p>
                            <p className="text-sm text-gray-500">Código: {customer.code}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">{customer.totalPurchases} compras</p>
                          <p className="text-sm text-gray-500">{formatCurrency(customer.totalSpent)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No hay datos</h3>
                    <p className="mt-1 text-sm text-gray-500">No se encontraron clientes con compras en este período.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Actividad de Clientes */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Actividad de Clientes</h3>
                <p className="text-sm text-gray-600">Período: {formatDisplayDate(startDate)} - {formatDisplayDate(endDate)}</p>
              </div>
              <div className="p-6">
                {customerActivity && customerActivity.length > 0 ? (
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {customerActivity.slice(0, 10).map((customer: any, index: number) => (
                      <div key={customer.customerId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                            <span className="text-sm font-bold text-green-600">$</span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{customer.customerName}</p>
                            <p className="text-sm text-gray-500">Código: {customer.code}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">{customer.totalPurchases} compras</p>
                          <p className="text-sm text-gray-500">{formatCurrency(customer.totalSpent)}</p>
                          {customer.lastPurchase && (
                            <p className="text-xs text-gray-400">
                              Última: {new Date(customer.lastPurchase).toLocaleDateString('es-GT')}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No hay datos</h3>
                    <p className="mt-1 text-sm text-gray-500">No se encontró actividad de clientes en este período.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Estadísticas Adicionales */}
          {customerSummary && (
            <div className="mt-8 bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Estadísticas Adicionales</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-2">
                    {customerSummary.summary.customersWithSales > 0 
                      ? Math.round((customerSummary.summary.customersWithSales / customerSummary.summary.totalCustomers) * 100)
                      : 0}%
                  </div>
                  <p className="text-sm text-gray-600">Clientes Activos</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600 mb-2">
                    {formatCurrency(customerSummary.summary.averageRevenuePerCustomer)}
                  </div>
                  <p className="text-sm text-gray-600">Promedio por Cliente</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600 mb-2">
                    {customerSummary.summary.customersWithSales > 0 
                      ? Math.round(customerSummary.summary.totalRevenue / customerSummary.summary.customersWithSales)
                      : 0}
                  </div>
                  <p className="text-sm text-gray-600">Valor Promedio de Compra</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

