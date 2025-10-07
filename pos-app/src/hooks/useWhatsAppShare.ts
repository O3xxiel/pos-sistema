import { useCallback } from 'react';
import type { OfflineSaleRow } from '../offline/db';

export const useWhatsAppShare = () => {
  const shareInvoice = useCallback(async (sale: OfflineSaleRow, folio?: string) => {
    try {
      // Generar mensaje de texto para WhatsApp
      const message = generateWhatsAppMessage(sale, folio);
      
      // URL de WhatsApp con el mensaje
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
      
      // Abrir WhatsApp en una nueva ventana
      window.open(whatsappUrl, '_blank');
      
      return true;
    } catch (error) {
      console.error('Error sharing to WhatsApp:', error);
      throw error;
    }
  }, []);

  const shareInvoiceWithFile = useCallback(async (pdfBlob: Blob, sale: OfflineSaleRow, folio?: string) => {
    try {
      // Verificar si el navegador soporta la API de Web Share con archivos
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([pdfBlob], 'factura.pdf', { type: 'application/pdf' })] })) {
        const file = new File([pdfBlob], `factura-${folio || sale.id.slice(-8)}.pdf`, { 
          type: 'application/pdf' 
        });
        
        const message = generateWhatsAppMessage(sale, folio);
        
        await navigator.share({
          title: `Factura ${folio || sale.id.slice(-8)}`,
          text: message,
          files: [file]
        });
        
        return true;
      } else {
        // Fallback: compartir solo el mensaje de texto
        return await shareInvoice(sale, folio);
      }
    } catch (error) {
      console.error('Error sharing file to WhatsApp:', error);
      // Fallback: compartir solo el mensaje de texto
      return await shareInvoice(sale, folio);
    }
  }, [shareInvoice]);

  const generateWhatsAppMessage = (sale: OfflineSaleRow, folio?: string) => {
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('es-GT', { 
        style: 'currency', 
        currency: 'GTQ' 
      }).format(amount);
    };

    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    const statusText = sale.status === 'PENDING_SYNC' ? 'Pendiente de sincronizar' : 'Confirmada';
    
    return `🧾 *FACTURA DE VENTA*

🏪 *Surtidora Katy*
📍 123 Calle Principal, Zona 1, Ciudad de Guatemala
📞 NIT: 123456-7

📋 *DETALLES DE LA VENTA*
• Folio: ${folio || `OFF-${sale.id.slice(-8)}`}
• Fecha: ${formatDate(sale.createdAt)}
• Cliente: ${sale.customerName}
• Estado: ${statusText}

🛒 *PRODUCTOS*
${sale.items.map(item => 
  `• ${item.productName} (${item.qty} ${item.unitCode}) - ${formatCurrency(item.lineTotal)}`
).join('\n')}

💰 *TOTALES*
• Subtotal: ${formatCurrency(sale.subtotal)}
• IVA: ${formatCurrency(sale.taxTotal)}
• *TOTAL: ${formatCurrency(sale.grandTotal)}*

${sale.status === 'PENDING_SYNC' ? 
  '⚠️ *Esta factura está pendiente de sincronización*' : 
  '✅ *Factura confirmada*'
}

¡Gracias por tu compra! 🎉`;
  };

  return {
    shareInvoice,
    shareInvoiceWithFile
  };
};
