// pos-app/src/components/sales/ConflictReviewModal.tsx
import { useState } from 'react';

interface ConflictSale {
  id: number;
  uuid: string;
  folio: string;
  status: 'REVIEW_REQUIRED';
  customerId: number;
  customer: {
    id: number;
    name: string;
    code: string;
  };
  seller: {
    id: number;
    fullName: string;
    username: string;
  };
  warehouse: {
    id: number;
    name: string;
  };
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  items: Array<{
    id: number;
    productId: number;
    product: {
      id: number;
      name: string;
      sku: string;
    };
    unitCode: string;
    qty: number;
    qtyBase: number;
    priceUnit: number;
    discount: number;
    lineTotal: number;
    availableStock?: number;
    requiredStock?: number;
    stockShortage?: number;
  }>;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  lastError?: string;
  retryCount: number;
}

interface ConflictReviewAction {
  action: 'EDIT_QUANTITIES' | 'CANCEL';
  saleId: number;
  items?: Array<{
    id: number;
    newQty?: number;
    newQtyBase?: number;
  }>;
  notes?: string;
}

interface ConflictReviewModalProps {
  sale: ConflictSale;
  onClose: () => void;
  onResolve: (action: ConflictReviewAction) => void;
  isLoading: boolean;
}

export default function ConflictReviewModal({ sale, onClose, onResolve, isLoading }: ConflictReviewModalProps) {
  const [selectedAction, setSelectedAction] = useState<'EDIT_QUANTITIES' | 'CANCEL' | null>(null);
  const [editedItems, setEditedItems] = useState<Record<number, { qty: number; qtyBase: number }>>({});
  const [notes, setNotes] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-GT', {
      style: 'currency',
      currency: 'GTQ'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-GT', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleItemEdit = (itemId: number, field: 'qty' | 'qtyBase', value: number) => {
    setEditedItems(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value,
        // Si se edita qty, recalcular qtyBase
        ...(field === 'qty' ? {
          qtyBase: value * (sale.items.find(i => i.id === itemId)?.qtyBase || 1) / (sale.items.find(i => i.id === itemId)?.qty || 1)
        } : {}),
        // Si se edita qtyBase, recalcular qty
        ...(field === 'qtyBase' ? {
          qty: value / ((sale.items.find(i => i.id === itemId)?.qtyBase || 1) / (sale.items.find(i => i.id === itemId)?.qty || 1))
        } : {})
      }
    }));
  };

  // Calcular el nuevo precio total de un item
  const calculateNewItemTotal = (item: any, editedItem?: { qty: number; qtyBase: number }) => {
    if (!editedItem) return item.lineTotal;
    return editedItem.qty * item.priceUnit;
  };

  // Calcular el nuevo total de la venta
  const calculateNewSaleTotal = () => {
    let subtotal = 0;
    let taxTotal = 0;

    sale.items.forEach(item => {
      const editedItem = editedItems[item.id];
      const itemTotal = calculateNewItemTotal(item, editedItem);
      subtotal += itemTotal;

      // Calcular impuestos por producto (asumiendo 12% de IVA por defecto)
      const taxRate = 0.12; // 12% de IVA
      taxTotal += itemTotal * taxRate;
    });

    return {
      subtotal,
      taxTotal,
      grandTotal: subtotal + taxTotal
    };
  };

  const handleActionSelect = (action: 'EDIT_QUANTITIES' | 'CANCEL') => {
    setSelectedAction(action);
    if (action === 'EDIT_QUANTITIES') {
      // Inicializar edición de items
      const initialItems: Record<number, { qty: number; qtyBase: number }> = {};
      sale.items.forEach(item => {
        initialItems[item.id] = { qty: item.qty, qtyBase: item.qtyBase };
      });
      setEditedItems(initialItems);
    }
  };

  const handleConfirm = () => {
    if (!selectedAction) return;

    const action: ConflictReviewAction = {
      action: selectedAction,
      saleId: sale.id,
      notes: notes.trim() || undefined
    };

    if (selectedAction === 'EDIT_QUANTITIES') {
      action.items = Object.entries(editedItems).map(([itemId, values]) => ({
        id: parseInt(itemId),
        newQty: values.qty,
        newQtyBase: values.qtyBase
      }));
    }

    onResolve(action);
  };

  const getActionDescription = (action: string) => {
    switch (action) {
      case 'EDIT_QUANTITIES':
        return 'Editar cantidades de productos y confirmar';
      case 'CANCEL':
        return 'Cancelar la venta definitivamente';
      default:
        return '';
    }
  };

  const getActionIcon = (action: string | null) => {
    switch (action) {
      case null:
        return null;
      case 'EDIT_QUANTITIES':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        );
      case 'CANCEL':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-gray-900">
            Revisar Venta #{sale.folio}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={isLoading}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Sale Details */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Cliente</p>
              <p className="font-medium text-gray-900">{sale.customer.name}</p>
              <p className="text-sm text-gray-500">{sale.customer.code}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Vendedor</p>
              <p className="font-medium text-gray-900">{sale.seller.fullName}</p>
              <p className="text-sm text-gray-500">@{sale.seller.username}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Fecha</p>
              <p className="font-medium text-gray-900">{formatDate(sale.createdAt)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total</p>
              {selectedAction === 'EDIT_QUANTITIES' && Object.keys(editedItems).length > 0 ? (
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500 line-through">
                      {formatCurrency(sale.grandTotal)}
                    </span>
                    <span className="font-medium text-gray-900">
                      {formatCurrency(calculateNewSaleTotal().grandTotal)}
                    </span>
                  </div>
                  <div className="text-xs text-blue-600 mt-1">
                    Nuevo total
                  </div>
                </div>
              ) : (
                <p className="font-medium text-gray-900">{formatCurrency(sale.grandTotal)}</p>
              )}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {sale.lastError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex">
              <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-red-800">Error Detectado</h4>
                <p className="text-sm text-red-700 mt-1">{sale.lastError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Items List */}
        <div className="mb-6">
          <h4 className="text-lg font-medium text-gray-900 mb-4">Productos</h4>
          <div className="space-y-3">
            {sale.items.map((item) => {
              const editedItem = editedItems[item.id];
              const currentQty = editedItem?.qty ?? item.qty;
              const currentQtyBase = editedItem?.qtyBase ?? item.qtyBase;
              const hasStockIssue = item.stockShortage && item.stockShortage > 0;

              return (
                <div key={item.id} className={`p-4 border rounded-lg ${hasStockIssue ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <h5 className="font-medium text-gray-900">{item.product.name}</h5>
                      <p className="text-sm text-gray-500">{item.product.sku}</p>
                    </div>
                    <div className="text-right">
                      {selectedAction === 'EDIT_QUANTITIES' && editedItem ? (
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-500 line-through">
                              {formatCurrency(item.lineTotal)}
                            </span>
                            <span className="font-medium text-gray-900">
                              {formatCurrency(calculateNewItemTotal(item, editedItem))}
                            </span>
                          </div>
                          <div className="text-xs text-blue-600 mt-1">
                            Nuevo total
                          </div>
                        </div>
                      ) : (
                        <p className="font-medium text-gray-900">{formatCurrency(item.lineTotal)}</p>
                      )}
                      {hasStockIssue && (
                        <p className="text-sm text-red-600">
                          Faltan {item.stockShortage} {item.unitCode}
                        </p>
                      )}
                    </div>
                  </div>

                  {selectedAction === 'EDIT_QUANTITIES' && (
                    <div className="mt-3 grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Cantidad ({item.unitCode})
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={currentQty}
                          onChange={(e) => handleItemEdit(item.id, 'qty', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Cantidad Base (UND)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={currentQtyBase}
                          onChange={(e) => handleItemEdit(item.id, 'qtyBase', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  )}

                  <div className="mt-2 text-sm text-gray-600">
                    <span className="font-medium">Precio:</span> {formatCurrency(item.priceUnit)} c/u • 
                    <span className="font-medium ml-1">Stock disponible:</span> {item.availableStock || 0} UND
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Resumen de Cambios - Solo cuando se editan cantidades */}
        {selectedAction === 'EDIT_QUANTITIES' && Object.keys(editedItems).length > 0 && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-lg font-medium text-blue-900 mb-3">Resumen de Cambios</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-blue-700">Subtotal</p>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500 line-through">
                    {formatCurrency(sale.subtotal)}
                  </span>
                  <span className="font-medium text-blue-900">
                    {formatCurrency(calculateNewSaleTotal().subtotal)}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm text-blue-700">Impuestos</p>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500 line-through">
                    {formatCurrency(sale.taxTotal)}
                  </span>
                  <span className="font-medium text-blue-900">
                    {formatCurrency(calculateNewSaleTotal().taxTotal)}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm text-blue-700">Total</p>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500 line-through">
                    {formatCurrency(sale.grandTotal)}
                  </span>
                  <span className="font-medium text-blue-900 text-lg">
                    {formatCurrency(calculateNewSaleTotal().grandTotal)}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-3 text-sm text-blue-600">
              💡 Los cambios se aplicarán al confirmar la acción
            </div>
          </div>
        )}

        {/* Stock Information */}
        {!showConfirm && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-blue-800">¿Necesitas agregar stock?</h4>
                <p className="text-sm text-blue-700 mt-1">
                  Si necesitas agregar stock a los productos, ve al módulo de <strong>Inventario</strong> 
                  para gestionar las existencias antes de resolver este conflicto.
                </p>
                <button
                  onClick={() => {
                    // Redirigir al módulo de inventario
                    window.location.href = '/inventory';
                  }}
                  className="mt-2 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  Ir a Inventario
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Action Selection */}
        {!showConfirm && (
          <div className="mb-6">
            <h4 className="text-lg font-medium text-gray-900 mb-4">Seleccionar Acción</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { action: 'EDIT_QUANTITIES', label: 'Editar Cantidades', color: 'yellow' },
                { action: 'CANCEL', label: 'Cancelar Venta', color: 'red' }
              ].map(({ action, label, color }) => (
                <button
                  key={action}
                  onClick={() => handleActionSelect(action as any)}
                  className={`p-4 border-2 rounded-lg text-left transition-colors ${
                    selectedAction === action
                      ? `border-${color}-500 bg-${color}-50`
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center">
                    <div className={`p-2 rounded-lg mr-3 ${
                      selectedAction === action ? `bg-${color}-100` : 'bg-gray-100'
                    }`}>
                      {getActionIcon(action)}
                    </div>
                    <div>
                      <h5 className="font-medium text-gray-900">{label}</h5>
                      <p className="text-sm text-gray-600">{getActionDescription(action)}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notas (opcional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Agregar comentarios sobre la resolución..."
            disabled={isLoading}
          />
        </div>

        {/* Confirmation */}
        {showConfirm && selectedAction && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex">
              <svg className="w-5 h-5 text-yellow-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-yellow-800">Confirmar Acción</h4>
                <p className="text-sm text-yellow-700 mt-1">
                  {getActionDescription(selectedAction)}
                </p>
                {selectedAction === 'CANCEL' && (
                  <p className="text-sm text-red-700 mt-1 font-medium">
                    ⚠️ Esta acción cancelará la venta definitivamente y no se puede deshacer.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="btn-outline"
            disabled={isLoading}
          >
            Cancelar
          </button>
          
          {!showConfirm ? (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={!selectedAction || isLoading}
              className="btn-primary"
            >
              Continuar
            </button>
          ) : (
            <div className="flex space-x-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="btn-outline"
                disabled={isLoading}
              >
                Atrás
              </button>
              <button
                onClick={handleConfirm}
                disabled={isLoading}
                className={`btn-primary ${selectedAction === 'CANCEL' ? 'bg-red-600 hover:bg-red-700' : ''}`}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Procesando...
                  </>
                ) : (
                  <>
                    {getActionIcon(selectedAction)}
                    <span className="ml-2">
                      {selectedAction === 'CANCEL' ? 'Cancelar Venta' : 'Confirmar'}
                    </span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


