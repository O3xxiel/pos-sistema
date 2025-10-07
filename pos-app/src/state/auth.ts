// pos-app/src/state/auth.ts
import { create } from 'zustand';
import type { LoginResponse, AuthUser } from '../data/api';

// const API_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3001';

type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;    // memoria
  refreshToken: string | null;   // storage
  isAuthenticated: boolean;
  isLoading: boolean;            // nuevo estado de carga
  setSession: (data: LoginResponse) => void;
  logout: () => void;
  loadFromStorage: () => Promise<void>;
  refreshAccessToken: () => Promise<void>;
  clearAllSessions: () => void;
  forceLogout: () => void;
  checkForUserChanges: () => void;
  validateSession: () => boolean;
};

const STORAGE_KEY = 'refresh_token';
const USER_STORAGE_KEY = 'user_data';
const ACCESS_TOKEN_KEY = 'access_token';

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true, // Inicialmente está cargando

  setSession: (data) => {
    // Limpiar sesiones anteriores de otros usuarios
    const currentUser = data.user;
    const userId = currentUser.id;
    
    console.log('🔐 setSession - Usuario:', { id: userId, username: currentUser.username, roles: currentUser.roles });
    
    // Limpiar TODAS las claves de autenticación existentes
    const keysToRemove: string[] = [];
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('auth_') || 
          key === 'current_user_id' ||
          key === STORAGE_KEY ||
          key === USER_STORAGE_KEY ||
          key === ACCESS_TOKEN_KEY) {
        keysToRemove.push(key);
      }
    });
    
    keysToRemove.forEach(key => {
      console.log('🧹 Limpiando clave:', key);
      localStorage.removeItem(key);
    });
    
    // Guardar datos específicos del usuario actual
    localStorage.setItem(`auth_refresh_token_${userId}`, data.refresh_token);
    localStorage.setItem(`auth_user_data_${userId}`, JSON.stringify(data.user));
    localStorage.setItem(`auth_access_token_${userId}`, data.access_token);
    localStorage.setItem('current_user_id', userId.toString());
    
    console.log('✅ Sesión guardada para usuario:', userId);
    console.log('🔍 Claves actuales en localStorage:', Object.keys(localStorage).filter(k => k.startsWith('auth_') || k === 'current_user_id'));
    
    set({
      user: data.user,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  loadFromStorage: async () => {
    console.log('🔄 loadFromStorage - Iniciando carga desde localStorage');
    
    const currentUserId = localStorage.getItem('current_user_id');
    console.log('🔍 loadFromStorage - currentUserId:', currentUserId);
    
    if (!currentUserId) {
      console.log('❌ No hay current_user_id, no autenticado');
      set({ isLoading: false, isAuthenticated: false });
      return;
    }
    
    // Verificar si hay múltiples usuarios en localStorage
    const allAuthKeys = Object.keys(localStorage).filter(key => key.startsWith('auth_user_data_'));
    console.log('🔍 Claves de usuarios encontradas:', allAuthKeys);
    
    if (allAuthKeys.length > 1) {
      console.log('⚠️ Múltiples usuarios detectados, limpiando todo');
      get().clearAllSessions();
      set({ isLoading: false, isAuthenticated: false });
      return;
    }
    
    const rt = localStorage.getItem(`auth_refresh_token_${currentUserId}`);
    const userData = localStorage.getItem(`auth_user_data_${currentUserId}`);
    const accessToken = localStorage.getItem(`auth_access_token_${currentUserId}`);
    
    console.log('🔍 Datos encontrados:', { 
      rt: !!rt, 
      userData: !!userData, 
      accessToken: !!accessToken,
      rtLength: rt?.length || 0,
      userDataLength: userData?.length || 0,
      accessTokenLength: accessToken?.length || 0
    });
    
    if (rt && userData && accessToken) {
      try {
        const user = JSON.parse(userData);
        console.log('🔍 Usuario parseado:', { id: user.id, username: user.username, roles: user.roles });
        
        // Verificar que el usuario actual sea el mismo que está en storage
        if (user.id.toString() === currentUserId) {
          console.log('✅ Usuario coincide, restaurando sesión completa');
          
          // Verificar que el access token no esté vacío o corrupto
          if (accessToken.length < 10) {
            console.log('⚠️ Access token parece inválido, forzando logout');
            get().forceLogout();
            return;
          }
          
          // Restaurar sesión completa si tenemos todos los datos
          set({ 
            refreshToken: rt,
            user: user,
            isAuthenticated: true,
            isLoading: false,
            accessToken: accessToken
          });
          
          console.log('✅ Sesión restaurada exitosamente');
        } else {
          console.log('❌ Usuario no coincide, limpiando');
          // Usuario diferente, limpiar y no autenticar
          get().clearAllSessions();
          set({ isLoading: false, isAuthenticated: false });
        }
      } catch (error) {
        console.log('❌ Error parseando datos:', error);
        // Si hay error parseando los datos, limpiar storage
        get().clearAllSessions();
        set({ isLoading: false, isAuthenticated: false });
      }
    } else {
      console.log('❌ No hay datos completos, no autenticado');
      console.log('🔍 Detalles de datos faltantes:', {
        missingRefreshToken: !rt,
        missingUserData: !userData,
        missingAccessToken: !accessToken
      });
      // No hay datos completos, no está autenticado
      set({ isLoading: false, isAuthenticated: false });
    }
  },

  refreshAccessToken: async () => {
    const { refreshToken, user } = get();
    
    if (!refreshToken || !user) {
      console.log('❌ refreshAccessToken - No hay refresh token o usuario');
      get().forceLogout();
      return;
    }
    
    try {
      console.log('🔄 refreshAccessToken - Intentando renovar token');
      
      // Por ahora, simplemente forzar logout si el token expira
      // En el futuro se puede implementar un refresh token real
      console.log('⚠️ refreshAccessToken - Token expirado, forzando logout');
      get().forceLogout();
      
    } catch (error) {
      console.error('❌ refreshAccessToken - Error:', error);
      get().forceLogout();
    }
  },

  // Nueva función para validar si la sesión actual es válida
  validateSession: () => {
    const { user, accessToken, isAuthenticated } = get();
    const currentUserId = localStorage.getItem('current_user_id');
    
    console.log('🔍 validateSession - Validando sesión actual:', {
      hasUser: !!user,
      hasToken: !!accessToken,
      isAuthenticated,
      currentUserId,
      tokenLength: accessToken?.length || 0
    });
    
    // Verificar que tenemos todos los datos necesarios
    if (!user || !accessToken || !isAuthenticated || !currentUserId) {
      console.log('❌ validateSession - Datos de sesión incompletos');
      return false;
    }
    
    // Verificar que el usuario coincide con el ID almacenado
    if (user.id.toString() !== currentUserId) {
      console.log('❌ validateSession - ID de usuario no coincide');
      return false;
    }
    
    // Verificar que el token no esté vacío o corrupto
    if (accessToken.length < 10) {
      console.log('❌ validateSession - Token inválido');
      return false;
    }
    
    console.log('✅ validateSession - Sesión válida');
    return true;
  },

  logout: () => {
    const currentUserId = localStorage.getItem('current_user_id');
    
    if (currentUserId) {
      // Limpiar datos específicos del usuario actual
      localStorage.removeItem(`auth_refresh_token_${currentUserId}`);
      localStorage.removeItem(`auth_user_data_${currentUserId}`);
      localStorage.removeItem(`auth_access_token_${currentUserId}`);
      localStorage.removeItem('current_user_id');
    }
    
    // Limpiar claves legacy por compatibilidad
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, isLoading: false });
  },

  clearAllSessions: () => {
    console.log('🧹 clearAllSessions - Limpiando todas las sesiones');
    
    // Limpiar todas las sesiones de todos los usuarios
    const keysToRemove: string[] = [];
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('auth_') || 
          key === 'current_user_id' ||
          key === STORAGE_KEY ||
          key === USER_STORAGE_KEY ||
          key === ACCESS_TOKEN_KEY) {
        keysToRemove.push(key);
      }
    });
    
    keysToRemove.forEach(key => {
      console.log('🧹 Eliminando clave:', key);
      localStorage.removeItem(key);
    });
    
    console.log('✅ Todas las sesiones limpiadas');
    
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, isLoading: false });
  },

  forceLogout: () => {
    console.log('🚨 forceLogout - Forzando logout por cambio de usuario');
    get().clearAllSessions();
  },

  checkForUserChanges: () => {
    const currentUserId = localStorage.getItem('current_user_id');
    const allAuthKeys = Object.keys(localStorage).filter(key => key.startsWith('auth_user_data_'));
    
    console.log('🔍 checkForUserChanges - currentUserId:', currentUserId);
    console.log('🔍 checkForUserChanges - allAuthKeys:', allAuthKeys);
    
    if (allAuthKeys.length > 1) {
      console.log('⚠️ Múltiples usuarios detectados en checkForUserChanges, limpiando todo');
      get().clearAllSessions();
      return;
    }
    
    if (currentUserId && allAuthKeys.length === 1) {
      const expectedKey = `auth_user_data_${currentUserId}`;
      if (!allAuthKeys.includes(expectedKey)) {
        console.log('⚠️ Usuario actual no coincide con las claves disponibles, limpiando todo');
        get().clearAllSessions();
      }
    }
  },
}));
