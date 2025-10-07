// pos-app/src/hooks/usePermissions.ts
import { useAuth } from '../state/auth';

export function usePermissions() {
  const { user } = useAuth();

  const isAdmin = () => {
    return user?.roles?.includes('ADMIN') ?? false;
  };

  const isSeller = () => {
    return user?.roles?.includes('SELLER') ?? false;
  };

  const canManageProducts = () => {
    return isAdmin();
  };

  const canManageCustomers = () => {
    return isAdmin();
  };

  const canManageSales = () => {
    return isSeller(); // Solo vendedores pueden gestionar ventas
  };

  const canViewSales = () => {
    return isAdmin() || isSeller(); // Ambos pueden ver ventas
  };

  const canViewReports = () => {
    return isAdmin() || isSeller();
  };

  const canViewAllReports = () => {
    return isAdmin();
  };

  const canViewOwnReports = () => {
    return isSeller();
  };

  const canViewDrafts = () => {
    return isAdmin(); // Solo administradores pueden ver todos los borradores
  };

  const canManageUsers = () => {
    return isAdmin();
  };

  return {
    isAdmin,
    isSeller,
    canManageProducts,
    canManageCustomers,
    canManageSales,
    canViewSales,
    canViewReports,
    canViewAllReports,
    canViewOwnReports,
    canViewDrafts,
    canManageUsers,
  };
}

