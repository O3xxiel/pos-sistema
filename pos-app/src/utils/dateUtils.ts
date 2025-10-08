// Utilidades para manejo de fechas en la aplicación POS

/**
 * Obtiene la fecha actual en formato YYYY-MM-DD usando zona horaria local
 */
export const getCurrentDate = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Obtiene la fecha actual en formato YYYY-MM-DD usando zona horaria de Guatemala
 */
export const getCurrentDateGT = (): string => {
  const now = new Date();
  
  // Convertir a zona horaria de Guatemala (UTC-6)
  const guatemalaTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Guatemala"}));
  
  // Debug: mostrar información de fechas
  console.log('🕐 Debug de fechas Guatemala:');
  console.log('  - Fecha local:', now.toString());
  console.log('  - UTC:', now.toISOString());
  console.log('  - Guatemala:', guatemalaTime.toString());
  console.log('  - Zona horaria:', Intl.DateTimeFormat().resolvedOptions().timeZone);
  
  // Usar la fecha de Guatemala
  const year = guatemalaTime.getFullYear();
  const month = String(guatemalaTime.getMonth() + 1).padStart(2, '0');
  const day = String(guatemalaTime.getDate()).padStart(2, '0');
  const result = `${year}-${month}-${day}`;
  
  console.log('  - Fecha resultante (GT):', result);
  
  return result;
};

/**
 * Obtiene la fecha del servidor en formato YYYY-MM-DD
 * Usa la fecha del servidor para evitar problemas de sincronización
 */
export const getServerDateGT = async (): Promise<string> => {
  try {
    const response = await fetch('/api/health');
    if (response.ok) {
      const data = await response.json();
      // Extraer la fecha del timestamp del servidor
      const serverDate = new Date(data.timestamp);
      const year = serverDate.getFullYear();
      const month = String(serverDate.getMonth() + 1).padStart(2, '0');
      const day = String(serverDate.getDate()).padStart(2, '0');
      const result = `${year}-${month}-${day}`;
      
      console.log('🕐 Fecha del servidor:', result);
      return result;
    }
  } catch (error) {
    console.warn('No se pudo obtener la fecha del servidor, usando fecha local:', error);
  }
  
  // Fallback a fecha local si no se puede obtener la del servidor
  return getCurrentDateGT();
};

/**
 * Formatea una fecha para mostrar en la interfaz
 * @param dateString Fecha en formato YYYY-MM-DD
 * @returns Fecha formateada para mostrar
 */
export const formatDisplayDate = (dateString: string): string => {
  const date = new Date(dateString + 'T00:00:00');
  return date.toLocaleDateString('es-GT', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

/**
 * Formatea una fecha y hora para mostrar en la interfaz
 * @param dateString Fecha en formato ISO string
 * @returns Fecha y hora formateada para mostrar
 */
export const formatDisplayDateTime = (dateString: string): string => {
  return new Date(dateString).toLocaleString('es-GT', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Crea un rango de fechas para consultas de base de datos usando zona horaria de Guatemala
 * @param dateString Fecha en formato YYYY-MM-DD
 * @returns Objeto con startDate y endDate para consultas
 */
export const createDateRange = (dateString: string) => {
  // Crear fechas en zona horaria de Guatemala
  const startDate = new Date(dateString + 'T00:00:00-06:00'); // UTC-6 (Guatemala)
  const endDate = new Date(dateString + 'T23:59:59.999-06:00'); // UTC-6 (Guatemala)
  
  console.log('📅 Rango de fechas Guatemala:', {
    dateString,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  });
  
  return {
    startDate,
    endDate
  };
};
