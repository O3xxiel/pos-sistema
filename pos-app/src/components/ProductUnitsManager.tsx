import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../state/auth';
import { API_URL } from '../data/api';

// Tipos
interface Unit {
  id: number;
  code: string;
  name: string;
  symbol?: string;
  isActive: boolean;
}

interface ProductUnit {
  id: number;
  unitId: number;
  code: string;
  name: string;
  symbol?: string;
  factor: number;
}

interface ProductUnitsManagerProps {
  productId: number;
  productName: string;
  onClose: () => void;
}

// API functions
const fetchAvailableUnits = async (productId: number, accessToken: string) => {
  const response = await fetch(`${API_URL}/catalog/units-management/product/${productId}/available`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) throw new Error('Error al cargar unidades');
  return response.json();
};

const assignUnit = async (productId: number, unitId: number, factor: number, accessToken: string) => {
  const response = await fetch(`${API_URL}/catalog/units-management/product/${productId}/assign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ unitId, factor }),
  });
  if (!response.ok) throw new Error('Error al asignar unidad');
  return response.json();
};

const removeUnit = async (productId: number, unitId: number, accessToken: string) => {
  const response = await fetch(`${API_URL}/catalog/units-management/product/${productId}/unit/${unitId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) throw new Error('Error al remover unidad');
};

const updateFactor = async (productId: number, unitId: number, factor: number, accessToken: string) => {
  const response = await fetch(`${API_URL}/catalog/units-management/product/${productId}/unit/${unitId}/factor`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ factor }),
  });
  if (!response.ok) throw new Error('Error al actualizar factor');
  return response.json();
};

export default function ProductUnitsManager({ productId, productName, onClose }: ProductUnitsManagerProps) {
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  const [factor, setFactor] = useState<number>(1);
  const [editingFactor, setEditingFactor] = useState<number | null>(null);

  const { accessToken, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  // Queries
  const { data: unitsData, isLoading, error } = useQuery({
    queryKey: ['productUnits', productId],
    queryFn: () => fetchAvailableUnits(productId, accessToken!),
    enabled: !!accessToken && isAuthenticated,
  });

  // Mutations
  const assignMutation = useMutation({
    mutationFn: ({ unitId, factor }: { unitId: number; factor: number }) =>
      assignUnit(productId, unitId, factor, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productUnits', productId] });
      setShowAssignForm(false);
      setSelectedUnitId(null);
      setFactor(1);
    },
  });

  const removeMutation = useMutation({
    mutationFn: (unitId: number) => removeUnit(productId, unitId, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productUnits', productId] });
    },
  });

  const updateFactorMutation = useMutation({
    mutationFn: ({ unitId, factor }: { unitId: number; factor: number }) =>
      updateFactor(productId, unitId, factor, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productUnits', productId] });
      setEditingFactor(null);
    },
  });

  const handleAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUnitId && factor > 0) {
      assignMutation.mutate({ unitId: selectedUnitId, factor });
    }
  };

  const handleRemove = (unitId: number) => {
    if (window.confirm('¿Estás seguro de que quieres remover esta unidad del producto?')) {
      removeMutation.mutate(unitId);
    }
  };

  const handleFactorUpdate = (unitId: number, newFactor: number) => {
    if (newFactor > 0) {
      updateFactorMutation.mutate({ unitId, factor: newFactor });
    }
  };

  if (!isAuthenticated || !accessToken) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="text-yellow-800 mb-4">Debes iniciar sesión para gestionar unidades de productos.</div>
          <button onClick={onClose} className="btn-secondary">Cerrar</button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="text-red-600 mb-4">Error: {error.message}</div>
          <button onClick={onClose} className="btn-secondary">Cerrar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Unidades de {productName}</h2>
            <p className="text-gray-600">Gestiona las unidades de medida disponibles para este producto</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Assign New Unit Form */}
        {showAssignForm ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Asignar Nueva Unidad</h3>
            <form onSubmit={handleAssign} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unidad
                  </label>
                  <select
                    value={selectedUnitId || ''}
                    onChange={(e) => setSelectedUnitId(parseInt(e.target.value) || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Seleccionar unidad</option>
                    {unitsData?.available.map((unit: Unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name} ({unit.code}) {unit.symbol && `- ${unit.symbol}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Factor (equivalencia en unidades base)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={factor}
                    onChange={(e) => setFactor(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={assignMutation.isPending}
                  className="btn-primary disabled:opacity-50"
                >
                  {assignMutation.isPending ? 'Asignando...' : 'Asignar'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAssignForm(false)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="mb-6">
            <button
              onClick={() => setShowAssignForm(true)}
              className="btn-primary flex items-center gap-2"
            >
              <PlusIcon className="w-5 h-5" />
              Asignar Nueva Unidad
            </button>
          </div>
        )}

        {/* Assigned Units */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Unidades Asignadas</h3>
          {unitsData?.assigned.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No hay unidades asignadas a este producto
            </div>
          ) : (
            <div className="space-y-3">
              {unitsData?.assigned.map((productUnit: ProductUnit) => (
                <div key={productUnit.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-gray-900">{productUnit.name}</span>
                        <span className="text-sm text-gray-500">({productUnit.code})</span>
                        {productUnit.symbol && (
                          <span className="text-sm text-gray-500">- {productUnit.symbol}</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        Factor: {productUnit.factor} unidades base
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {editingFactor === productUnit.unitId ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            value={productUnit.factor}
                            onChange={(e) => setFactor(parseInt(e.target.value) || 1)}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                          <button
                            onClick={() => {
                              handleFactorUpdate(productUnit.unitId, factor);
                              setEditingFactor(null);
                            }}
                            className="text-green-600 hover:text-green-800 text-sm"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => setEditingFactor(null)}
                            className="text-gray-600 hover:text-gray-800 text-sm"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => setEditingFactor(productUnit.unitId)}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            Editar Factor
                          </button>
                          <button
                            onClick={() => handleRemove(productUnit.unitId)}
                            className="text-red-600 hover:text-red-800"
                            disabled={removeMutation.isPending}
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}