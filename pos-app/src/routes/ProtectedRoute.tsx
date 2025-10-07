// pos-app/src/routes/ProtectedRoute.tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../state/auth';
import { useEffect } from 'react';

export default function ProtectedRoute() {
  const { isAuthenticated, isLoading, validateSession } = useAuth();
  
  // Validar sesión al montar el componente
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      const isValid = validateSession();
      if (!isValid) {
        console.log('⚠️ ProtectedRoute - Sesión inválida detectada');
      }
    }
  }, [isAuthenticated, isLoading, validateSession]);
  
  // Mostrar loading mientras se verifica la autenticación
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }
  
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}
