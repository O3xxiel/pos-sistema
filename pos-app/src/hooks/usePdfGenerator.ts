import { useCallback } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { OfflineSaleRow } from '../offline/db';

// Función auxiliar para dibujar el logo directamente en el PDF
const drawLogo = (pdf: jsPDF, x: number, y: number, size: number = 18): void => {
  const centerX = x + size / 2;
  const centerY = y + size / 2;
  const radius = size * 0.35;
  
  // Guardar el estado actual
  pdf.saveGraphicsState();
  
  // Círculo naranja con apertura inferior (arco grueso)
  pdf.setDrawColor(249, 115, 22); // #f97316
  pdf.setLineWidth(size * 0.12);
  pdf.setLineCap('round');
  
  // Dibujar arco superior (de -90 a 90 grados)
  const steps = 40;
  for (let i = 0; i < steps; i++) {
    const angle1 = (-90 + (180 * i / steps)) * (Math.PI / 180);
    const angle2 = (-90 + (180 * (i + 1) / steps)) * (Math.PI / 180);
    const x1 = centerX + radius * Math.cos(angle1);
    const y1 = centerY + radius * Math.sin(angle1);
    const x2 = centerX + radius * Math.cos(angle2);
    const y2 = centerY + radius * Math.sin(angle2);
    pdf.line(x1, y1, x2, y2);
  }
  
  // Gráfico de barras
  const barWidth = size * 0.08;
  const baseY = centerY + radius * 0.4;
  
  // Barra 1 (azul oscuro) - más corta
  pdf.setFillColor(30, 64, 175); // #1e40af
  pdf.roundedRect(
    centerX - radius * 0.3, 
    baseY - size * 0.18, 
    barWidth, 
    size * 0.18, 
    0.5, 
    0.5, 
    'F'
  );
  
  // Barra 2 (azul oscuro) - mediana
  pdf.roundedRect(
    centerX - radius * 0.15, 
    baseY - size * 0.24, 
    barWidth, 
    size * 0.24, 
    0.5, 
    0.5, 
    'F'
  );
  
  // Barra 3 (azul claro) - alta
  pdf.setFillColor(59, 130, 246); // #3b82f6
  pdf.roundedRect(
    centerX - radius * 0.0, 
    baseY - size * 0.36, 
    barWidth, 
    size * 0.36, 
    0.5, 
    0.5, 
    'F'
  );
  
  // Barra 4 (azul claro) - más alta
  pdf.roundedRect(
    centerX + radius * 0.15, 
    baseY - size * 0.42, 
    barWidth, 
    size * 0.42, 
    0.5, 
    0.5, 
    'F'
  );
  
  // Flecha ascendente (naranja claro)
  pdf.setDrawColor(251, 146, 60); // #fb923c
  pdf.setLineWidth(size * 0.04);
  pdf.setLineCap('round');
  
  // Dibujar la curva de la flecha usando una curva de Bézier cuadrática aproximada
  const arrowStartX = centerX - radius * 0.35;
  const arrowStartY = baseY + size * 0.1;
  const arrowEndX = centerX + radius * 0.35;
  const arrowEndY = centerY - radius * 0.25;
  const controlX = centerX;
  const controlY = centerY;
  
  // Aproximar la curva con líneas
  const arrowSteps = 25;
  for (let i = 0; i < arrowSteps; i++) {
    const t1 = i / arrowSteps;
    const t2 = (i + 1) / arrowSteps;
    
    const x1 = (1 - t1) * (1 - t1) * arrowStartX + 2 * (1 - t1) * t1 * controlX + t1 * t1 * arrowEndX;
    const y1 = (1 - t1) * (1 - t1) * arrowStartY + 2 * (1 - t1) * t1 * controlY + t1 * t1 * arrowEndY;
    const x2 = (1 - t2) * (1 - t2) * arrowStartX + 2 * (1 - t2) * t2 * controlX + t2 * t2 * arrowEndX;
    const y2 = (1 - t2) * (1 - t2) * arrowStartY + 2 * (1 - t2) * t2 * controlY + t2 * t2 * arrowEndY;
    
    pdf.line(x1, y1, x2, y2);
  }
  
  // Punta de la flecha
  const arrowHeadSize = size * 0.06;
  pdf.line(arrowEndX - arrowHeadSize, arrowEndY + arrowHeadSize * 0.8, arrowEndX, arrowEndY);
  pdf.line(arrowEndX, arrowEndY, arrowEndX - arrowHeadSize, arrowEndY - arrowHeadSize * 0.8);
  
  // Restaurar el estado
  pdf.restoreGraphicsState();
};

// Función auxiliar para agregar el encabezado con logo y texto
const addHeaderWithLogo = (pdf: jsPDF, title: string, subtitle?: string): number => {
  const margin = 15;
  const logoSize = 18;
  const logoX = margin;
  const logoY = margin;
  
  // Dibujar el logo
  drawLogo(pdf, logoX, logoY, logoSize);
  
  // Agregar texto del encabezado
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(0, 0, 0);
  pdf.text(title, logoX + logoSize + 5, logoY + 8);
  
  if (subtitle) {
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 100, 100);
    pdf.text(subtitle, logoX + logoSize + 5, logoY + 12);
  }
  
  // Línea separadora
  pdf.setDrawColor(200, 200, 200);
  pdf.line(margin, logoY + logoSize + 5, 210 - margin, logoY + logoSize + 5);
  
  return logoY + logoSize + 10; // Retornar la posición Y después del encabezado
};

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

  const generateProductsPdf = useCallback(async (
    products: Array<{
      productId: number;
      productName: string;
      productSku: string;
      quantity: number;
      amount: number;
      sales: number;
    }>,
    sellerName: string,
    date: string
  ) => {
    try {
      const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-GT', { 
          style: 'currency', 
          currency: 'GTQ' 
        }).format(amount);
      };

      const formatDate = (dateString: string) => {
        return new Date(dateString + 'T00:00:00').toLocaleDateString('es-GT', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      };

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Configuración de márgenes
      const margin = 15;
      const pageWidth = 210;
      const pageHeight = 297;
      
      // Agregar encabezado con logo
      let yPosition = addHeaderWithLogo(
        pdf,
        'REPORTE DIARIO - PRODUCTOS VENDIDOS',
        'Surtidora Katy - Precios a tu alcance...'
      );
      yPosition += 5;

      // Información del reporte
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(0, 0, 0);
      pdf.text(`Vendedor: ${sellerName}`, margin, yPosition);
      yPosition += 6;
      pdf.text(`Fecha: ${formatDate(date)}`, margin, yPosition);
      yPosition += 8;

      // Función para agregar nueva página si es necesario
      const checkNewPage = (requiredHeight: number) => {
        if (yPosition + requiredHeight > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
          return true;
        }
        return false;
      };

      // Línea separadora
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 8;

      // Encabezados de tabla
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Producto', margin, yPosition);
      pdf.text('SKU', margin + 60, yPosition);
      pdf.text('Cantidad', margin + 100, yPosition);
      pdf.text('Ventas', margin + 130, yPosition);
      pdf.text('Total', margin + 160, yPosition);
      yPosition += 5;

      // Línea debajo de encabezados
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 5;

      // Productos
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);

      products.forEach((product, index) => {
        checkNewPage(8);

        // Nombre del producto (puede ser largo, truncar si es necesario)
        const productName = (product.productName || 'Sin nombre').length > 30 
          ? (product.productName || 'Sin nombre').substring(0, 27) + '...' 
          : (product.productName || 'Sin nombre');
        
        pdf.text(productName, margin, yPosition);
        pdf.text(product.productSku || '-', margin + 60, yPosition);
        pdf.text((product.quantity ?? 0).toString(), margin + 100, yPosition, { align: 'right' });
        pdf.text((product.sales ?? 0).toString(), margin + 130, yPosition, { align: 'right' });
        pdf.text(formatCurrency(product.amount ?? 0), margin + 160, yPosition, { align: 'right' });
        
        yPosition += 6;

        // Línea separadora cada 5 productos
        if ((index + 1) % 5 === 0 && index < products.length - 1) {
          pdf.setDrawColor(240, 240, 240);
          pdf.line(margin, yPosition, pageWidth - margin, yPosition);
          yPosition += 3;
        }
      });

      // Totales
      yPosition += 5;
      checkNewPage(15);
      
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 5;

      const totalQuantity = products.reduce((sum, p) => sum + (p.quantity ?? 0), 0);
      const totalSales = products.reduce((sum, p) => sum + (p.sales ?? 0), 0);
      const totalAmount = products.reduce((sum, p) => sum + (p.amount ?? 0), 0);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.text('TOTALES:', margin, yPosition);
      pdf.text(totalQuantity.toString(), margin + 100, yPosition, { align: 'right' });
      pdf.text(totalSales.toString(), margin + 130, yPosition, { align: 'right' });
      pdf.text(formatCurrency(totalAmount), margin + 160, yPosition, { align: 'right' });

      // Pie de página
      yPosition = pageHeight - 15;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(128, 128, 128);
      pdf.text(
        `Generado el ${new Date().toLocaleString('es-GT')}`,
        pageWidth / 2,
        yPosition,
        { align: 'center' }
      );

      return pdf;
    } catch (error) {
      console.error('Error generating products PDF:', error);
      throw error;
    }
  }, []);

  const generateSalesPdf = useCallback(async (
    sales: Array<{
      id: number;
      folio: string;
      customerName: string;
      customerCode: string;
      total: number;
      confirmedAt: string;
      items: Array<{
        productName: string;
        productSku: string;
        quantity: number;
        unitPrice: number;
        total: number;
      }>;
    }>,
    sellerName: string,
    date: string
  ) => {
    try {
      const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-GT', { 
          style: 'currency', 
          currency: 'GTQ' 
        }).format(amount);
      };

      const formatDate = (dateString: string) => {
        return new Date(dateString + 'T00:00:00').toLocaleDateString('es-GT', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      };

      const formatDateTime = (dateString: string) => {
        return new Date(dateString).toLocaleString('es-GT', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
      };

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Configuración de márgenes
      const margin = 15;
      const pageWidth = 210;
      const pageHeight = 297;
      
      // Agregar encabezado con logo
      let yPosition = addHeaderWithLogo(
        pdf,
        'REPORTE DIARIO - VENTAS DEL DÍA',
        'Surtidora Katy - Precios a tu alcance...'
      );
      yPosition += 5;

      // Información del reporte
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(0, 0, 0);
      pdf.text(`Vendedor: ${sellerName}`, margin, yPosition);
      yPosition += 6;
      pdf.text(`Fecha: ${formatDate(date)}`, margin, yPosition);
      yPosition += 6;
      pdf.text(`Total de ventas: ${sales.length}`, margin, yPosition);
      yPosition += 8;

      // Función para agregar nueva página si es necesario
      const checkNewPage = (requiredHeight: number) => {
        if (yPosition + requiredHeight > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
          return true;
        }
        return false;
      };

      // Línea separadora
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 8;

      // Iterar sobre cada venta
      sales.forEach((sale, saleIndex) => {
        checkNewPage(30);

        // Encabezado de venta
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(0, 0, 0);
        pdf.text(`Venta #${saleIndex + 1}`, margin, yPosition);
        yPosition += 6;

        // Información de la venta
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Folio: ${sale.folio || 'N/A'}`, margin, yPosition);
        pdf.text(`Cliente: ${sale.customerName || 'N/A'}`, margin + 70, yPosition);
        yPosition += 5;
        pdf.text(`Código: ${sale.customerCode || 'N/A'}`, margin, yPosition);
        pdf.text(`Fecha: ${sale.confirmedAt ? formatDateTime(sale.confirmedAt) : 'N/A'}`, margin + 70, yPosition);
        yPosition += 5;
        pdf.text(`Total: ${formatCurrency(sale.total ?? 0)}`, margin, yPosition);
        yPosition += 5;

        // Encabezados de productos
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.text('Producto', margin, yPosition);
        pdf.text('Cant.', margin + 100, yPosition);
        pdf.text('Precio', margin + 120, yPosition);
        pdf.text('Total', margin + 160, yPosition);
        yPosition += 4;

        // Línea debajo de encabezados
        pdf.setDrawColor(220, 220, 220);
        pdf.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 4;

        // Productos de la venta
        pdf.setFont('helvetica', 'normal');
        (sale.items || []).forEach((item) => {
          checkNewPage(6);
          
          const productName = (item.productName || 'Sin nombre').length > 35 
            ? (item.productName || 'Sin nombre').substring(0, 32) + '...' 
            : (item.productName || 'Sin nombre');
          
          pdf.text(productName, margin, yPosition);
          pdf.text((item.quantity ?? 0).toString(), margin + 100, yPosition, { align: 'right' });
          pdf.text(formatCurrency(item.unitPrice ?? 0), margin + 120, yPosition, { align: 'right' });
          pdf.text(formatCurrency(item.total ?? 0), margin + 160, yPosition, { align: 'right' });
          yPosition += 5;
        });

        yPosition += 3;

        // Línea separadora entre ventas
        if (saleIndex < sales.length - 1) {
          pdf.setDrawColor(200, 200, 200);
          pdf.line(margin, yPosition, pageWidth - margin, yPosition);
          yPosition += 5;
        }
      });

      // Totales al final
      yPosition += 5;
      checkNewPage(10);
      
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 5;

      const totalAmount = sales.reduce((sum, s) => sum + (s.total ?? 0), 0);
      const totalItems = sales.reduce((sum, s) => 
        sum + (s.items || []).reduce((itemSum, item) => itemSum + (item.quantity ?? 0), 0), 0
      );

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.text(`Total de ventas: ${sales.length}`, margin, yPosition);
      pdf.text(`Total de productos: ${totalItems}`, margin + 70, yPosition);
      pdf.text(`Monto total: ${formatCurrency(totalAmount)}`, margin + 130, yPosition, { align: 'right' });

      // Pie de página
      yPosition = pageHeight - 15;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(128, 128, 128);
      pdf.text(
        `Generado el ${new Date().toLocaleString('es-GT')}`,
        pageWidth / 2,
        yPosition,
        { align: 'center' }
      );

      return pdf;
    } catch (error) {
      console.error('Error generating sales PDF:', error);
      throw error;
    }
  }, []);

  return {
    generateInvoicePdf,
    generateProductsPdf,
    generateSalesPdf
  };
};
