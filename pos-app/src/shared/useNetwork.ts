import { useEffect, useState } from 'react';
import { SyncService } from '../data/sync';
// import notificationManager from '../utils/notifications';

export function useNetwork() {
  const [online, setOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  useEffect(() => {
    const on = async () => {
      setOnline(true);
      // Solo actualizar contador cuando volvemos online, sin sincronizar automáticamente
      const count = await SyncService.getPendingSyncCount();
      setPendingSyncCount(count);
    };
    
    const off = () => setOnline(false);
    
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    
    // Cargar contador inicial
    SyncService.getPendingSyncCount().then(setPendingSyncCount);
    
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, [isSyncing]);

  const syncNow = async () => {
    if (isSyncing || !online) return;
    
    setIsSyncing(true);
    try {
      const result = await SyncService.syncOfflineSales();
      
      // Verificar estado de ventas que estaban en revisión
      const statusCheck = await SyncService.checkOfflineSalesStatus();
      
      // Actualizar contador con el total de ventas pendientes
      const count = await SyncService.getPendingSyncCount();
      setPendingSyncCount(count);
      
      return {
        ...result,
        resolved: statusCheck.removed,
        updated: statusCheck.updated,
      };
    } finally {
      setIsSyncing(false);
    }
  };

  return { 
    online, 
    isSyncing, 
    pendingSyncCount, 
    syncNow 
  };
}
