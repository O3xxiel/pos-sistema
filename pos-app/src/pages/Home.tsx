// pos-app/src/pages/Home.tsx
import { useAuth } from '../state/auth';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../offline/db';
import { SyncService } from '../data/sync';
import { useNetwork } from '../shared/useNetwork';
import { usePermissions } from '../hooks/usePermissions';
import Logo from '../components/Logo';

export default function Home() {
  const { user } = useAuth();
  const { online, isSyncing, syncNow } = useNetwork();
  const permissions = usePermissions();
  const [stats, setStats] = useState({
    products: 0,
    customers: 0,
    lastSync: null as string | null,
    pendingSales: 0,
    reviewRequired: 0
  });

  useEffect(() => {
    const loadStats = async () => {
      const [products, customers, lastSyncMeta, pendingSales, reviewRequired] = await Promise.all([
        db.catalog_products.count(),
        db.catalog_customers.count(),
        db.meta.get('lastSyncProducts'),
        SyncService.getPendingSyncCount(),
        SyncService.getOfflineSalesByStatus('REVIEW_REQUIRED').then(sales => sales.length)
      ]);
      
      setStats({
        products,
        customers,
        lastSync: lastSyncMeta?.value || null,
        pendingSales,
        reviewRequired
      });
    };
    
    loadStats();
    
    // Recargar stats cada 30 segundos para mantener actualizado el contador
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Nunca';
    return new Date(dateStr).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleSync = async () => {
    if (!online || isSyncing) return;
    
    try {
      const result = await syncNow();
      if (result) {
        // Verificar estado de ventas que estaban en revisión (igual que automática)
        const statusCheck = await SyncService.checkOfflineSalesStatus();
        
        // Recargar stats después de sincronizar
        const [pendingSales, reviewRequired] = await Promise.all([
          SyncService.getPendingSyncCount(),
          SyncService.getOfflineSalesByStatus('REVIEW_REQUIRED').then(sales => sales.length)
        ]);
        
        setStats(prev => ({
          ...prev,
          pendingSales,
          reviewRequired
        }));
        
        // Mostrar notificación con información completa
        const message = `${result.synced} confirmadas, ${result.reviewRequired} requieren revisión${
          statusCheck.updated > 0 ? `, ${statusCheck.updated} actualizadas` : ''
        }${statusCheck.removed > 0 ? `, ${statusCheck.removed} resueltas` : ''}`;
        
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 fade-in';
        notification.textContent = `✓ Sincronización completada: ${message}`;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 4000);
      }
    } catch (error: unknown) {
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 fade-in';
      notification.textContent = `✗ Error: ${error instanceof Error ? error.message : 'No se pudo sincronizar'}`;
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 5000);
    }
  };

  const getQuickActions = () => {
    const actions = [
      {
        name: 'Nueva Venta',
        description: 'Crear una nueva transacción de venta',
        href: '/sales/new',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        ),
        color: 'bg-green-500 hover:bg-green-600',
        show: permissions.isSeller() && !permissions.isAdmin()
      },
      {
        name: 'Ver Productos',
        description: 'Gestionar catálogo de productos',
        href: '/catalog/products',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        ),
        color: 'bg-blue-500 hover:bg-blue-600',
        show: permissions.canManageProducts()
      },
      {
        name: 'Ver Clientes',
        description: 'Gestionar base de clientes',
        href: '/catalog/customers',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
        ),
        color: 'bg-purple-500 hover:bg-purple-600',
        show: permissions.canManageCustomers()
      },
      {
        name: 'Reportes',
        description: 'Ver estadísticas y reportes',
        href: '/reports',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ),
        color: 'bg-orange-500 hover:bg-orange-600',
        show: permissions.canViewReports()
      }
    ];

    return actions.filter(action => action.show);
  };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 lg:mb-8">
        <div className="flex items-center space-x-3 lg:space-x-4 mb-4">
          <Logo size="lg" />
          <div>
            <h1 className="text-xl lg:text-3xl font-bold text-gray-900 mb-2">
              ¡Bienvenido a Surtidora Katy, {user?.fullName || user?.username}! 👋
            </h1>
            <p className="text-sm lg:text-base text-gray-600">
              Aquí tienes un resumen de tu sistema de punto de venta
            </p>
          </div>
        </div>
        
        {/* Notificación de ventas pendientes */}
        {(stats.pendingSales > 0 || stats.reviewRequired > 0) && (
          <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-orange-800">
                    Atención: Tienes ventas pendientes de sincronizar
                  </h3>
                  <div className="mt-1 text-sm text-orange-700">
                    {stats.pendingSales > 0 && (
                      <p>• {stats.pendingSales} venta{stats.pendingSales > 1 ? 's' : ''} pendiente{stats.pendingSales > 1 ? 's' : ''} de sincronización</p>
                    )}
                    {stats.reviewRequired > 0 && (
                      <p>• {stats.reviewRequired} venta{stats.reviewRequired > 1 ? 's' : ''} requieren revisión</p>
                    )}
                  </div>
                </div>
              </div>
              {online && (
                <div className="flex space-x-2">
                  <button
                    onClick={handleSync}
                    disabled={isSyncing}
                    className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSyncing ? 'Sincronizando...' : 'Sincronizar Ahora'}
                  </button>
                  <Link
                    to="/sales/offline"
                    className="bg-white hover:bg-gray-50 text-orange-600 border border-orange-300 px-3 py-1 rounded text-sm font-medium"
                  >
                    Ver Detalles
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-4 sm:mb-6 lg:mb-8 px-4 sm:px-0">
        {permissions.canManageProducts() && (
          <div className="card p-3 sm:p-4 lg:p-6">
            <div className="flex items-center">
              <div className="p-2 sm:p-3 rounded-full bg-blue-100">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div className="ml-3 sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Productos</p>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">{stats.products.toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}

        {permissions.canManageCustomers() && (
          <div className="card p-3 sm:p-4 lg:p-6">
            <div className="flex items-center">
              <div className="p-2 sm:p-3 rounded-full bg-purple-100">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <div className="ml-3 sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Clientes</p>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">{stats.customers.toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}

        <div className="card p-3 sm:p-4 lg:p-6">
          <div className="flex items-center">
            <div className="p-2 sm:p-3 rounded-full bg-orange-100">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3 sm:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Ventas Pendientes</p>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">{stats.pendingSales}</p>
              {stats.reviewRequired > 0 && (
                <p className="text-xs text-red-600">{stats.reviewRequired} requieren revisión</p>
              )}
            </div>
          </div>
        </div>

        <div className="card p-3 sm:p-4 lg:p-6">
          <div className="flex items-center">
            <div className="p-2 sm:p-3 rounded-full bg-green-100">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div className="ml-3 sm:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Última Sincronización</p>
              <p className="text-xs sm:text-sm font-bold text-gray-900">{formatDate(stats.lastSync)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-4 sm:mb-6 lg:mb-8 px-4 sm:px-0">
        <h2 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">Acciones Rápidas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          {getQuickActions().map((action) => (
            <Link
              key={action.name}
              to={action.href}
              className="card hover:shadow-md transition-shadow duration-200 cursor-pointer group min-h-[80px] lg:min-h-auto"
            >
              <div className="flex items-center space-x-3">
                <div className={`p-2 lg:p-2 rounded-lg ${action.color} text-white group-hover:scale-110 transition-transform duration-200 flex-shrink-0`}>
                  {action.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors text-sm lg:text-base">
                    {action.name}
                  </h3>
                  <p className="text-xs lg:text-sm text-gray-500 hidden sm:block">{action.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity Placeholder */}
      <div className="card">
        <h2 className="text-lg lg:text-xl font-semibold text-gray-900 mb-4">Actividad Reciente</h2>
        <div className="text-center py-6 lg:py-8">
          <svg className="mx-auto w-10 h-10 lg:w-12 lg:h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-gray-500 text-sm lg:text-base">No hay actividad reciente</p>
          <p className="text-xs lg:text-sm text-gray-400 mt-1">Las transacciones aparecerán aquí cuando comiences a usar el sistema</p>
        </div>
      </div>

      {/* Mobile Floating Action Button */}
      {permissions.isSeller() && !permissions.isAdmin() && (
        <div className="lg:hidden fixed bottom-4 right-4 z-50">
          <Link
            to="/sales/new"
            className="bg-green-500 hover:bg-green-600 text-white rounded-full w-14 h-14 shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110"
            title="Nueva Venta"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </Link>
        </div>
      )}
    </div>
  );
}
