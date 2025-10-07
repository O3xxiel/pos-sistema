import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiLogin } from '../data/api';
import { useAuth } from '../state/auth';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { setSession } = useAuth();
  const navigate = useNavigate();

  const loginMutation = useMutation({
    mutationFn: () => apiLogin(username, password),
    onSuccess: (data) => {
      setSession(data);
      navigate('/', { replace: true });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username && password) loginMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto">
        {/* Header con Logo */}
        <div className="text-center mb-8">
          <div className="mx-auto w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-xl border-4 border-orange-100">
            <svg className="w-16 h-16" viewBox="0 0 100 100" fill="none">
              <circle cx="50" cy="50" r="45" fill="#f97316" />
              <rect x="20" y="65" width="8" height="15" fill="#1e40af" rx="1" />
              <rect x="30" y="60" width="8" height="20" fill="#1e40af" rx="1" />
              <rect x="40" y="50" width="8" height="30" fill="#3b82f6" rx="1" />
              <rect x="50" y="45" width="8" height="35" fill="#3b82f6" rx="1" />
              <rect x="60" y="40" width="8" height="40" fill="#60a5fa" rx="1" />
              <path d="M15 75 Q25 65 35 55 Q45 45 55 35 Q65 25 75 15" stroke="#fb923c" strokeWidth="4" fill="none" strokeLinecap="round" />
              <path d="M70 20 L75 15 L70 10" stroke="#fb923c" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Surtidora Katy</h1>
          <p className="text-lg text-gray-600 mb-1">Precios a tu alcance...</p>
          <p className="text-sm text-gray-500">Sistema de Punto de Venta</p>
        </div>

        {/* Formulario de Login */}
        <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Campo Usuario (input group con flex, sin posiciones absolutas) */}
            <div className="space-y-2">
              <label htmlFor="username" className="block text-sm font-semibold text-gray-700">
                Usuario
              </label>

              <div className="flex items-center rounded-xl border border-gray-300 bg-white hover:border-gray-400 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all duration-200 shadow-sm">
                <span className="pl-4 pr-2 text-gray-400">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </span>
                <input
                  id="username"
                  type="text"
                  className="flex-1 py-4 pr-4 bg-transparent border-0 outline-none text-gray-900 placeholder-gray-500 text-base"
                  placeholder="Ingresa tu usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            {/* Campo Contraseña (icono a la izquierda y botón ojo a la derecha) */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700">
                Contraseña
              </label>

              <div className="flex items-center rounded-xl border border-gray-300 bg-white hover:border-gray-400 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all duration-200 shadow-sm">
                <span className="pl-4 pr-2 text-gray-400">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </span>

                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="flex-1 py-4 px-2 bg-transparent border-0 outline-none text-gray-900 placeholder-gray-500 text-base"
                  placeholder="Ingresa tu contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="p-3 pr-4 text-gray-400 hover:text-gray-600 focus:outline-none"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Botón de Login */}
            <button
              type="submit"
              disabled={loginMutation.isPending || !username || !password}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed text-base transform hover:scale-105 disabled:transform-none"
            >
              {loginMutation.isPending ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                  Iniciando sesión...
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  Iniciar Sesión
                </div>
              )}
            </button>

            {/* Mensaje de Error */}
            {loginMutation.isError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4" aria-live="polite">
                <div className="flex">
                  <svg className="w-5 h-5 text-red-400 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <h3 className="text-sm font-medium text-red-800">Error de autenticación</h3>
                    <p className="text-sm text-red-700 mt-1">
                      {(loginMutation.error as Error).message || 'Credenciales incorrectas. Verifica tu usuario y contraseña.'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </form>

        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-500">© 2024 Surtidora Katy. Todos los derechos reservados.</p>
        </div>
      </div>
    </div>
  );
}
