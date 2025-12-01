import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDailyReport, getReportSellers } from '../data/api';
import { useAuth } from '../state/auth';
import { usePermissions } from '../hooks/usePermissions';
import { SyncService } from '../data/sync';
import { getCurrentDateGT, formatDisplayDate } from '../utils/dateUtils';
import { usePdfGenerator } from '../hooks/usePdfGenerator';

import type { OfflineSaleItem as DBOfflineSaleItem } from '../offline/db';

interface SaleItem {
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface PendingSaleItem extends SaleItem {
}

interface OfflineSaleUI {
  id: string;
  customerName: string;
  status: string;
  createdAt: string;
  grandTotal: number;
  items: DBOfflineSaleItem[];
}

interface Sale {
  id: number;
  folio: string;
  customerName: string;
  customerCode: string;
  total: number;
  confirmedAt: string;
  items: SaleItem[];
}

interface PendingSale {
  id: number;
  uuid: string;
  customerName: string;
  total: number;
  createdAt: string;
  items: PendingSaleItem[];
}

interface PendingSales {
  count: number;
  totalAmount: number;
  sales: PendingSale[];
}

interface Product {
  productId: number;
  productName: string;
  productSku: string;
  quantity: number;
  amount: number;
  sales: number;
}

interface PeakHour {
  hour: number;
  amount: number;
}

interface HourlySummary {
  hour: number;
  amount: number;
  sales: number;
}

interface Summary {
  totalSales: number;
  totalAmount: number;
  totalQuantity: number;
  averageTicket: number;
  pendingSync: number;
}

interface Seller {
  id: number;
  username: string;
  fullName: string;
  role: string;
  roleCode: string;
}

interface DailyReportData {
  date: string;
  seller: {
    id: number;
    username: string;
    fullName: string;
  };
  summary: Summary;
  topProducts: Product[];
  peakHours: PeakHour[];
  hourlySummary: HourlySummary[];
  pendingSales: PendingSales;
  dailySales: Sale[];
}

export default function DailyReportPage() {
  const { user } = useAuth();
  const permissions = usePermissions();
  const [selectedDate, setSelectedDate] = useState(getCurrentDateGT);
  const [selectedSellerId, setSelectedSellerId] = useState<string>('me');
  const [offlinePendingSales, setOfflinePendingSales] = useState<OfflineSaleUI[]>([]);
  const [offlinePendingCount, setOfflinePendingCount] = useState(0);
  const [isGeneratingProductsPdf, setIsGeneratingProductsPdf] = useState(false);
  const [isGeneratingSalesPdf, setIsGeneratingSalesPdf] = useState(false);
  const { generateProductsPdf, generateSalesPdf } = usePdfGenerator();

  // Query para obtener la lista de vendedores
  const { data: sellersData } = useQuery<{ sellers: Seller[] }>({
    queryKey: ['reportSellers'],
    queryFn: getReportSellers,
    enabled: !!user,
  });

  // Los vendedores siempre usan "me", los admins pueden cambiar
  useEffect(() => {
    if (permissions.canViewOwnReports()) {
      // Vendedores solo pueden ver sus propios reportes
      setSelectedSellerId('me');
    } else if (permissions.canViewAllReports() && sellersData?.sellers && sellersData.sellers.length > 0) {
      // Para administradores, seleccionar el primer vendedor disponible si no hay uno seleccionado
      const firstSeller = sellersData.sellers.find(seller => seller.roleCode !== 'ADMIN');
      if (firstSeller && selectedSellerId === 'me') {
        setSelectedSellerId(firstSeller.id.toString());
      }
    }
  }, [permissions, sellersData, selectedSellerId]);

  // Cargar ventas offline pendientes
  useEffect(() => {
    const loadOfflinePendingSales = async () => {
      try {
        const pendingSales = await SyncService.getOfflineSalesByStatus('PENDING_SYNC');
        const reviewRequiredSales = await SyncService.getOfflineSalesByStatus('REVIEW_REQUIRED');
        const allPendingSales = [...pendingSales, ...reviewRequiredSales];
        
        setOfflinePendingSales(allPendingSales);
        setOfflinePendingCount(allPendingSales.length);
        
        console.log('📊 Ventas offline pendientes cargadas:', allPendingSales.length);
      } catch (error) {
        console.error('Error cargando ventas offline pendientes:', error);
      }
    };

    loadOfflinePendingSales();
    
    // Verificar cambios en el servidor cada 15 segundos (más frecuente para detectar cambios de admin)
    const interval = setInterval(async () => {
      try {
        // Si es admin y hay un vendedor seleccionado, verificar para ese vendedor
        const sellerIdToCheck = permissions.canViewAllReports() && selectedSellerId !== 'me' 
          ? parseInt(selectedSellerId) 
          : undefined;
        
        const result = await SyncService.checkOfflineSalesStatus(sellerIdToCheck);
        if (result.updated > 0 || result.removed > 0) {
          console.log('🔄 Cambios detectados en ventas offline, recargando...');
          loadOfflinePendingSales();
        }
      } catch (error) {
        console.error('Error verificando estado de ventas offline:', error);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [selectedSellerId, permissions]);

  // Query para obtener el reporte diario
  const { data: report, isLoading, error, refetch } = useQuery<DailyReportData>({
    queryKey: ['dailyReport', selectedDate, selectedSellerId],
    queryFn: () => getDailyReport(selectedDate, selectedSellerId),
    enabled: !!user,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-GT', {
      style: 'currency',
      currency: 'GTQ',
    }).format(amount);
  };

  const formatTime = (hour: number) => {
    return `${hour.toString().padStart(2, '0')}:00`;
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-GT', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleExportProductsPdf = async () => {
    if (!report || !report.topProducts || report.topProducts.length === 0) {
      alert('No hay productos para exportar');
      return;
    }

    setIsGeneratingProductsPdf(true);
    try {
      let sellerName = 'Vendedor';
      if (selectedSellerId === 'me') {
        sellerName = report?.seller?.fullName || user?.fullName || user?.username || 'Vendedor';
      } else {
        const selectedSeller = sellersData?.sellers?.find(s => s.id.toString() === selectedSellerId);
        sellerName = selectedSeller?.fullName || 'Vendedor';
      }
      
      const pdf = await generateProductsPdf(report.topProducts, sellerName, selectedDate);
      const fileName = `productos-vendidos-${selectedDate}-${sellerName.replace(/\s+/g, '-')}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generando PDF de productos:', error);
      alert('Error al generar el PDF. Por favor, intenta nuevamente.');
    } finally {
      setIsGeneratingProductsPdf(false);
    }
  };

  const handleExportSalesPdf = async () => {
    if (!report || !report.dailySales || report.dailySales.length === 0) {
      alert('No hay ventas para exportar');
      return;
    }

    setIsGeneratingSalesPdf(true);
    try {
      let sellerName = 'Vendedor';
      if (selectedSellerId === 'me') {
        sellerName = report?.seller?.fullName || user?.fullName || user?.username || 'Vendedor';
      } else {
        const selectedSeller = sellersData?.sellers?.find(s => s.id.toString() === selectedSellerId);
        sellerName = selectedSeller?.fullName || 'Vendedor';
      }
      
      const pdf = await generateSalesPdf(report.dailySales, sellerName, selectedDate);
      const fileName = `ventas-del-dia-${selectedDate}-${sellerName.replace(/\s+/g, '-')}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generando PDF de ventas:', error);
      alert('Error al generar el PDF. Por favor, intenta nuevamente.');
    } finally {
      setIsGeneratingSalesPdf(false);
    }
  };

  if (!permissions.canViewReports()) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-red-800">Acceso Denegado</h2>
          <p className="text-red-600">No tienes permisos para ver reportes.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
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
          <p className="text-red-600">Error al cargar el reporte: {error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reporte Diario</h1>
        <p className="text-gray-600">
          {selectedSellerId === 'me' 
            ? (report?.seller?.fullName || 'Vendedor') 
            : (sellersData?.sellers?.find(s => s.id.toString() === selectedSellerId)?.fullName || 'Vendedor')
          } - {formatDisplayDate(selectedDate)}
        </p>
      </div>

      {/* Filtros */}
      <div className="mb-6 bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">
              Fecha:
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          {permissions.canViewAllReports() && sellersData?.sellers && sellersData.sellers.length > 0 && (
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">
                Vendedor:
              </label>
              <select
                value={selectedSellerId}
                onChange={(e) => setSelectedSellerId(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]"
                disabled={!permissions.canViewAllReports()}
              >
                {sellersData.sellers
                  .filter(seller => seller.roleCode !== 'ADMIN') // Ocultar admins
                  .map(seller => (
                    <option key={seller.id} value={seller.id.toString()}>
                      {seller.fullName} ({seller.role})
                    </option>
                  ))}
              </select>
            </div>
          )}
          
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Actualizar
          </button>
        </div>
      </div>

      {report && (
        <>
          {/* Resumen Principal */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Documentos</p>
                  <p className="text-2xl font-bold text-gray-900">{report.summary?.totalSales || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Vendido</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(report.summary?.totalAmount || 0)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Ticket Promedio</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(report.summary?.averageTicket || 0)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-red-100 rounded-lg">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pendientes</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {(report.summary?.pendingSync || 0) + offlinePendingCount}
                  </p>
                  {offlinePendingCount > 0 && (
                    <p className="text-xs text-orange-600 mt-1">
                      {offlinePendingCount} offline
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Productos Vendidos */}
          <div className="bg-white rounded-lg shadow mb-8">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Productos Vendidos</h3>
              <button
                onClick={handleExportProductsPdf}
                disabled={isGeneratingProductsPdf || !report?.topProducts || report.topProducts.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isGeneratingProductsPdf ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Generando...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Exportar PDF</span>
                  </>
                )}
              </button>
            </div>
            <div className="p-6">
              {report.topProducts && report.topProducts.length > 0 ? (
                <div className="space-y-4">
                  {report.topProducts.map((product: Product) => (
                    <div key={product.productId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <div className="ml-4">
                          <p className="font-medium text-gray-900">{product.productName}</p>
                          <p className="text-sm text-gray-500">{product.productSku}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">{product.quantity} UND</p>
                        <p className="text-sm text-gray-500">{formatCurrency(product.amount)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No hay ventas para esta fecha</p>
              )}
            </div>
          </div>

          {/* Horas Pico */}
          <div className="bg-white rounded-lg shadow mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Horas Pico</h3>
            </div>
            <div className="p-6">
              {report.peakHours && report.peakHours.length > 0 ? (
                <div className="space-y-4">
                  {report.peakHours.map((hour: PeakHour, index: number) => (
                    <div key={hour.hour} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <span className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-semibold">
                          {index + 1}
                        </span>
                        <div className="ml-4">
                          <p className="font-medium text-gray-900">{formatTime(hour.hour)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">{formatCurrency(hour.amount)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No hay datos de horas pico</p>
              )}
            </div>
          </div>

          {/* Ventas Offline Pendientes */}
          {offlinePendingCount > 0 && (
            <div className="bg-white rounded-lg shadow mb-8">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">
                  Ventas Offline Pendientes ({offlinePendingCount})
                </h3>
                <button
                  onClick={async () => {
                    try {
                      const result = await SyncService.checkOfflineSalesStatus();
                      if (result.updated > 0 || result.removed > 0) {
                        // Recargar las ventas offline
                        const pendingSales = await SyncService.getOfflineSalesByStatus('PENDING_SYNC');
                        const reviewRequiredSales = await SyncService.getOfflineSalesByStatus('REVIEW_REQUIRED');
                        const allPendingSales = [...pendingSales, ...reviewRequiredSales];
                        setOfflinePendingSales(allPendingSales);
                        setOfflinePendingCount(allPendingSales.length);
                      }
                    } catch (error) {
                      console.error('Error verificando estado:', error);
                    }
                  }}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Verificar Cambios
                </button>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {offlinePendingSales.map((sale) => (
                    <div key={sale.id} className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900">{sale.customerName}</p>
                          <p className="text-sm text-gray-500">UUID: {sale.id}</p>
                          <p className="text-sm text-gray-500">
                            Creada: {new Date(sale.createdAt).toLocaleString('es-GT', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                          <p className="text-sm text-orange-600 font-medium">
                            Estado: {sale.status === 'PENDING_SYNC' ? 'Pendiente de sincronización' : 'Requiere revisión'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">Q {sale.grandTotal.toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="mt-2">
                        <p className="text-sm text-gray-600">Productos:</p>
                        <div className="mt-1 space-y-1">
                          {sale.items.map((item: DBOfflineSaleItem, index: number) => (
                            <p key={index} className="text-sm text-gray-500">
                              {item.productName} - {item.qty} {item.unitCode} - Q {item.lineTotal.toFixed(2)}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Ventas Pendientes */}
          {report.pendingSales && report.pendingSales.count > 0 && (
            <div className="bg-white rounded-lg shadow mb-8">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  Ventas Pendientes de Sincronizar ({report.pendingSales?.count || 0})
                </h3>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {report.pendingSales?.sales?.map((sale: PendingSale) => (
                    <div key={sale.id} className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900">{sale.customerName}</p>
                          <p className="text-sm text-gray-500">UUID: {sale.uuid}</p>
                          <p className="text-sm text-gray-500">
                            Creada: {formatDateTime(sale.createdAt)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">{formatCurrency(sale.total)}</p>
                        </div>
                      </div>
                      <div className="mt-2">
                        <p className="text-sm text-gray-600">Productos:</p>
                        <div className="mt-1 space-y-1">
                          {sale.items.map((item: SaleItem, index: number) => (
                            <p key={index} className="text-sm text-gray-500">
                              {item.productName} - {item.quantity} UND - {formatCurrency(item.total)}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Ventas del Día */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">
                Ventas del Día ({report.dailySales?.length || 0})
              </h3>
              <button
                onClick={handleExportSalesPdf}
                disabled={isGeneratingSalesPdf || !report?.dailySales || report.dailySales.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isGeneratingSalesPdf ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Generando...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Exportar PDF</span>
                  </>
                )}
              </button>
            </div>
            <div className="p-6">
              {report.dailySales && report.dailySales.length > 0 ? (
                <div className="space-y-4">
                  {report.dailySales.map((sale: Sale) => (
                    <div key={sale.id} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900">
                            {sale.folio} - {sale.customerName}
                          </p>
                          <p className="text-sm text-gray-500">
                            Cliente: {sale.customerCode}
                          </p>
                          <p className="text-sm text-gray-500">
                            Confirmada: {formatDateTime(sale.confirmedAt)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">{formatCurrency(sale.total)}</p>
                        </div>
                      </div>
                      <div className="mt-2">
                        <p className="text-sm text-gray-600">Productos:</p>
                        <div className="mt-1 space-y-1">
                          {sale.items.map((item: SaleItem, index: number) => (
                            <p key={index} className="text-sm text-gray-500">
                              {item.productName} ({item.productSku}) - {item.quantity} UND - {formatCurrency(item.total)}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No hay ventas confirmadas para esta fecha</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
