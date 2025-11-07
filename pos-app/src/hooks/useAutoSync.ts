// pos-app/src/hooks/useAutoSync.ts
import { useEffect, useState } from 'react';
import { syncProducts, syncCustomers, getLastSyncTimes } from '../data/catalog';
import { useAuth } from '../state/auth';

export function useAutoSync() {
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<{ products: string | null; customers: string | null }>({
    products: null,
    customers: null,
  });
  const { isAuthenticated } = useAuth();

  const checkAndSync = async () => {
    if (!isAuthenticated) return;

    try {
      setIsAutoSyncing(true);
      
      // Obtener tiempos de última sincronización
      const syncTimes = await getLastSyncTimes();
      setLastSync(syncTimes);
      
      // Si nunca se ha sincronizado, sincronizar automáticamente
      const neverSynced = !syncTimes.products && !syncTimes.customers;
      
      // Si la última sincronización fue hace más de 1 hora, sincronizar
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const lastSyncTime = syncTimes.products || syncTimes.customers;
      const needsSync = lastSyncTime && new Date(lastSyncTime) < oneHourAgo;
      
      if (neverSynced || needsSync) {
        console.log('🔄 Auto-sync: Iniciando sincronización automática...');
        
        await Promise.all([
          syncProducts(),
          syncCustomers()
        ]);
        
        // Actualizar tiempos de sincronización
        const newSyncTimes = await getLastSyncTimes();
        setLastSync(newSyncTimes);
        
        console.log('✅ Auto-sync: Sincronización automática completada');
      } else {
        console.log('ℹ️ Auto-sync: No es necesario sincronizar');
      }
    } catch (error) {
      console.error('❌ Auto-sync: Error en sincronización automática:', error);
    } finally {
      setIsAutoSyncing(false);
    }
  };

  useEffect(() => {
    // Sincronizar al cargar la app
    checkAndSync();
    
    // Sincronizar cada 30 minutos
    const interval = setInterval(checkAndSync, 30 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  return {
    isAutoSyncing,
    lastSync,
    checkAndSync
  };
}
























