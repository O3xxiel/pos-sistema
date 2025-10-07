// pos-app/src/components/sales/ProductSearch.tsx
import { useState, useEffect, useCallback, useRef, memo, forwardRef, useImperativeHandle } from 'react';
import { db } from '../../offline/db';
import { useStock } from '../../hooks/useStock';
import { useNetwork } from '../../shared/useNetwork';
import type { ProductForSale, UnitCode } from '../../types/sales';

type ProductSearchProps = {
  onProductAdd: (product: ProductForSale, unitCode: UnitCode, qty: number) => void;
};

export type ProductSearchRef = {
  reset: () => void;
};

const ProductSearch = forwardRef<ProductSearchRef, ProductSearchProps>(({ onProductAdd }, ref) => {
  const [products, setProducts] = useState<ProductForSale[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<ProductForSale | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<UnitCode>('UNIDAD');
  const [quantity, setQuantity] = useState<number>(1);
  const [baseQuantity, setBaseQuantity] = useState<number>(1); // Cantidad en unidades base
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Refs para mantener el estado estable
  const searchQueryRef = useRef(searchQuery);
  const productsRef = useRef(products);
  
  // Hook para obtener stock y estado de red
  const { getProductStock, hasEnoughStock, loading: stockLoading } = useStock();
  const { online } = useNetwork();

  // Estabilizar referencias
  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  // Exponer función de reset
  useImperativeHandle(ref, () => ({
    reset: () => {
      setSearchQuery('');
      setProducts([]);
      setSelectedProduct(null);
      setSelectedUnit('UNIDAD');
      setQuantity(1);
      setBaseQuantity(1);
      setIsSearchOpen(false);
      setLoading(false);
    }
  }), []);

  useEffect(() => {
    // Debounce la búsqueda para evitar demasiadas llamadas
    const timeoutId = setTimeout(() => {
      if (searchQuery.length >= 2) {
        searchProducts();
      } else {
        setProducts([]);
      }
    }, 300); // Esperar 300ms después de que el usuario pare de escribir

    return () => clearTimeout(timeoutId);
  }, [searchQuery]); // Remover searchProducts de las dependencias

  const searchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const query = searchQueryRef.current.toLowerCase();
      // Obtener todos los productos y filtrar en JavaScript
      const allProducts = await db.catalog_products.toArray();
      const results = allProducts
        .filter(p => 
          p.isActive === true && (
            p.name.toLowerCase().includes(query) ||
            p.sku.toLowerCase().includes(query) ||
            (p.barcode && p.barcode.toLowerCase().includes(query))
          )
        )
        .slice(0, 20); // Limitar a 20 resultados

      const productsForSale: ProductForSale[] = results.map(p => {
        console.log(`🔍 Mapeando producto para venta: ${p.name}`, {
          id: p.id,
          sku: p.sku,
          units: p.units,
          unitsLength: p.units?.length || 0
        });
        return {
          id: p.id,
          sku: p.sku,
          name: p.name,
          barcode: p.barcode,
          unitBase: p.unitBase,
          priceBase: p.priceBase,
          taxRate: p.taxRate,
          isActive: p.isActive,
          units: p.units,
        };
      });

      setProducts(productsForSale);
    } catch (error) {
      console.error('Error searching products:', error);
    } finally {
      setLoading(false);
    }
  }, []); // Sin dependencias para mantenerlo estable

  const handleProductSelect = (product: ProductForSale) => {
    console.log('🔍 Producto seleccionado:', {
      name: product.name,
      sku: product.sku,
      unitBase: product.unitBase,
      units: product.units,
      unitsLength: product.units?.length || 0
    });
    
    // Solo usar las unidades que realmente están asignadas al producto
    const availableUnits = product.units && product.units.length > 0 
      ? product.units 
      : [{ unitCode: product.unitBase, unitName: product.unitBase, factor: 1 }];
    
    console.log('🔧 Unidades disponibles:', availableUnits);
    
    // Actualizar el producto con las unidades disponibles
    const productWithUnits = {
      ...product,
      units: availableUnits
    };
    
    setSelectedProduct(productWithUnits);
    setSelectedUnit(product.unitBase);
    setQuantity(1);
    setBaseQuantity(1);
    setIsSearchOpen(false);
  };

  const handleAddProduct = useCallback(() => {
    if (selectedProduct && quantity > 0) {
      // Solo verificar stock si estamos online
      if (online) {
        const availableStock = getProductStock(selectedProduct.id);
        
        if (baseQuantity > availableStock) {
          alert(`Stock insuficiente. Disponible: ${availableStock} ${selectedProduct.unitBase}`);
          return;
        }
      }
      
      onProductAdd(selectedProduct, selectedUnit, quantity);
      
      // Reset solo el producto seleccionado, mantener la búsqueda activa
      setSelectedProduct(null);
      setSelectedUnit('UNIDAD');
      setQuantity(1);
      setBaseQuantity(1);
      
      // Mantener el input de búsqueda para agregar más productos
      // No limpiar searchQuery ni products para facilitar agregar múltiples productos
    }
  }, [selectedProduct, selectedUnit, quantity, baseQuantity, getProductStock, onProductAdd, online]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-GT', {
      style: 'currency',
      currency: 'GTQ'
    }).format(price);
  };

  const getUnitPrice = (product: ProductForSale, unitCode: UnitCode) => {
    const unit = product.units.find(u => u.unitCode === unitCode) || 
                 { unitCode: product.unitBase, unitName: 'Unidad', factor: 1 };
    return product.priceBase * unit.factor;
  };

  // Calcular precio unitario actual
  const currentUnitPrice = selectedProduct ? getUnitPrice(selectedProduct, selectedUnit) : 0;

  return (
    <div className="space-y-4">
      {/* Product Search */}
      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Buscar Producto
        </label>
        
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Buscar por nombre, SKU o código de barras..."
            className={`w-full px-4 py-3 pl-10 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white placeholder-gray-500 ${
              loading ? 'animate-pulse' : ''
            }`}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsSearchOpen(true);
            }}
            onFocus={() => setIsSearchOpen(true)}
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setProducts([]);
                setIsSearchOpen(false);
              }}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {isSearchOpen && searchQuery.length >= 2 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 overflow-hidden">
            <div className="max-h-80 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-gray-500">
                  <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                  Buscando productos...
                </div>
              ) : products.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No se encontraron productos
                </div>
              ) : (
                products.map((product) => {
                  const availableStock = getProductStock(product.id);
                  const stockStatus = availableStock > 0 ? 'available' : 'out-of-stock';
                  
                  return (
                    <div
                      key={product.id}
                      onClick={() => handleProductSelect(product)}
                      className={`p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 ${
                        stockStatus === 'out-of-stock' ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{product.name}</div>
                          <div className="text-sm text-gray-500">
                            SKU: {product.sku} • {product.unitBase} • {formatPrice(product.priceBase)}
                          </div>
                          {product.barcode && (
                            <div className="text-xs text-gray-400">Código: {product.barcode}</div>
                          )}
                        </div>
                        <div className="ml-4 text-right">
                          <div className="text-sm font-semibold text-gray-900">
                            Stock: {stockLoading ? '...' : availableStock} {product.unitBase}
                          </div>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            stockStatus === 'available' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {stockStatus === 'available' ? 'Disponible' : 'Sin Stock'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Backdrop */}
        {isSearchOpen && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsSearchOpen(false)}
          />
        )}
      </div>

      {/* Selected Product Form */}
      {selectedProduct && (
        <div className="card bg-blue-50 border-blue-200">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">{selectedProduct.name}</h3>
              <p className="text-sm text-gray-600">SKU: {selectedProduct.sku}</p>
              <div className="mt-2 flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-700">Stock disponible:</span>
                <span className="text-sm font-bold text-green-600">
                  {stockLoading ? 'Cargando...' : `${getProductStock(selectedProduct.id)} ${selectedProduct.unitBase}`}
                </span>
              </div>
            </div>
            <button
              onClick={() => setSelectedProduct(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Unit Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Unidad
              </label>
              <select
                value={selectedUnit}
                onChange={(e) => {
                  const newUnitCode = e.target.value as UnitCode;
                  const newUnit = selectedProduct.units.find(u => u.unitCode === newUnitCode) || 
                                { unitCode: selectedProduct.unitBase, unitName: 'Unidad', factor: 1 };
                  const currentUnit = selectedProduct.units.find(u => u.unitCode === selectedUnit) || 
                                    { unitCode: selectedProduct.unitBase, unitName: 'Unidad', factor: 1 };
                  
                  // Calcular la nueva cantidad basada en la nueva unidad
                  const newQuantity = Math.max(1, quantity); // Mantener la cantidad actual o mínimo 1
                  const newBaseQuantity = newQuantity * newUnit.factor;
                  
                  console.log('🔄 Cambio de unidad:', {
                    from: `${selectedUnit} (factor: ${currentUnit.factor})`,
                    to: `${newUnitCode} (factor: ${newUnit.factor})`,
                    quantity: `${quantity} → ${newQuantity}`,
                    baseQuantity: `${baseQuantity} → ${newBaseQuantity}`
                  });
                  
                  setSelectedUnit(newUnitCode);
                  setQuantity(newQuantity);
                  setBaseQuantity(newBaseQuantity); // Recalcular cantidad base
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white placeholder-gray-500"
              >
                {selectedProduct.units.map((unit) => (
                  <option key={unit.unitCode} value={unit.unitCode}>
                    {unit.unitName || unit.unitCode} {unit.factor > 1 && `(${unit.factor} UND)`}
                  </option>
                ))}
              </select>
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cantidad
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => {
                  const newQty = parseInt(e.target.value) || 1;
                  const currentUnit = selectedProduct.units.find(u => u.unitCode === selectedUnit) || 
                                    { unitCode: selectedProduct.unitBase, unitName: 'Unidad', factor: 1 };
                  
                  setQuantity(Math.max(1, newQty)); // Mínimo 1
                  setBaseQuantity(newQty * currentUnit.factor); // Actualizar cantidad base
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white placeholder-gray-500"
              />
            </div>

            {/* Price Display */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Precio Unitario
              </label>
              <div className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-medium">
                {formatPrice(currentUnitPrice)}
              </div>
            </div>
          </div>

          {/* Total and Add Button */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-blue-200">
            <div className="text-lg font-semibold text-gray-900">
              Total: {formatPrice(currentUnitPrice * quantity)}
            </div>
            <button
              onClick={handleAddProduct}
              disabled={quantity <= 0 || (online && stockLoading) || (online && !hasEnoughStock(selectedProduct.id, baseQuantity))}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              {online ? (
                stockLoading 
                  ? 'Verificando stock...' 
                  : hasEnoughStock(selectedProduct.id, baseQuantity)
                    ? 'Agregar'
                    : 'Stock insuficiente'
              ) : (
                'Agregar (Offline)'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

ProductSearch.displayName = 'ProductSearch';

export default memo(ProductSearch);
