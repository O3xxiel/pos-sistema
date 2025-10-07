import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../state/auth';

// Tipos
interface Unit {
  id: number;
  code: string;
  name: string;
  symbol?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// API functions
const fetchUnits = async (accessToken: string): Promise<Unit[]> => {
  const response = await fetch('/api/catalog/units/all', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) throw new Error('Error al cargar unidades');
  return response.json();
};

const createUnit = async (unitData: { code: string; name: string; symbol?: string }, accessToken: string): Promise<Unit> => {
  const response = await fetch('/api/catalog/units-management', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(unitData),
  });
  if (!response.ok) throw new Error('Error al crear unidad');
  return response.json();
};

const updateUnit = async ({ id, ...unitData }: { id: number; code?: string; name?: string; symbol?: string; isActive?: boolean }, accessToken: string): Promise<Unit> => {
  const response = await fetch(`/api/catalog/units-management/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(unitData),
  });
  if (!response.ok) throw new Error('Error al actualizar unidad');
  return response.json();
};

const deleteUnit = async (id: number, accessToken: string): Promise<void> => {
  const response = await fetch(`/api/catalog/units-management/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  
  if (!response.ok) {
    // Intentar obtener el mensaje de error del servidor
    try {
      const errorData = await response.json();
      throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
    } catch (parseError) {
      // Si no se puede parsear el JSON, usar el mensaje genérico
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
  }
};

export default function UnitsManagement() {
  const [showForm, setShowForm] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    symbol: '',
  });

  const { accessToken, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  // Queries
  const { data: units, isLoading, error } = useQuery({
    queryKey: ['units'],
    queryFn: () => fetchUnits(accessToken!),
    enabled: !!accessToken && isAuthenticated,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (unitData: { code: string; name: string; symbol?: string }) => 
      createUnit(unitData, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      setShowForm(false);
      setFormData({ code: '', name: '', symbol: '' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: number; code?: string; name?: string; symbol?: string; isActive?: boolean }) => 
      updateUnit(data, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      setEditingUnit(null);
      setFormData({ code: '', name: '', symbol: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteUnit(id, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      alert('✅ Unidad eliminada correctamente');
    },
    onError: (error: any) => {
      console.error('Error al eliminar unidad:', error);
      
      // Extraer el mensaje del error
      const errorMessage = error.message || 'No se pudo eliminar la unidad';
      
      // Mostrar alerta de error con información específica
      alert(`❌ No se puede eliminar: ${errorMessage}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingUnit) {
      updateMutation.mutate({ id: editingUnit.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (unit: Unit) => {
    setEditingUnit(unit);
    setFormData({
      code: unit.code,
      name: unit.name,
      symbol: unit.symbol || '',
    });
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta unidad?\n\nNota: Si la unidad está siendo usada por productos, no se podrá eliminar.')) {
      deleteMutation.mutate(id);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingUnit(null);
    setFormData({ code: '', name: '', symbol: '' });
  };

  if (!isAuthenticated || !accessToken) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-800">Debes iniciar sesión para acceder a la gestión de unidades.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">Error al cargar las unidades: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Unidades de Medida</h1>
          <p className="text-gray-600">Administra las unidades de medida disponibles en el sistema</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Nueva Unidad
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {editingUnit ? 'Editar Unidad' : 'Nueva Unidad'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código *
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="ej: KG, L, M, BOLSA"
                  required
                  maxLength={10}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="ej: Kilogramo, Litro, Metro, Bolsa"
                  required
                  maxLength={50}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Símbolo
                </label>
                <input
                  type="text"
                  value={formData.symbol}
                  onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="ej: kg, L, m, bolsa"
                  maxLength={10}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="btn-primary disabled:opacity-50"
              >
                {createMutation.isPending || updateMutation.isPending ? 'Guardando...' : 'Guardar'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="btn-secondary"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Units List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Unidades Disponibles</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Código
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Símbolo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {units?.map((unit) => (
                <tr key={unit.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {unit.code}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {unit.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {unit.symbol || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      unit.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {unit.isActive ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(unit)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Editar unidad"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(unit.id)}
                        className="text-red-600 hover:text-red-900"
                        disabled={deleteMutation.isPending}
                        title="Eliminar unidad"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}