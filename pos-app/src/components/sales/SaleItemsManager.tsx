// pos-app/src/components/sales/SaleItemsManager.tsx
import { useState } from 'react';
import type { SaleItem, UnitCode } from '../../types/sales';

type SaleItemsManagerProps = {
  items: SaleItem[];
  onUpdateItem: (itemId: string, updates: Partial<SaleItem>) => void;
  onRemoveItem: (itemId: string) => void;
};

export default function SaleItemsManager({ items, onUpdateItem, onRemoveItem }: SaleItemsManagerProps) {
  const [editingItem, setEditingItem] = useState<string | null>(null);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-GT', {
      style: 'currency',
      currency: 'GTQ'
    }).format(price);
  };

  const handleQuantityChange = (itemId: string, newQty: number) => {
    if (newQty <= 0) return;
    onUpdateItem(itemId, { qty: newQty });
  };

  const handleUnitChange = (itemId: string, newUnitCode: UnitCode) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const newUnit = item.availableUnits.find(u => u.unitCode === newUnitCode);
    if (!newUnit) return;

    // Recalcular precio por unidad basado en la nueva unidad
    const basePrice = item.priceUnit / item.unitFactor; // precio base por UND
    const newPriceUnit = basePrice * newUnit.factor;

    onUpdateItem(itemId, { 
      unitCode: newUnitCode,
      unitFactor: newUnit.factor,
      priceUnit: newPriceUnit
    });
  };

  const handleDiscountChange = (itemId: string, newDiscount: number) => {
    if (newDiscount < 0) return;
    onUpdateItem(itemId, { discount: newDiscount });
  };

  const startEditing = (itemId: string) => {
    setEditingItem(itemId);
  };

  const stopEditing = () => {
    setEditingItem(null);
  };

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
        <div className="text-center">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M8 11v6h8v-6M8 11H6a2 2 0 00-2 2v6a2 2 0 002 2h12a2 2 0 002-2v-6a2 2 0 00-2-2h-2" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Sin productos agregados</h3>
          <p className="text-gray-500 mb-4">Busca y agrega productos para comenzar la venta</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Productos ({items.length})
        </h3>
        <div className="text-sm text-gray-500">
          Total items: {items.reduce((sum, item) => sum + item.qty, 0).toFixed(2)}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Header - Solo visible en desktop */}
        <div className="hidden lg:block bg-gray-50 px-6 py-3 border-b border-gray-200">
          <div className="grid grid-cols-12 gap-4 text-xs font-semibold text-gray-600 uppercase tracking-wide">
            <div className="col-span-4">Producto</div>
            <div className="col-span-2">Unidad</div>
            <div className="col-span-2">Cantidad</div>
            <div className="col-span-2">P. Unit</div>
            <div className="col-span-1">Desc.</div>
            <div className="col-span-1">Acciones</div>
          </div>
        </div>

        {/* Items */}
        <div className="divide-y divide-gray-100">
          {items.map((item) => (
            <div key={item.id} className="p-4 lg:p-6 hover:bg-gray-50 transition-colors">
              {/* Vista móvil */}
              <div className="lg:hidden space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center flex-1 min-w-0">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mr-3 shadow-sm flex-shrink-0">
                      <span className="text-white font-bold text-xs">
                        {item.productName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 truncate">{item.productName}</p>
                      <p className="text-sm text-gray-500">SKU: {item.productSku}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onRemoveItem(item.id)}
                    className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Unidad</label>
                    {editingItem === item.id ? (
                      <select
                        value={item.unitCode}
                        onChange={(e) => handleUnitChange(item.id, e.target.value as UnitCode)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        onBlur={stopEditing}
                        autoFocus
                      >
                        {item.availableUnits.map((unit) => (
                          <option key={unit.unitCode} value={unit.unitCode}>
                            {unit.unitName || unit.unitCode} {unit.factor > 1 && `(${unit.factor})`}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <button
                        onClick={() => startEditing(item.id)}
                        className="w-full px-3 py-2 text-sm font-medium text-gray-900 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors text-left"
                      >
                        {item.availableUnits.find(u => u.unitCode === item.unitCode)?.unitName || item.unitCode}
                        {item.unitFactor > 1 && <span className="text-gray-500 ml-1">({item.unitFactor})</span>}
                      </button>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Cantidad</label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.qty}
                      onChange={(e) => handleQuantityChange(item.id, parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Precio Unit.</label>
                    <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm font-medium text-gray-900">
                      {formatPrice(item.priceUnit)}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Descuento</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.discount}
                      onChange={(e) => handleDiscountChange(item.id, parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>
                
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-500">Subtotal:</span>
                    <span className="text-lg font-bold text-gray-900">
                      {formatPrice((item.priceUnit * item.qty) - item.discount)}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Vista desktop */}
              <div className="hidden lg:grid grid-cols-12 gap-4 items-center">
                {/* Producto */}
                <div className="col-span-4">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mr-3 shadow-sm">
                      <span className="text-white font-bold text-xs">
                        {item.productName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 truncate">{item.productName}</p>
                      <p className="text-sm text-gray-500">SKU: {item.productSku}</p>
                    </div>
                  </div>
                </div>

                {/* Unidad */}
                <div className="col-span-2">
                  {editingItem === item.id ? (
                    <select
                      value={item.unitCode}
                      onChange={(e) => handleUnitChange(item.id, e.target.value as UnitCode)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      onBlur={stopEditing}
                      autoFocus
                    >
                      {item.availableUnits.map((unit) => (
                        <option key={unit.unitCode} value={unit.unitCode}>
                          {unit.unitName || unit.unitCode} {unit.factor > 1 && `(${unit.factor})`}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <button
                      onClick={() => startEditing(item.id)}
                      className="text-left w-full px-3 py-2 text-sm font-medium text-gray-900 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors"
                    >
                      {item.availableUnits.find(u => u.unitCode === item.unitCode)?.unitName || item.unitCode}
                      {item.unitFactor > 1 && <span className="text-gray-500 ml-1">({item.unitFactor})</span>}
                    </button>
                  )}
                </div>

                {/* Cantidad */}
                <div className="col-span-2">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={item.qty}
                    onChange={(e) => handleQuantityChange(item.id, parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-semibold text-center"
                  />
                </div>

                {/* Precio Unitario */}
                <div className="col-span-2">
                  <div className="text-sm font-semibold text-gray-900">
                    {formatPrice(item.priceUnit)}
                  </div>
                  <div className="text-xs text-gray-500">
                    por {item.unitCode}
                  </div>
                </div>

                {/* Descuento */}
                <div className="col-span-1">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.discount}
                    onChange={(e) => handleDiscountChange(item.id, parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs text-center"
                    placeholder="0.00"
                  />
                </div>

                {/* Acciones */}
                <div className="col-span-1">
                  <div className="flex items-center justify-center">
                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar producto"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Línea total */}
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-500">
                    {item.qty} × {formatPrice(item.priceUnit)} 
                    {item.discount > 0 && ` - ${formatPrice(item.discount)} desc.`}
                  </div>
                  <div className="text-lg font-bold text-gray-900">
                    {formatPrice(item.lineTotal)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}






