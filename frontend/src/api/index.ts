import {
  Hotel,
  FoodItem,
  Prediction,
  HistoricalRecord,
  DashboardStats,
  ModelMetric,
  CSVPreviewResult,
  CSVImportResult
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

// ── Token helpers ────────────────────────────────────────────────────────────
export function getToken(): string | null {
  return localStorage.getItem('hfp_token');
}
export function setToken(t: string) {
  localStorage.setItem('hfp_token', t);
}
export function clearToken() {
  localStorage.removeItem('hfp_token');
  localStorage.removeItem('hfp_hotel');
}
export function getStoredHotel(): AuthHotel | null {
  try {
    const raw = localStorage.getItem('hfp_hotel');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function setStoredHotel(h: AuthHotel) {
  localStorage.setItem('hfp_hotel', JSON.stringify(h));
}

export interface AuthHotel {
  hotel_id: number;
  hotel_name: string;
  city: string;
  star_rating: number;
  dining_capacity: number;
  total_rooms: number;
  email: string;
  role?: 'hotel' | 'admin';
}

// ── Core fetch wrapper ───────────────────────────────────────────────────────
async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Accept': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options?.headers || {})
    }
  });

  const data = await res.json();

  // Token expired → force logout
  if (res.status === 401) {
    clearToken();
    window.location.href = '/';
  }

  if (!res.ok || data.success === false) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data.data !== undefined ? data.data : data;
}

export const api = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  async login(email: string, password: string): Promise<AuthHotel & { access_token: string }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Login failed');
    return data;
  },

  async register(payload: {
    hotel_name: string; city: string; email: string; password: string;
    confirm_password: string; total_rooms: number; star_rating: number; dining_capacity: number;
  }): Promise<AuthHotel & { access_token: string }> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Registration failed');
    return data;
  },

  async logout(): Promise<void> {
    try {
      await fetchJson('/auth/logout', { method: 'POST' });
    } catch { /* ignore */ }
    clearToken();
  },

  async getMe(): Promise<{ hotel: AuthHotel }> {
    return fetchJson('/auth/me');
  },

  // ── System Health ─────────────────────────────────────────────────────────
  async getHealth(): Promise<{
    status: string;
    models: {
      guest_count_model_present: boolean;
      food_quantity_model_present: boolean;
      xgb_guest_model_present: boolean;
      xgb_food_model_present: boolean;
      xgboost_available: boolean;
    };
  }> {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
  },

  // ── Dashboard ─────────────────────────────────────────────────────────────
  async getDashboardStats(hotelId?: number): Promise<DashboardStats> {
    const q = hotelId ? `?hotel_id=${hotelId}` : '';
    return fetchJson<DashboardStats>(`/dashboard/stats${q}`);
  },

  async upgradeCapacity(hotelId: number, diningCapacity: number, totalRooms?: number): Promise<any> {
    return fetchJson(`/hotels/${hotelId}/capacity`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dining_capacity: diningCapacity, total_rooms: totalRooms })
    });
  },

  // ── Hotels ────────────────────────────────────────────────────────────────
  async getHotels(): Promise<Hotel[]> {
    return fetchJson<Hotel[]>('/hotels');
  },

  async createHotel(hotel: Partial<Hotel>): Promise<Hotel> {
    return fetchJson<Hotel>('/hotels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hotel)
    });
  },

  async updateHotel(id: number, hotel: Partial<Hotel>): Promise<void> {
    await fetchJson(`/hotels/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hotel)
    });
  },

  async deleteHotel(id: number): Promise<void> {
    await fetchJson(`/hotels/${id}`, { method: 'DELETE' });
  },

  // ── Food Items ────────────────────────────────────────────────────────────
  async getFoodItems(category?: string): Promise<FoodItem[]> {
    const query = category ? `?category=${encodeURIComponent(category)}` : '';
    return fetchJson<FoodItem[]>(`/food-items${query}`);
  },

  async createFoodItem(item: Partial<FoodItem>): Promise<FoodItem> {
    return fetchJson<FoodItem>('/food-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });
  },

  async updateFoodItem(id: number, item: Partial<FoodItem>): Promise<void> {
    await fetchJson(`/food-items/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });
  },

  async deleteFoodItem(id: number): Promise<void> {
    await fetchJson(`/food-items/${id}`, { method: 'DELETE' });
  },

  // ── Hotel Events ──────────────────────────────────────────────────────────
  async getEvents(): Promise<{ events: any[] }> {
    return fetchJson('/events');
  },

  async createEvent(ev: {
    event_name: string; event_date: string; event_end_date?: string;
    event_category: string; description?: string; expected_guest_count?: number;
  }): Promise<{ event_id: number }> {
    return fetchJson('/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ev)
    });
  },

  async updateEvent(id: number, ev: Partial<any>): Promise<void> {
    await fetchJson(`/events/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ev)
    });
  },

  async deleteEvent(id: number): Promise<void> {
    await fetchJson(`/events/${id}`, { method: 'DELETE' });
  },

  async getCalendarInfo(date: string): Promise<{
    date: string; day_name: string; weekday: number; is_weekend: boolean;
    season: string; month: number; is_holiday_or_event: number;
    hotel_events: any[]; public_holidays: any[];
    calendar_summary: string; data_warning: string | null;
  }> {
    return fetchJson(`/events/calendar-info?date=${date}`);
  },

  // ── Predictions ───────────────────────────────────────────────────────────
  async makePrediction(params: {
    hotel_id: number; date: string; meal_type: string; food_item_id: number;
    safety_buffer_percent?: number; is_holiday_or_event?: number;
  }): Promise<Prediction> {
    return fetchJson<Prediction>('/predictions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
  },

  async makeBatchPrediction(params: {
    hotel_id: number; date: string; meal_type: string; food_item_ids: number[];
    safety_buffer_percent?: number; is_holiday_or_event?: number;
  }): Promise<{ data: Prediction[]; errors?: { food_item_id: number; error: string }[] }> {
    const res = await fetch(`${API_BASE}/predictions/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(getToken() ? { 'Authorization': `Bearer ${getToken()}` } : {})
      },
      body: JSON.stringify(params)
    });
    return res.json();
  },

  async getPredictionHistory(params?: {
    hotel_id?: number; food_item_id?: number; meal_type?: string;
    search?: string; from_date?: string; to_date?: string; page?: number; limit?: number;
  }): Promise<{
    data: Prediction[];
    pagination: { page: number; limit: number; total_records: number; total_pages: number };
  }> {
    const sp = new URLSearchParams();
    if (params?.hotel_id)    sp.append('hotel_id',    params.hotel_id.toString());
    if (params?.food_item_id)sp.append('food_item_id',params.food_item_id.toString());
    if (params?.meal_type)   sp.append('meal_type',   params.meal_type);
    if (params?.search)      sp.append('search',      params.search);
    if (params?.from_date)   sp.append('from_date',   params.from_date);
    if (params?.to_date)     sp.append('to_date',     params.to_date);
    if (params?.page)        sp.append('page',        params.page.toString());
    if (params?.limit)       sp.append('limit',       params.limit.toString());
    const res = await fetch(`${API_BASE}/predictions?${sp.toString()}`, {
      headers: getToken() ? { 'Authorization': `Bearer ${getToken()}` } : {}
    });
    return res.json();
  },

  async deletePrediction(id: number): Promise<void> {
    await fetchJson(`/predictions/${id}`, { method: 'DELETE' });
  },

  // ── Historical Records ────────────────────────────────────────────────────
  async getHistoricalRecords(params?: {
    hotel_id?: number; meal_type?: string; food_item_id?: number;
    search?: string; from_date?: string; to_date?: string; page?: number; limit?: number;
  }): Promise<{
    data: HistoricalRecord[];
    pagination: { page: number; limit: number; total_records: number; total_pages: number };
  }> {
    const sp = new URLSearchParams();
    if (params?.hotel_id)    sp.append('hotel_id',    params.hotel_id.toString());
    if (params?.food_item_id)sp.append('food_item_id',params.food_item_id.toString());
    if (params?.meal_type)   sp.append('meal_type',   params.meal_type);
    if (params?.search)      sp.append('search',      params.search);
    if (params?.from_date)   sp.append('from_date',   params.from_date);
    if (params?.to_date)     sp.append('to_date',     params.to_date);
    if (params?.page)        sp.append('page',        params.page.toString());
    if (params?.limit)       sp.append('limit',       params.limit.toString());
    const res = await fetch(`${API_BASE}/historical?${sp.toString()}`, {
      headers: getToken() ? { 'Authorization': `Bearer ${getToken()}` } : {}
    });
    return res.json();
  },

  async previewHistoricalCsv(file: File): Promise<CSVPreviewResult> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/historical/preview`, {
      method: 'POST',
      headers: getToken() ? { 'Authorization': `Bearer ${getToken()}` } : {},
      body: formData
    });
    const data = await res.json();
    if (!res.ok || data.success === false) throw new Error(data.error || 'Failed to preview CSV');
    return data.data;
  },

  async importHistoricalCsv(
    file: File,
    strategy: 'skip' | 'update' | 'keep_both'
  ): Promise<CSVImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('deduplication_strategy', strategy);
    const res = await fetch(`${API_BASE}/historical/import`, {
      method: 'POST',
      headers: getToken() ? { 'Authorization': `Bearer ${getToken()}` } : {},
      body: formData
    });
    const data = await res.json();
    if (!res.ok || data.success === false) throw new Error(data.error || 'Failed to import CSV');
    return data.data;
  },

  getTemplateDownloadUrl(): string {
    return `${API_BASE}/historical/template`;
  },

  // ── ML Models ─────────────────────────────────────────────────────────────
  async getModelMetrics(): Promise<{
    is_trained: boolean; guest_model_loaded: boolean; food_model_loaded: boolean;
    total_training_records_available: number;
    guest_count_model: ModelMetric | null;
    food_quantity_model: ModelMetric | null;
  }> {
    return fetchJson('/models/metrics');
  },

  async retrainModels(): Promise<any> {
    const res = await fetch(`${API_BASE}/models/train`, {
      method: 'POST',
      headers: getToken() ? { 'Authorization': `Bearer ${getToken()}` } : {}
    });
    const data = await res.json();
    if (!res.ok || data.success === false) throw new Error(data.error || 'Model training failed');
    return data;
  },

  async retrainXGBoost(): Promise<any> {
    const res = await fetch(`${API_BASE}/models/train-xgboost`, {
      method: 'POST',
      headers: getToken() ? { 'Authorization': `Bearer ${getToken()}` } : {}
    });
    const data = await res.json();
    if (!res.ok || data.success === false) throw new Error(data.error || 'XGBoost training failed');
    return data;
  },

  async retrainAllModels(): Promise<any> {
    const res = await fetch(`${API_BASE}/models/train-all`, {
      method: 'POST',
      headers: getToken() ? { 'Authorization': `Bearer ${getToken()}` } : {}
    });
    const data = await res.json();
    if (!res.ok || data.success === false) throw new Error(data.error || 'Training failed');
    return data;
  },

  async getModelComparison(): Promise<{
    comparison: any[];
    best_models: { guest?: string; food?: string };
    selection_criterion: string;
  }> {
    return fetchJson('/models/comparison');
  },

  // ── Reports ───────────────────────────────────────────────────────────────
  async getReport(params: { hotel_id: number; days?: number; meal_type?: string }): Promise<any> {
    const sp = new URLSearchParams();
    sp.append('hotel_id', params.hotel_id.toString());
    if (params.days)      sp.append('days',      params.days.toString());
    if (params.meal_type) sp.append('meal_type', params.meal_type);
    return fetchJson(`/reports/analytics?${sp.toString()}`);
  },

  async getReportSummary(params?: {
    hotel_id?: number; food_item_id?: number; meal_type?: string;
    from_date?: string; to_date?: string;
  }): Promise<any> {
    const sp = new URLSearchParams();
    if (params?.hotel_id)    sp.append('hotel_id',    params.hotel_id.toString());
    if (params?.food_item_id)sp.append('food_item_id',params.food_item_id.toString());
    if (params?.meal_type)   sp.append('meal_type',   params.meal_type);
    if (params?.from_date)   sp.append('from_date',   params.from_date);
    if (params?.to_date)     sp.append('to_date',     params.to_date);
    return fetchJson(`/reports/summary?${sp.toString()}`);
  },

  getExportUrl(
    type: 'predictions' | 'historical' | 'summary',
    params?: { hotel_id?: number; days?: number }
  ): string {
    let url = `${API_BASE}/reports/export?type=${type}`;
    if (params?.hotel_id) url += `&hotel_id=${params.hotel_id}`;
    if (params?.days)     url += `&days=${params.days}`;
    return url;
  },

  // ── Settings ──────────────────────────────────────────────────────────────
  async getSettings(): Promise<Record<string, string>> {
    return fetchJson<Record<string, string>>('/settings');
  },

  async updateSettings(settings: Record<string, any>): Promise<void> {
    await fetchJson('/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
  }
};
