// pos-app/src/components/Receipt.tsx
import { useState, useEffect } from 'react';
import { usePdfGenerator } from '../hooks/usePdfGenerator';
import { useWhatsAppShare } from '../hooks/useWhatsAppShare';
import type { OfflineSaleRow } from '../offline/db';

interface ReceiptProps {
  sale: OfflineSaleRow;
  isOffline?: boolean;
  folio?: string;
  sellerName?: string;
  onClose?: () => void;
}

export default function Receipt({ sale, isOffline = false, folio, sellerName, onClose }: ReceiptProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [actualSellerName, setActualSellerName] = useState(sellerName || 'N/A');
  const [actualSaleData, setActualSaleData] = useState<OfflineSaleRow>(sale);
  const [isLoadingUpdatedData, setIsLoadingUpdatedData] = useState(false);
  
  const { generateInvoicePdf } = usePdfGenerator();
  const { shareInvoice, shareInvoiceWithFile } = useWhatsAppShare();

  // Obtener datos actualizados del servidor si la venta no es offline
  useEffect(() => {
    const getUpdatedSaleData = async () => {
      // Solo obtener datos actualizados si tiene folio
      if (!folio) {
        return;
      }

      setIsLoadingUpdatedData(true);
      try {
        const { fetchWithAuth, API_URL } = await import('../data/api');
        
        // Intentar buscar por folio primero
        let response = await fetchWithAuth(`${API_URL}/sales?folio=${folio}`);
        console.log('🔍 [RECEIPT] Response from server (by folio):', response);
        
        // Si no se encuentra por folio y el folio parece ser un UUID, buscar por UUID
        if ((!response || !response.sales || response.sales.length === 0) && folio.includes('-')) {
          console.log('🔍 [RECEIPT] Folio looks like UUID, searching by UUID...');
          response = await fetchWithAuth(`${API_URL}/sales?uuid=${folio}`);
          console.log('🔍 [RECEIPT] Response from server (by UUID):', response);
        }
        
        if (response && response.sales && response.sales.length > 0) {
          const serverSale = response.sales[0];
          console.log('🔍 [RECEIPT] Server sale data:', serverSale);
          console.log('🔍 [RECEIPT] Server sale items:', serverSale.items);
          
          // Convertir los datos del servidor al formato esperado por el componente
          const updatedSaleData: OfflineSaleRow = {
            id: serverSale.uuid || serverSale.id.toString(),
            status: serverSale.status,
            sellerId: serverSale.sellerId,
            customerId: serverSale.customerId,
            customerName: serverSale.customer?.name || 'Cliente',
            customerCode: serverSale.customer?.code || '',
            warehouseId: serverSale.warehouseId,
            subtotal: Number(serverSale.subtotal),
            taxTotal: Number(serverSale.taxTotal),
            grandTotal: Number(serverSale.grandTotal),
            items: serverSale.items.map((item: any) => ({
              productId: item.productId,
              productName: item.product?.name || 'Producto',
              productSku: item.product?.sku || '',
              unitCode: item.unitCode,
              qty: item.qty,
              qtyBase: item.qtyBase,
              priceUnit: Number(item.priceUnit),
              discount: Number(item.discount || 0),
              lineTotal: Number(item.lineTotal),
            })),
            notes: serverSale.notes || '',
            createdAt: serverSale.createdAt,
            syncedAt: serverSale.updatedAt || serverSale.createdAt,
            retryCount: 0,
            lastError: undefined
          };
          
          setActualSaleData(updatedSaleData);
          console.log('✅ Datos de venta actualizados desde el servidor:', updatedSaleData);
        }
      } catch (error) {
        console.warn('Error obteniendo datos actualizados de la venta:', error);
        // Mantener los datos originales si hay error
      } finally {
        setIsLoadingUpdatedData(false);
      }
    };

    getUpdatedSaleData();
  }, [isOffline, folio]);

  // Obtener el nombre del vendedor si no se proporciona
  useEffect(() => {
    const getSellerName = async () => {
      if (sellerName) {
        setActualSellerName(sellerName);
        return;
      }

      try {
        // Si no se proporciona sellerName, intentar obtenerlo del sellerId
        if (actualSaleData.sellerId) {
          const { useAuth } = await import('../state/auth');
          const { user } = useAuth.getState();
          
          // Si el vendedor actual es el mismo que hizo la venta, usar su nombre
          if (user?.id === actualSaleData.sellerId) {
            setActualSellerName(user.username || 'Vendedor');
          } else {
            // Si no, intentar obtener el nombre desde el API
            const { fetchWithAuth, API_URL } = await import('../data/api');
            const response = await fetchWithAuth(`${API_URL}/sellers/${actualSaleData.sellerId}`);
            setActualSellerName(response.name || response.username || 'Vendedor');
          }
        }
      } catch (error) {
        console.warn('Error obteniendo nombre del vendedor:', error);
        setActualSellerName('Vendedor');
      }
    };

    getSellerName();
  }, [actualSaleData.sellerId, sellerName]);

  // Verificar que tenemos datos válidos
  if (!actualSaleData) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-md w-full p-6 text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error</h3>
          <p className="text-gray-600 mb-4">No se pudieron cargar los datos de la venta</p>
          <button
            onClick={onClose}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  const handlePrint = () => {
    setIsPrinting(true);
    window.print();
    setTimeout(() => setIsPrinting(false), 1000);
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      await shareInvoice(actualSaleData, folio);
    } catch (error) {
      console.error('Error sharing to WhatsApp:', error);
      alert('No se pudo compartir por WhatsApp. Intenta nuevamente.');
    } finally {
      setIsSharing(false);
    }
  };

  const handleShareWithPdf = async () => {
    setIsSharing(true);
    setIsGeneratingPdf(true);
    try {
      // Generar PDF
      const pdf = await generateInvoicePdf(actualSaleData, folio);
      const pdfBlob = pdf.output('blob');
      
      // Compartir con archivo PDF
      await shareInvoiceWithFile(pdfBlob, actualSaleData, folio);
    } catch (error) {
      console.error('Error sharing PDF to WhatsApp:', error);
      // Fallback: compartir solo texto
      await shareInvoice(actualSaleData, folio);
    } finally {
      setIsSharing(false);
      setIsGeneratingPdf(false);
    }
  };

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const pdf = await generateInvoicePdf(actualSaleData, folio);
      pdf.save(`factura-${folio || actualSaleData.id.slice(-8)}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('No se pudo generar el PDF. Intenta nuevamente.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <div className="flex items-center">
            <h3 className="text-lg font-semibold">Comprobante de Venta</h3>
            {isLoadingUpdatedData && (
              <div className="ml-3 flex items-center text-blue-600">
                <svg className="animate-spin w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-xs">Actualizando...</span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        {/* Receipt Content */}
        <div className="p-4">
          <div className="text-center border-b pb-4 mb-4">
            <div className="text-xl font-bold">SURTIDORA KATY</div>
            <div className="text-sm text-gray-600">Tienda de Abarrotes</div>
            <div className="text-xs text-gray-500">Guatemala, Guatemala</div>
          </div>

          {/* Receipt Info */}
          <div className="space-y-2 mb-4 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">Folio:</span>
              <span className="font-mono">{folio || (isOffline ? `OFF-${actualSaleData.id.slice(-8)}` : 'N/A')}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Fecha:</span>
              <span>{new Date(actualSaleData.createdAt).toLocaleString('es-GT')}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Cliente:</span>
              <span>{actualSaleData.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Vendedor:</span>
              <span>{actualSellerName}</span>
            </div>
          </div>

          {/* Offline Notice */}
          {isOffline && (
            <div className="bg-orange-100 border border-orange-300 rounded p-3 mb-4 text-center">
              <div className="text-orange-800 font-bold text-sm">
                ⚠️ PENDIENTE DE SINCRONIZAR
              </div>
              <div className="text-orange-600 text-xs">
                Sin folio oficial - Comprobante provisional
              </div>
            </div>
          )}

          {/* Items */}
          <div className="border-t pt-4 mb-4">
            <div className="text-sm font-medium mb-2">Productos:</div>
            <div className="space-y-2">
              {actualSaleData.items.map((item, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <div className="flex-1 mr-2">
                    <div className="font-medium">{item.productName}</div>
                    <div className="text-xs text-gray-500">SKU: {item.productSku}</div>
                  </div>
                  <div className="text-right">
                    <div>{item.qty} {item.unitCode}</div>
                    <div className="font-medium">${item.lineTotal.toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal:</span>
              <span>${actualSaleData.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>IVA:</span>
              <span>${actualSaleData.taxTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>TOTAL:</span>
              <span>${actualSaleData.grandTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-6 text-sm text-gray-600">
            <div>¡Gracias por su compra!</div>
            <div>Vuelva pronto</div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t space-y-3">
          {/* WhatsApp Buttons */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">Enviar por WhatsApp:</h4>
            <div className="flex space-x-2">
              <button
                onClick={handleShare}
                disabled={isSharing}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50 flex items-center justify-center"
              >
                {isSharing ? (
                  <>
                    <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Enviando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.214-.361a9.86 9.86 0 01-1.378-5.031c0-5.449 4.436-9.884 9.884-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.449-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                    </svg>
                    Solo Texto
                  </>
                )}
              </button>
              <button
                onClick={handleShareWithPdf}
                disabled={isSharing || isGeneratingPdf}
                className="flex-1 bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50 flex items-center justify-center"
              >
                {isGeneratingPdf ? (
                  <>
                    <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Generando PDF...
                  </>
                ) : isSharing ? (
                  <>
                    <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Enviando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.214-.361a9.86 9.86 0 01-1.378-5.031c0-5.449 4.436-9.884 9.884-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.449-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                    </svg>
                    Con PDF
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Other Actions */}
          <div className="flex space-x-2">
            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50 flex items-center justify-center"
            >
              {isPrinting ? (
                <>
                  <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Imprimiendo...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Imprimir
                </>
              )}
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50 flex items-center justify-center"
            >
              {isGeneratingPdf ? (
                <>
                  <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Generando...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Descargar PDF
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
