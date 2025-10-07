// pos-app/src/components/sales/SaleTotals.tsx
import type { SaleDraft } from '../../types/sales';

type SaleTotalsProps = {
  sale: SaleDraft;
  onNotesChange?: (notes: string) => void;
};

export default function SaleTotals({ sale, onNotesChange }: SaleTotalsProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-GT', {
      style: 'currency',
      currency: 'GTQ'
    }).format(price);
  };

  const itemCount = sale.items.length;
  const totalItems = sale.items.reduce((sum, item) => sum + item.qty, 0);

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card bg-blue-50 border-blue-200">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{itemCount}</div>
            <div className="text-sm text-blue-700">Productos</div>
          </div>
        </div>
        
        <div className="card bg-purple-50 border-purple-200">
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{totalItems}</div>
            <div className="text-sm text-purple-700">Unidades</div>
          </div>
        </div>
        
        <div className="card bg-green-50 border-green-200">
          <div className="text-center">
            <div className="text-lg font-bold text-green-600">{formatPrice(sale.subtotal)}</div>
            <div className="text-sm text-green-700">Subtotal</div>
          </div>
        </div>
        
        <div className="card bg-orange-50 border-orange-200">
          <div className="text-center">
            <div className="text-lg font-bold text-orange-600">{formatPrice(sale.taxTotal)}</div>
            <div className="text-sm text-orange-700">Impuestos</div>
          </div>
        </div>
      </div>

      {/* Detailed Totals */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumen de Totales</h3>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-600">Subtotal:</span>
            <span className="font-medium text-gray-900">{formatPrice(sale.subtotal)}</span>
          </div>
          
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-600">Impuestos:</span>
            <span className="font-medium text-gray-900">{formatPrice(sale.taxTotal)}</span>
          </div>
          
          <div className="border-t border-gray-200 pt-3">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-900">Total General:</span>
              <span className="text-2xl font-bold text-green-600">{formatPrice(sale.grandTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notes Section */}
      {onNotesChange && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Notas</h3>
          <textarea
            value={sale.notes || ''}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Agregar notas o comentarios sobre la venta..."
            className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>
      )}

      {/* Sale Info */}
      <div className="card bg-gray-50">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Información de la Venta</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">ID de Venta:</span>
            <div className="font-mono text-xs text-gray-800 break-all">{sale.id}</div>
          </div>
          
          <div>
            <span className="text-gray-600">Estado:</span>
            <div className="mt-1">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                BORRADOR
              </span>
            </div>
          </div>
          
          <div>
            <span className="text-gray-600">Creado:</span>
            <div className="text-gray-800">
              {new Date(sale.createdAt).toLocaleString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          </div>
          
          <div>
            <span className="text-gray-600">Última actualización:</span>
            <div className="text-gray-800">
              {new Date(sale.updatedAt).toLocaleString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          </div>
          
          {sale.customerName && (
            <>
              <div>
                <span className="text-gray-600">Cliente:</span>
                <div className="text-gray-800 font-medium">{sale.customerName}</div>
              </div>
              
              <div>
                <span className="text-gray-600">Código Cliente:</span>
                <div className="text-gray-800">#{sale.customerCode}</div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


