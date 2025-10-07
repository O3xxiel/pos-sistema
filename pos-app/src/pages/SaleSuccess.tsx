// pos-app/src/pages/SaleSuccess.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Receipt from '../components/Receipt';
import { useAuth } from '../state/auth';
import type { OfflineSaleRow } from '../offline/db';

export default function SaleSuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const folio = searchParams.get('folio');
  const total = searchParams.get('total');
  const customer = searchParams.get('customer');
  const isOffline = searchParams.get('offline') === 'true';
  const [countdown, setCountdown] = useState(30);
  const [hasError, setHasError] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [saleData, setSaleData] = useState<OfflineSaleRow | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Cargar datos de la venta y mostrar notificación - Combinado en un solo useEffect
  useEffect(() => {
    console.log('SaleSuccess - Parameters received:', {
      folio,
      total,
      customer,
      allParams: Object.fromEntries(searchParams.entries())
    });

    // Verificar si tenemos los datos mínimos necesarios
    if (!folio && !total) {
      console.error('SaleSuccess - Missing required parameters');
      setHasError(true);
      return;
    }

    const loadSaleData = async () => {
      try {
        console.log('Loading sale data...', { isOffline, folio, customer, total });
        
        // Crear datos de venta basados en los parámetros de URL
        const saleId = folio?.replace('OFF-', '') || 'unknown';
        const totalAmount = parseFloat(total || '0');
        const subtotal = totalAmount / 1.12; // Quitar IVA
        const taxTotal = totalAmount - subtotal;
        
        const mockSale: OfflineSaleRow = {
          id: saleId,
          status: isOffline ? 'PENDING_SYNC' : 'CONFIRMED',
          customerId: 1,
          customerName: customer || 'Cliente General',
          customerCode: 'CLI001',
          warehouseId: 1,
          sellerId: user?.id || 1, // Usar el ID del usuario actual
          subtotal: subtotal,
          taxTotal: taxTotal,
          grandTotal: totalAmount,
          items: [
            {
              id: 'item-1',
              productId: 1,
              productSku: 'PROD001',
              productName: 'Producto de Venta',
              unitCode: 'UND',
              unitFactor: 1,
              qty: 1,
              qtyBase: 1,
              priceUnit: totalAmount,
              discount: 0,
              lineTotal: totalAmount,
              productTaxRate: 0, // ✅ Agregado
              availableUnits: []
            }
          ],
          notes: isOffline ? 'Venta offline' : 'Venta confirmada',
          createdAt: new Date().toISOString(),
          retryCount: 0
        };
        
        console.log('Created sale data:', mockSale);
        setSaleData(mockSale);
        setIsLoadingData(false);
        
      } catch (error) {
        console.error('Error loading sale data:', error);
        // Crear datos mínimos en caso de error
        const fallbackSale: OfflineSaleRow = {
          id: 'fallback',
          status: 'PENDING_SYNC',
          customerId: 1,
          customerName: 'Cliente General',
          customerCode: 'CLI001',
          warehouseId: 1,
          sellerId: user?.id || 1, // Usar el ID del usuario actual
          subtotal: 100,
          taxTotal: 12,
          grandTotal: 112,
          items: [
            {
              id: 'item-1',
              productId: 1,
              productSku: 'PROD001',
              productName: 'Producto',
              unitCode: 'UND',
              unitFactor: 1,
              qty: 1,
              qtyBase: 1,
              priceUnit: 112,
              discount: 0,
              lineTotal: 112,
              productTaxRate: 12, // ✅ Agregado (12% IVA para este ejemplo)
              availableUnits: []
            }
          ],
          notes: 'Venta',
          createdAt: new Date().toISOString(),
          retryCount: 0
        };
        setSaleData(fallbackSale);
        setIsLoadingData(false);
      }
    };

    // Mostrar notificación de confirmación al cargar la página
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 text-white px-6 py-3 rounded-lg shadow-lg z-50 fade-in ${
      isOffline ? 'bg-orange-500' : 'bg-green-500'
    }`;
    notification.innerHTML = `
      <div class="flex items-center">
        <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <div>
          <div class="font-semibold">${isOffline ? '¡Venta guardada offline!' : '¡Venta confirmada!'}</div>
          <div class="text-sm">Folio: ${folio || 'N/A'}</div>
          ${isOffline ? '<div class="text-xs mt-1">Se sincronizará cuando vuelva la conexión</div>' : ''}
        </div>
      </div>
    `;
    document.body.appendChild(notification);
    
    // Remover la notificación después de 3 segundos
    setTimeout(() => {
      notification.remove();
    }, 3000);

    // Cargar datos de la venta
    loadSaleData();
  }, [isOffline, folio, customer, total, searchParams, user?.id]);

  useEffect(() => {
    // Countdown para redirigir automáticamente (pausar si se muestra el comprobante)
    const timer = setInterval(() => {
      if (!showReceipt) {
        setCountdown(prev => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [showReceipt]);

  // Efecto separado para manejar la navegación cuando el countdown llega a 0
  useEffect(() => {
    if (countdown === 0) {
      navigate('/');
    }
  }, [countdown, navigate]);

  const handleGoToDashboard = () => {
    navigate('/');
  };

  const handleNewSale = () => {
    navigate('/sales/new');
  };

  // Mostrar pantalla de error si faltan parámetros
  if (hasError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-red-500 rounded-full mb-6">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          
          <h1 className="text-3xl font-bold text-red-800 mb-2">
            Error al cargar la venta
          </h1>
          
          <p className="text-red-600 text-lg mb-6">
            No se pudieron cargar los detalles de la venta
          </p>

          <button
            onClick={handleGoToDashboard}
            className="btn-primary"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${
      isOffline 
        ? 'bg-gradient-to-br from-orange-50 to-amber-100' 
        : 'bg-gradient-to-br from-green-50 to-emerald-100'
    }`}>
      <div className="max-w-md w-full">
        {/* Success Animation */}
        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full mb-6 animate-bounce ${
            isOffline ? 'bg-orange-500' : 'bg-green-500'
          }`}>
            {isOffline ? (
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            ) : (
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          
          <h1 className={`text-3xl font-bold mb-2 ${isOffline ? 'text-orange-800' : 'text-green-800'}`}>
            {isOffline ? '¡Venta Guardada Offline!' : '¡Venta Confirmada!'}
          </h1>
          
          <p className={`text-lg ${isOffline ? 'text-orange-600' : 'text-green-600'}`}>
            {isOffline ? 'La venta se ha guardado localmente' : 'La venta se ha procesado exitosamente'}
          </p>
          {isOffline && (
            <p className="text-orange-500 text-sm mt-2 font-medium">
              Se sincronizará automáticamente cuando vuelva la conexión
            </p>
          )}
          <p className="text-gray-500 text-sm mt-2">
            Gracias por usar Surtidora Katy
          </p>
        </div>

        {/* Sale Details Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-600 font-medium">Folio:</span>
              <span className="text-xl font-bold text-gray-900 font-mono">{folio || 'N/A'}</span>
            </div>
            
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-600 font-medium">Cliente:</span>
              <span className="text-gray-900 font-semibold">
                {customer ? decodeURIComponent(customer) : 'Cliente General'}
              </span>
            </div>
            
            <div className="flex justify-between items-center py-3 bg-green-50 rounded-lg px-4">
              <span className="text-green-700 font-medium text-lg">Total:</span>
              <span className="text-2xl font-bold text-green-800">
                {total ? new Intl.NumberFormat('es-GT', {
                  style: 'currency',
                  currency: 'GTQ'
                }).format(parseFloat(total)) : 'Q 0.00'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => {
              console.log('Showing receipt, saleData:', saleData);
              setShowReceipt(true);
            }}
            disabled={isLoadingData}
            className={`w-full py-4 text-lg font-semibold rounded-lg transition-colors ${
              isLoadingData 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}
          >
            {isLoadingData ? (
              <>
                <svg className="animate-spin w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Preparando comprobante...
              </>
            ) : (
              <>
                <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Ver Comprobante
              </>
            )}
          </button>
          
          <button
            onClick={handleNewSale}
            className="w-full btn-primary py-4 text-lg font-semibold"
          >
            <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Nueva Venta
          </button>
          
          <button
            onClick={handleGoToDashboard}
            className="w-full btn-secondary py-4 text-lg font-semibold"
          >
            <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Ir al Dashboard
          </button>
        </div>

        {/* Auto-redirect countdown */}
        <div className="text-center mt-6">
          <p className="text-gray-500 text-sm">
            Redirigiendo automáticamente en <span className="font-bold text-gray-700">{countdown}</span> segundos...
          </p>
          <button
            onClick={() => setCountdown(0)}
            className="text-blue-600 hover:text-blue-800 text-sm underline mt-1"
          >
            Ir ahora
          </button>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-4 left-4 w-20 h-20 bg-green-200 rounded-full opacity-20 animate-pulse"></div>
        <div className="absolute bottom-4 right-4 w-16 h-16 bg-emerald-200 rounded-full opacity-20 animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-0 w-12 h-12 bg-green-300 rounded-full opacity-10 animate-bounce delay-500"></div>
      </div>

      {/* Receipt Modal */}
      {showReceipt && saleData && (
        <Receipt
          sale={saleData}
          isOffline={isOffline}
          folio={folio || undefined}
          sellerName={user?.username || 'Vendedor'}
          onClose={() => setShowReceipt(false)}
        />
      )}
    </div>
  );
}
