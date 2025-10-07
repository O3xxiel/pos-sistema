import { useCallback } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { OfflineSaleRow } from '../offline/db';

export const usePdfGenerator = () => {
  const generateInvoicePdf = useCallback(async (sale: OfflineSaleRow, folio?: string) => {
    try {
      // Crear un elemento temporal para renderizar la factura
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '-9999px';
      tempDiv.style.width = '210mm'; // A4 width
      tempDiv.style.backgroundColor = 'white';
      tempDiv.style.padding = '20mm';
      tempDiv.style.fontFamily = 'Arial, sans-serif';
      tempDiv.style.fontSize = '12px';
      tempDiv.style.lineHeight = '1.4';
      
      // Generar el HTML de la factura
      const invoiceHtml = generateInvoiceHtml(sale, folio);
      tempDiv.innerHTML = invoiceHtml;
      
      // Agregar al DOM temporalmente
      document.body.appendChild(tempDiv);
      
      // Convertir a canvas
      const canvas = await html2canvas(tempDiv, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        width: 794, // A4 width in pixels at 96 DPI
        height: tempDiv.scrollHeight
      });
      
      // Crear PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 295; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      
      let position = 0;
      
      // Agregar imagen al PDF
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      // Si la imagen es más alta que una página, agregar páginas adicionales
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      // Limpiar elemento temporal
      document.body.removeChild(tempDiv);
      
      return pdf;
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw error;
    }
  }, []);

  const generateInvoiceHtml = (sale: OfflineSaleRow, folio?: string) => {
    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('es-GT', { 
        style: 'currency', 
        currency: 'GTQ' 
      }).format(amount);
    };

    return `
      <div style="max-width: 100%; margin: 0 auto; font-family: Arial, sans-serif;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px;">
          <h1 style="margin: 0; font-size: 28px; color: #333;">Surtidora Katy</h1>
          <p style="margin: 5px 0; font-size: 14px; color: #666;">123 Calle Principal, Zona 1</p>
          <p style="margin: 5px 0; font-size: 14px; color: #666;">Ciudad de Guatemala</p>
          <p style="margin: 5px 0; font-size: 14px; color: #666;">NIT: 123456-7</p>
        </div>

        ${sale.status === 'PENDING_SYNC' ? `
          <div style="background-color: #fef3cd; color: #856404; padding: 10px; border: 1px solid #ffeaa7; border-radius: 4px; margin-bottom: 20px; text-align: center; font-weight: bold;">
            PENDIENTE DE SINCRONIZAR - SIN FOLIO OFICIAL
          </div>
        ` : ''}

        <!-- Sale Info -->
        <div style="display: flex; justify-content: space-between; margin-bottom: 30px; border: 1px solid #ddd; padding: 15px;">
          <div>
            <p style="margin: 5px 0;"><strong>Folio:</strong> ${folio || `OFF-${sale.id.slice(-8)}`}</p>
            <p style="margin: 5px 0;"><strong>Fecha:</strong> ${formatDate(sale.createdAt)}</p>
            <p style="margin: 5px 0;"><strong>Vendedor:</strong> Usuario POS</p>
          </div>
          <div>
            <p style="margin: 5px 0;"><strong>Cliente:</strong> ${sale.customerName}</p>
            <p style="margin: 5px 0;"><strong>Estado:</strong> ${sale.status === 'PENDING_SYNC' ? 'Pendiente' : 'Confirmada'}</p>
          </div>
        </div>

        <!-- Items Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
          <thead>
            <tr style="background-color: #f8f9fa;">
              <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Producto</th>
              <th style="border: 1px solid #ddd; padding: 12px; text-align: center;">Cantidad</th>
              <th style="border: 1px solid #ddd; padding: 12px; text-align: right;">Precio Unit.</th>
              <th style="border: 1px solid #ddd; padding: 12px; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${sale.items.map(item => `
              <tr>
                <td style="border: 1px solid #ddd; padding: 12px;">${item.productName}</td>
                <td style="border: 1px solid #ddd; padding: 12px; text-align: center;">${item.qty} ${item.unitCode}</td>
                <td style="border: 1px solid #ddd; padding: 12px; text-align: right;">${formatCurrency(item.priceUnit)}</td>
                <td style="border: 1px solid #ddd; padding: 12px; text-align: right;">${formatCurrency(item.lineTotal)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- Totals -->
        <div style="margin-left: auto; width: 300px; border: 1px solid #ddd; padding: 15px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span>Subtotal:</span>
            <span>${formatCurrency(sale.subtotal)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span>IVA:</span>
            <span>${formatCurrency(sale.taxTotal)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: bold; border-top: 2px solid #333; padding-top: 10px;">
            <span>Total:</span>
            <span style="color: #28a745;">${formatCurrency(sale.grandTotal)}</span>
          </div>
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666;">
          <p style="margin: 5px 0;">¡Gracias por tu compra!</p>
          <p style="margin: 5px 0;">Surtidora Katy</p>
          <p style="margin: 5px 0; font-size: 12px;">Generado el ${new Date().toLocaleString('es-ES')}</p>
        </div>
      </div>
    `;
  };

  return {
    generateInvoicePdf
  };
};
