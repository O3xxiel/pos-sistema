// pos-app/src/components/forms/CustomerForm.tsx
import { useState, useEffect } from 'react';
import { db } from '../../offline/db';
import { createCustomer, updateCustomer } from '../../data/catalog';
import type { CustomerRow } from '../../offline/db';

interface CustomerFormProps {
  customer?: CustomerRow | null;
  onSave: () => void;
  onCancel: () => void;
}

export default function CustomerForm({ customer, onSave, onCancel }: CustomerFormProps) {
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    nit: '',
    phone: '',
    address: '',
    isActive: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (customer) {
      setFormData({
        code: customer.code,
        name: customer.name,
        nit: customer.nit || '',
        phone: customer.phone || '',
        address: customer.address || '',
        isActive: customer.isActive,
      });
    }
  }, [customer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validaciones básicas
      if (!formData.code.trim()) {
        throw new Error('El código es requerido');
      }
      if (!formData.name.trim()) {
        throw new Error('El nombre es requerido');
      }

      const customerData: CustomerRow = {
        id: customer?.id || Math.floor(Math.random() * 1000000), // ID temporal más pequeño
        code: formData.code.trim(),
        name: formData.name.trim(),
        nit: formData.nit.trim() || null,
        phone: formData.phone.trim() || null,
        address: formData.address.trim() || null,
        isActive: formData.isActive,
        updatedAt: new Date().toISOString(),
      };

      let savedCustomer: CustomerRow;

      if (customer) {
        // Actualizar cliente existente
        try {
          // Intentar actualizar en el backend primero
          const backendCustomer = await updateCustomer(customer.id, customerData);
          savedCustomer = backendCustomer;
          // Actualizar en la base de datos local
          await db.catalog_customers.update(customer.id, savedCustomer);
        } catch (error) {
          console.warn('Failed to update customer on backend:', error);
          // Verificar si es un error de permisos
          if (error instanceof Error && error.message.includes('403')) {
            throw new Error('No tienes permisos para editar clientes. Solo los administradores pueden editar clientes.');
          }
          // Si es otro tipo de error, guardar localmente
          await db.catalog_customers.update(customer.id, customerData);
          savedCustomer = customerData;
        }
      } else {
        // Crear nuevo cliente
        try {
          // Intentar crear en el backend primero
          const backendCustomer = await createCustomer({
            code: customerData.code,
            name: customerData.name,
            nit: customerData.nit,
            phone: customerData.phone,
            address: customerData.address,
            isActive: customerData.isActive,
          });
          savedCustomer = backendCustomer;
          // Guardar en la base de datos local
          await db.catalog_customers.put(savedCustomer);
        } catch (error) {
          console.warn('Failed to create customer on backend:', error);
          // Verificar si es un error de permisos
          if (error instanceof Error && error.message.includes('403')) {
            throw new Error('No tienes permisos para crear clientes. Solo los administradores pueden crear clientes.');
          }
          // Si es otro tipo de error, guardar localmente
          await db.catalog_customers.add(customerData);
          savedCustomer = customerData;
        }
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar el cliente');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              {customer ? 'Editar Cliente' : 'Nuevo Cliente'}
            </h2>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Información básica */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código *
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                  className="input"
                  placeholder="Ej: CLI001"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  NIT
                </label>
                <input
                  type="text"
                  value={formData.nit}
                  onChange={(e) => setFormData(prev => ({ ...prev, nit: e.target.value }))}
                  className="input"
                  placeholder="Ej: CF o 123456789"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre del Cliente *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="input"
                placeholder="Ej: Juan Pérez"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="input"
                  placeholder="Ej: 12345678"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dirección
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  className="input"
                  placeholder="Ej: Zona 1, Ciudad"
                />
              </div>
            </div>

            {/* Estado */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                className="mr-2"
              />
              <label htmlFor="isActive" className="text-sm text-gray-700">
                Cliente activo
              </label>
            </div>

            {/* Botones */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={onCancel}
                className="btn-secondary"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
              >
                {loading ? 'Guardando...' : (customer ? 'Actualizar' : 'Crear')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}