import { useEffect } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import LoginPage from './pages/Login';
import Home from './pages/Home';
import ProtectedRoute from './routes/ProtectedRoute';
import { useAuth } from './state/auth';
import SyncBar from './components/SyncBar';
import Navigation from './components/Navigation';
import { useAutoSync } from './hooks/useAutoSync';
import ProductsPage from './pages/Products';
import CustomersPage from './pages/Customers';
import NewSalePage from './pages/NewSale';
import SalesDraftsPage from './pages/SalesDrafts';
import OfflineSalesPage from './pages/OfflineSales';
import AdminOfflineSalesPage from './pages/AdminOfflineSales';
import AdminDraftsPage from './pages/AdminDrafts';
import InventoryPage from './pages/Inventory';
import SellersPage from './pages/Sellers';
import DailyReportPage from './pages/DailyReport';
import DailySummaryPage from './pages/DailySummary';
import SaleSuccessPage from './pages/SaleSuccess';
import TestStockPage from './pages/TestStock';
import ConflictReviewPage from './pages/ConflictReview';
import UnifiedReportsPage from './pages/UnifiedReports';
import SalesReportsPage from './pages/SalesReports';
import InventoryReportsPage from './pages/InventoryReports';
import CustomerReportsPage from './pages/CustomerReports';
import UnitsManagementPage from './pages/UnitsManagement';

// Funciones globales para debug y limpiar sesiones desde la consola
declare global {
  interface Window {
    clearAllSessions: () => void;
    inspectSessions: () => void;
    forceLogout: () => void;
    cleanBadOfflineSales: () => Promise<number>;
    diagnoseOfflineSales: () => Promise<void>;
    cleanDuplicateOfflineSales: () => Promise<number>;
    cleanFalseDuplicateSales: () => Promise<number>;
    cleanConfirmedWithError: () => Promise<number>;
    diagnoseProducts: () => Promise<void>;
    forceSyncProducts: () => Promise<void>;
  }
}

export default function App() {
  const { loadFromStorage, clearAllSessions, forceLogout, checkForUserChanges } = useAuth();
  useAutoSync(); // Hook para sincronización automática
  
  useEffect(() => {
    console.log('🚀 App - Inicializando aplicación');
    loadFromStorage().catch(console.error);
    
    // Listener para detectar cambios en localStorage
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key && (e.key.startsWith('auth_') || e.key === 'current_user_id')) {
        console.log('🔄 Cambio detectado en localStorage:', e.key);
        checkForUserChanges();
      }
    };
    
    // Listener para detectar cuando la página se recarga
    const handleBeforeUnload = () => {
      console.log('🔄 App - Página se está recargando, manteniendo sesión');
    };
    
    // Listener para detectar cuando la página vuelve a estar visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('🔄 App - Página vuelve a estar visible, verificando sesión');
        loadFromStorage().catch(console.error);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Exponer funciones globales para debug y limpiar sesiones
    window.clearAllSessions = clearAllSessions;
    window.forceLogout = forceLogout;
    window.inspectSessions = () => {
      console.log('🔍 Inspeccionando sesiones en localStorage:');
      console.log('current_user_id:', localStorage.getItem('current_user_id'));
      
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('auth_')) {
          const value = localStorage.getItem(key);
          console.log(`${key}:`, value?.substring(0, 100) + (value && value.length > 100 ? '...' : ''));
        }
      });
    };
    
    // Exponer función para limpiar ventas offline incorrectas
  window.cleanBadOfflineSales = async () => {
    try {
      const { SyncService } = await import('./data/sync');
      const cleanedCount = await SyncService.cleanBadOfflineSales();
      console.log(`✅ Se limpiaron ${cleanedCount} ventas offline incorrectas`);
      return cleanedCount;
    } catch (error) {
      console.error('❌ Error limpiando ventas offline:', error);
      throw error;
    }
  };

  window.diagnoseOfflineSales = async () => {
    try {
      const { SyncService } = await import('./data/sync');
      await SyncService.diagnoseOfflineSales();
    } catch (error) {
      console.error('❌ Error diagnosticando ventas offline:', error);
      throw error;
    }
  };

  window.cleanDuplicateOfflineSales = async () => {
    try {
      const { SyncService } = await import('./data/sync');
      const cleanedCount = await SyncService.cleanDuplicateOfflineSales();
      console.log(`✅ Se limpiaron ${cleanedCount} ventas offline duplicadas/problemáticas`);
      return cleanedCount;
    } catch (error) {
      console.error('❌ Error limpiando ventas offline duplicadas:', error);
      throw error;
    }
  };


  window.cleanFalseDuplicateSales = async () => {
    try {
      const { SyncService } = await import('./data/sync');
      const cleanedCount = await SyncService.cleanFalseDuplicateSales();
      console.log(`✅ Se limpiaron ${cleanedCount} ventas falsamente marcadas como duplicadas`);
      return cleanedCount;
    } catch (error) {
      console.error('❌ Error limpiando ventas falsamente marcadas como duplicadas:', error);
      throw error;
    }
  };

  return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadFromStorage, clearAllSessions, forceLogout, checkForUserChanges]);

  return (
    <>
      <Routes>
        {/* Ruta de inicio de sesión */}
        <Route path="/login" element={<LoginPage />} />
        
        {/* Página de éxito sin layout */}
        <Route element={<ProtectedRoute />}>
          <Route path="/sales/success" element={<SaleSuccessPage />} />
        </Route>
        
        {/* Rutas protegidas con layout */}
        <Route element={<ProtectedRoute />}>
          <Route path="/*" element={
            <div className="flex h-screen bg-gray-50">
              {/* Navegación lateral - Solo en desktop */}
              <Navigation />
              
              {/* Contenido principal */}
              <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
                {/* Barra de sincronización */}
                <SyncBar />
                
                {/* Área de contenido */}
                <main className="flex-1 overflow-auto p-4 lg:p-6">
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/catalog/products" element={<ProductsPage />} />
                    <Route path="/catalog/customers" element={<CustomersPage />} />
                    <Route path="/catalog/units" element={<UnitsManagementPage />} />
                    <Route path="/sales/new" element={<NewSalePage />} />
                    <Route path="/sales/drafts" element={<SalesDraftsPage />} />
                    <Route path="/sales/offline" element={<OfflineSalesPage />} />
                    <Route path="/admin/offline-sales" element={<AdminOfflineSalesPage />} />
                    <Route path="/admin/drafts" element={<AdminDraftsPage />} />
                    <Route path="/admin/conflicts" element={<ConflictReviewPage />} />
                    <Route path="/sellers" element={<SellersPage />} />
                    <Route path="/reports" element={<UnifiedReportsPage />} />
                    <Route path="/reports/daily" element={<DailyReportPage />} />
                    <Route path="/reports/summary" element={<DailySummaryPage />} />
                    <Route path="/reports/sales" element={<SalesReportsPage />} />
                    <Route path="/reports/inventory" element={<InventoryReportsPage />} />
                    <Route path="/reports/customers" element={<CustomerReportsPage />} />
                    <Route path="/inventory" element={<InventoryPage />} />
                    <Route path="/test/stock" element={<TestStockPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </main>
              </div>
            </div>
          } />
        </Route>
        
        {/* Redirección para rutas no válidas */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}