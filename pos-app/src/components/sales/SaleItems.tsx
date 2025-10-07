// pos-app/src/components/sales/SaleItems.tsx
import { useState } from 'react';
import type { SaleItem, UnitCode } from '../../types/sales';

type SaleItemsProps = {
  items: SaleItem[];
  onUpdateItem: (itemId: string, updates: Partial<SaleItem>) => void;
  onRemoveItem: (itemId: string) => void;
};

export default function SaleItems({ items, onUpdateItem, onRemoveItem }: SaleItemsProps) {
  const [editingItem, setEditingItem] = useState<string | null>(null);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-GT', {
      style: 'currency',
      currency: 'GTQ'
    }).format(price);
  };

  const handleQuantityChange = (itemId: string, newQty: number) => {
    if (newQty > 0) {
      onUpdateItem(itemId, { qty: newQty });
    }
  };

  const handleUnitChange = (itemId: string, newUnitCode: UnitCode) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const newUnit = item.availableUnits.find(u => u.unitCode === newUnitCode);
    if (!newUnit) return;

    // Calcular nuevo precio unitario basado en la nueva unidad
    const basePrice = item.priceUnit / item.unitFactor; // precio base por UND
    const newPriceUnit = basePrice * newUnit.factor;

    onUpdateItem(itemId, {
      unitCode: newUnitCode,
      unitFactor: newUnit.factor,
      priceUnit: newPriceUnit,
    });
  };

  const handleDiscountChange = (itemId: string, newDiscount: number) => {
    onUpdateItem(itemId, { discount: Math.max(0, newDiscount) });
  };

  if (items.length === 0) {
    return (
      <div className="card text-center py-8">
        <svg className="mx-auto w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
        <p className="text-gray-500 text-lg">No hay productos en la venta</p>
        <p className="text-gray-400 mt-1">Busca y agrega productos para comenzar</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Items de Venta ({items.length})
        </h3>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Producto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unidad
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cantidad
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Precio Unit.
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Descuento
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{item.productName}</div>
                      <div className="text-sm text-gray-500">SKU: {item.productSku}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingItem === item.id ? (
                      <select
                        value={item.unitCode}
                        onChange={(e) => handleUnitChange(item.id, e.target.value as UnitCode)}
                        className="text-sm border rounded px-2 py-1 w-20"
                        onBlur={() => setEditingItem(null)}
                        autoFocus
                      >
                        {item.availableUnits.map((unit) => (
                          <option key={unit.unitCode} value={unit.unitCode}>
                            {unit.unitCode}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <button
                        onClick={() => setEditingItem(item.id)}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        {item.unitCode}
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.qty}
                      onChange={(e) => handleQuantityChange(item.id, parseFloat(e.target.value) || 0)}
                      className="text-sm border rounded px-2 py-1 w-20 text-center"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatPrice(item.priceUnit)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.discount}
                      onChange={(e) => handleDiscountChange(item.id, parseFloat(e.target.value) || 0)}
                      className="text-sm border rounded px-2 py-1 w-20 text-center"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                    {formatPrice(item.lineTotal)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className="text-red-600 hover:text-red-800"
                      title="Eliminar item"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {items.map((item) => (
          <div key={item.id} className="card">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">{item.productName}</h4>
                <p className="text-sm text-gray-500">SKU: {item.productSku}</p>
              </div>
              <button
                onClick={() => onRemoveItem(item.id)}
                className="text-red-600 hover:text-red-800 ml-2"
                title="Eliminar item"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <label className="block text-gray-600 mb-1">Unidad</label>
                <select
                  value={item.unitCode}
                  onChange={(e) => handleUnitChange(item.id, e.target.value as UnitCode)}
                  className="w-full border rounded px-2 py-1"
                >
                  {item.availableUnits.map((unit) => (
                    <option key={unit.unitCode} value={unit.unitCode}>
                      {unit.unitCode}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-600 mb-1">Cantidad</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={item.qty}
                  onChange={(e) => handleQuantityChange(item.id, parseFloat(e.target.value) || 0)}
                  className="w-full border rounded px-2 py-1 text-center"
                />
              </div>

              <div>
                <label className="block text-gray-600 mb-1">Precio Unit.</label>
                <div className="font-medium text-gray-900">{formatPrice(item.priceUnit)}</div>
              </div>

              <div>
                <label className="block text-gray-600 mb-1">Descuento</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.discount}
                  onChange={(e) => handleDiscountChange(item.id, parseFloat(e.target.value) || 0)}
                  className="w-full border rounded px-2 py-1 text-center"
                />
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
              <span className="text-sm text-gray-600">Total línea:</span>
              <span className="text-lg font-semibold text-green-600">
                {formatPrice(item.lineTotal)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


