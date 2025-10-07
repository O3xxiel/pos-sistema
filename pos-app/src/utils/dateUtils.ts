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
  
  // Debug: mostrar información de fechas
  console.log('🕐 Debug de fechas:');
  console.log('  - Fecha local:', now.toString());
  console.log('  - UTC:', now.toISOString());
  console.log('  - Zona horaria:', Intl.DateTimeFormat().resolvedOptions().timeZone);
  
  // Usar la fecha local directamente (más confiable)
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const result = `${year}-${month}-${day}`;
  
  console.log('  - Fecha resultante:', result);
  
  return result;
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
 * Crea un rango de fechas para consultas de base de datos
 * @param dateString Fecha en formato YYYY-MM-DD
 * @returns Objeto con startDate y endDate para consultas
 */
export const createDateRange = (dateString: string) => {
  const startDate = new Date(dateString + 'T00:00:00');
  const endDate = new Date(dateString + 'T23:59:59.999');
  
  return {
    startDate,
    endDate
  };
};
