// pos-app/src/data/api.ts
export const API_URL =
  (import.meta.env.VITE_API_URL as string) || 'http://localhost:3001';

export type AuthUser = { id: number; username: string; fullName?: string; roles: string[] };
export type LoginResponse = { access_token: string; refresh_token: string; user: AuthUser };

export async function apiLogin(username: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`Login failed (${res.status}) ${msg}`);
  }
  return res.json();
}

export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  // Importar useAuth dinámicamente para evitar dependencias circulares
  const { useAuth } = await import('../state/auth');
  const { accessToken, isAuthenticated } = useAuth.getState();
  
  // Construir la URL completa
  const fullUrl = url.startsWith('http') ? url : `${API_URL}${url}`;
  
  console.log('🌐 fetchWithAuth - URL original:', url);
  console.log('🌐 fetchWithAuth - URL completa:', fullUrl);
  console.log('🌐 fetchWithAuth - Method:', options.method || 'GET');
  console.log('🌐 fetchWithAuth - IsAuthenticated:', isAuthenticated);
  console.log('🌐 fetchWithAuth - HasToken:', !!accessToken);
  console.log('🌐 fetchWithAuth - Token preview:', accessToken ? `${accessToken.substring(0, 20)}...` : 'null');
  
  if (!accessToken) {
    console.error('❌ fetchWithAuth - No authentication token available');
    throw new Error('No authentication token available');
  }

  if (!isAuthenticated) {
    console.error('❌ fetchWithAuth - User not authenticated');
    throw new Error('User not authenticated');
  }

  const response = await fetch(fullUrl, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      ...options.headers,
    },
  });

  console.log('🌐 fetchWithAuth - Response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.log('🌐 fetchWithAuth - Error response:', errorText);
    
    // Si es un error 401, forzar logout inmediatamente
    if (response.status === 401) {
      console.error('🔐 fetchWithAuth - Unauthorized (401) - Token expirado o inválido');
      console.error('🔐 fetchWithAuth - Token usado:', accessToken);
      console.error('🔐 fetchWithAuth - Forzando logout');
      
      // Forzar logout inmediatamente
      useAuth.getState().forceLogout();
    }
    
    // Intentar parsear el error como JSON para obtener más detalles
    let errorMessage = `Fetch failed (${response.status}): ${errorText}`;
    try {
      const errorData = JSON.parse(errorText);
      if (errorData.message) {
        errorMessage = `Fetch failed (${response.status}): ${errorData.message}`;
      }
    } catch {
      // Si no es JSON válido, usar el mensaje original
    }
    
    throw new Error(errorMessage);
  }

  // Verificar si la respuesta es JSON válido
  const contentType = response.headers.get('content-type');
  console.log('🌐 fetchWithAuth - Content-Type:', contentType);
  
  if (!contentType || !contentType.includes('application/json')) {
    const responseText = await response.text();
    console.error('❌ fetchWithAuth - Respuesta no es JSON:', responseText.substring(0, 200));
    throw new Error(`Expected JSON response but got ${contentType}. Response: ${responseText.substring(0, 200)}...`);
  }

  return response.json();
}

export async function getAllOfflineSales(status?: string) {
  const url = status 
    ? `${API_URL}/sales/offline/all?status=${status}`
    : `${API_URL}/sales/offline/all`;
  
  return fetchWithAuth(url);
}

export async function getSalesDrafts() {
  return fetchWithAuth(`${API_URL}/sales?status=DRAFT`);
}

export async function getAllSalesDrafts() {
  return fetchWithAuth(`${API_URL}/sales?status=DRAFT&all=true`);
}

// ==================== VENDEDORES ====================
export async function getSellers(active?: boolean) {
  const params = new URLSearchParams();
  if (active !== undefined) params.append('active', active.toString());
  return fetchWithAuth(`${API_URL}/sellers?${params.toString()}`);
}

export async function getSeller(id: number) {
  return fetchWithAuth(`${API_URL}/sellers/${id}`);
}

export async function createSeller(sellerData: {
  username: string;
  password: string;
  fullName: string;
  email?: string;
  phone?: string;
  address?: string;
  isActive?: boolean;
}) {
  return fetchWithAuth(`${API_URL}/sellers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sellerData),
  });
}

export async function updateSeller(id: number, sellerData: {
  username?: string;
  password?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  address?: string;
  isActive?: boolean;
}) {
  return fetchWithAuth(`${API_URL}/sellers/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sellerData),
  });
}

export async function deleteSeller(id: number) {
  return fetchWithAuth(`${API_URL}/sellers/${id}`, {
    method: 'DELETE',
  });
}

export async function getSellerStats(id: number, date?: string) {
  const params = new URLSearchParams();
  if (date) params.append('date', date);
  return fetchWithAuth(`${API_URL}/sellers/${id}/stats?${params.toString()}`);
}

// ==================== REPORTES ====================
export async function getDailyReport(date: string, sellerId?: string) {
  const params = new URLSearchParams();
  params.append('date', date);
  if (sellerId) {
    params.append('seller_id', sellerId);
  } else {
    params.append('seller_id', 'me');
  }
  return fetchWithAuth(`${API_URL}/reports/daily?${params.toString()}`);
}

export async function getReportSellers() {
  return fetchWithAuth(`${API_URL}/reports/sellers`);
}

export async function getDailySummary(date: string, sellerId?: string) {
  const params = new URLSearchParams({ date });
  if (sellerId) {
    params.append('sellerId', sellerId);
  }
  return fetchWithAuth(`${API_URL}/reports/summary?${params.toString()}`);
}

export async function addStock(productId: number, quantity: number, warehouseId: number = 1) {
  return fetchWithAuth(`${API_URL}/catalog/stock/add`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      productId,
      quantity,
      warehouseId
    })
  });
}

// ========== REPORTES ==========

export async function getSalesSummary(startDate: string, endDate: string) {
  return fetchWithAuth(`${API_URL}/reports/sales/summary?startDate=${startDate}&endDate=${endDate}`);
}

export async function getTopSellingProducts(startDate: string, endDate: string, limit: number = 10) {
  return fetchWithAuth(`${API_URL}/reports/sales/top-products?startDate=${startDate}&endDate=${endDate}&limit=${limit}`);
}

export async function getSalesBySeller(startDate: string, endDate: string) {
  return fetchWithAuth(`${API_URL}/reports/sales/by-seller?startDate=${startDate}&endDate=${endDate}`);
}

export async function getInventorySummary() {
  return fetchWithAuth(`${API_URL}/reports/inventory/summary`);
}


export async function getCustomerSummary(startDate?: string, endDate?: string) {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  return fetchWithAuth(`${API_URL}/reports/customers/summary?${params.toString()}`);
}

export async function getTopCustomers(startDate: string, endDate: string, limit: number = 10) {
  return fetchWithAuth(`${API_URL}/reports/customers/top?startDate=${startDate}&endDate=${endDate}&limit=${limit}`);
}

export async function getCustomerActivity(startDate: string, endDate: string) {
  return fetchWithAuth(`${API_URL}/reports/customers/activity?startDate=${startDate}&endDate=${endDate}`);
}

export async function saveSaleDraft(draftData: {
  customerId?: number;
  warehouseId?: number;
  subtotal?: number;
  taxTotal?: number;
  total?: number;
  items?: Array<{
    productId: number;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
}) {
  // Mapear los campos del frontend a los que espera el backend
  const backendData = {
    customerId: draftData.customerId,
    warehouseId: draftData.warehouseId,
    subtotal: draftData.subtotal,
    taxTotal: draftData.taxTotal,
    total: draftData.total,
    items: draftData.items?.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total,
    }))
  };

  console.log('📤 saveSaleDraft - Datos originales:', JSON.stringify(draftData, null, 2));
  console.log('📤 saveSaleDraft - Datos para backend:', JSON.stringify(backendData, null, 2));

  return fetchWithAuth(`${API_URL}/sales/draft`, {
    method: 'POST',
    body: JSON.stringify(backendData)
  });
}

// ==================== UNIDADES DE MEDIDA ====================

export async function getProductUnits(productId: number) {
  return fetchWithAuth(`${API_URL}/catalog/units/product/${productId}`);
}

export async function createProductUnit(productId: number, unitData: {
  unitCode: string;
  unitName: string;
  factor: number;
}) {
  return fetchWithAuth(`${API_URL}/catalog/units/product/${productId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(unitData),
  });
}

export async function updateProductUnit(unitId: number, unitData: {
  unitCode?: string;
  unitName?: string;
  factor?: number;
  isActive?: boolean;
}) {
  return fetchWithAuth(`${API_URL}/catalog/units/${unitId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(unitData),
  });
}

export async function deleteProductUnit(unitId: number) {
  return fetchWithAuth(`${API_URL}/catalog/units/${unitId}`, {
    method: 'DELETE',
  });
}

export async function getStandardUnits() {
  return fetchWithAuth(`${API_URL}/catalog/units/standard`);
}

export async function initializeStandardUnits(productId: number) {
  return fetchWithAuth(`${API_URL}/catalog/units/product/${productId}/initialize`, {
    method: 'POST',
  });
}
