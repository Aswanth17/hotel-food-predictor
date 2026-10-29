import React, { useState, useEffect } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  Trash2, 
  Download, 
  Eye, 
  Calendar, 
  Building2, 
  UtensilsCrossed,
  AlertTriangle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { api, AuthHotel } from '../api';
import { Prediction, Hotel, FoodItem } from '../types';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';

interface PredictionHistoryPageProps {
  hotel?: AuthHotel | null;
}

export const PredictionHistoryPage: React.FC<PredictionHistoryPageProps> = ({ hotel }) => {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedHotelId, setSelectedHotelId] = useState<string>('');
  const [selectedMeal, setSelectedMeal] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Modals
  const [selectedRecord, setSelectedRecord] = useState<Prediction | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<Prediction | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadHotelsAndItems();
  }, []);

  useEffect(() => {
    loadPredictions();
  }, [page, selectedHotelId, selectedMeal, fromDate, toDate]);

  const loadHotelsAndItems = async () => {
    try {
      const [hList, fList] = await Promise.all([api.getHotels(), api.getFoodItems()]);
      setHotels(hList);
      setFoodItems(fList);
    } catch (e) {
      console.error(e);
    }
  };

  const loadPredictions = async () => {
    try {
      setLoading(true);
      const targetHotelId = hotel?.role === 'hotel' 
        ? hotel.hotel_id 
        : (selectedHotelId ? Number(selectedHotelId) : undefined);

      const res = await api.getPredictionHistory({
        hotel_id: targetHotelId,
        meal_type: selectedMeal || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        search: search || undefined,
        page,
        limit: 15
      });
      setPredictions(res.data);
      setTotalPages(res.pagination.total_pages);
      setTotalRecords(res.pagination.total_records);
    } catch (err) {
      console.error('Failed to load predictions', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadPredictions();
  };

  const handleDeleteConfirm = async () => {
    if (!recordToDelete) return;
    try {
      setDeleting(true);
      await api.deletePrediction(recordToDelete.id);
      setRecordToDelete(null);
      loadPredictions();
    } catch (err) {
      alert('Failed to delete prediction record');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-stone-900 tracking-tight">
            {hotel?.role === 'hotel' ? `${hotel.hotel_name} — Predictions History` : 'Global Prediction History'}
          </h2>
          <p className="text-sm text-stone-500">
            {hotel?.role === 'hotel' 
              ? 'Private forecast audit history for your dining sessions and events.'
              : 'Cross-hotel prediction audit log across all monitored properties.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={api.getExportUrl('predictions', hotel?.role === 'hotel' ? { hotel_id: hotel.hotel_id } : undefined)}
            className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 text-xs font-semibold rounded-xl shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-stone-500" />
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by hotel or food item name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-stone-200 text-xs bg-stone-50 focus:bg-white focus:ring-2 focus:ring-emerald-700 focus:outline-hidden"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-[#1B4332] text-white text-xs font-semibold rounded-xl hover:bg-[#144531] transition-colors"
          >
            Search
          </button>
        </form>

        <div className={`grid ${hotel?.role === 'hotel' ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'} gap-3 pt-2 border-t border-stone-100 text-xs`}>
          {hotel?.role !== 'hotel' && (
            <div>
              <label className="block text-[11px] font-semibold text-stone-500 mb-1">Hotel</label>
              <select
                value={selectedHotelId}
                onChange={(e) => { setSelectedHotelId(e.target.value); setPage(1); }}
                className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 bg-stone-50 text-xs"
              >
                <option value="">All Hotels</option>
                {hotels.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-stone-500 mb-1">Session / Meal</label>
            <select
              value={selectedMeal}
              onChange={(e) => { setSelectedMeal(e.target.value); setPage(1); }}
              className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 bg-stone-50 text-xs"
            >
              <option value="">All Meals</option>
              <option value="Breakfast">Breakfast</option>
              <option value="Lunch">Lunch</option>
              <option value="Dinner">Dinner</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-stone-500 mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 bg-stone-50 text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-stone-500 mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1); }}
              className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 bg-stone-50 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Predictions Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-stone-100 flex items-center justify-between text-xs text-stone-500">
          <span>Total Records: <strong className="text-stone-800">{totalRecords}</strong></span>
          <span>Page {page} of {totalPages}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-stone-50/80 border-b border-stone-200 text-stone-500 uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">Date & Session</th>
                <th className="py-3 px-4">Hotel</th>
                <th className="py-3 px-4">Food Item</th>
                <th className="py-3 px-4 text-right">Predicted Guests</th>
                <th className="py-3 px-4 text-right">Recommended Qty</th>
                <th className="py-3 px-4 text-right">Base / Buffer</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-stone-400">
                    Loading historical predictions...
                  </td>
                </tr>
              ) : predictions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-stone-400">
                    No prediction records found matching the criteria.
                  </td>
                </tr>
              ) : (
                predictions.map((p) => (
                  <tr key={p.id} className="hover:bg-stone-50/80 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <p className="font-semibold text-stone-900">{p.prediction_date}</p>
                      <p className="text-[11px] text-stone-500">{p.meal_type}</p>
                    </td>
                    <td className="py-3 px-4 font-medium text-stone-700 whitespace-nowrap">
                      {p.hotel_name}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-stone-900">{p.food_item_name}</p>
                      <Badge variant="gray">{p.food_category}</Badge>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <span className="font-bold text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        {p.predicted_guest_count} Guests
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <span className="font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                        {p.recommended_food_quantity} {p.unit}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-[11px] text-stone-500 whitespace-nowrap">
                      <span>{p.base_estimated_quantity} {p.unit}</span>
                      <span className="text-emerald-700 font-medium"> (+{p.safety_buffer_percent}%)</span>
                    </td>
                    <td className="py-3 px-4 text-[11px] text-stone-500 max-w-[150px] truncate" title={p.prediction_method}>
                      {p.prediction_method.includes('Random Forest') ? 'Random Forest' : 'Historical Avg'}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setSelectedRecord(p)}
                          className="p-1.5 text-stone-500 hover:text-stone-900 rounded-lg hover:bg-stone-100"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setRecordToDelete(p)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50"
                          title="Delete Record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-stone-100 flex items-center justify-between text-xs text-stone-600">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-200 disabled:opacity-40 hover:bg-stone-50"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>
          <span>Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-200 disabled:opacity-40 hover:bg-stone-50"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Details Modal */}
      {selectedRecord && (
        <Modal
          isOpen={!!selectedRecord}
          onClose={() => setSelectedRecord(null)}
          title="Prediction Forecast Details"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-stone-50 border border-stone-100">
              <div>
                <span className="text-stone-500">Property</span>
                <p className="font-bold text-stone-900 mt-0.5">{selectedRecord.hotel_name}</p>
              </div>
              <div>
                <span className="text-stone-500">Forecast Date</span>
                <p className="font-bold text-stone-900 mt-0.5">{selectedRecord.prediction_date} ({selectedRecord.meal_type})</p>
              </div>
              <div>
                <span className="text-stone-500">Food Item</span>
                <p className="font-bold text-stone-900 mt-0.5">{selectedRecord.food_item_name} ({selectedRecord.food_category})</p>
              </div>
              <div>
                <span className="text-stone-500">Provision Unit</span>
                <p className="font-bold text-stone-900 mt-0.5 uppercase">{selectedRecord.unit}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="text-emerald-800 font-semibold uppercase tracking-wider text-[10px]">Output 1</span>
                <p className="text-2xl font-bold text-emerald-950 mt-1">{selectedRecord.predicted_guest_count}</p>
                <p className="text-emerald-700 mt-0.5">Predicted Guests</p>
              </div>
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                <span className="text-amber-800 font-semibold uppercase tracking-wider text-[10px]">Output 2</span>
                <p className="text-2xl font-bold text-amber-950 mt-1">{selectedRecord.recommended_food_quantity} {selectedRecord.unit}</p>
                <p className="text-amber-700 mt-0.5">Recommended Food Quantity</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-stone-50 border border-stone-100 space-y-2">
              <div className="flex justify-between">
                <span className="text-stone-500">Base Net Quantity:</span>
                <span className="font-medium">{selectedRecord.base_estimated_quantity} {selectedRecord.unit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Safety Buffer:</span>
                <span className="font-medium text-emerald-700">+{selectedRecord.safety_buffer_percent}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Prediction Method:</span>
                <span className="font-medium">{selectedRecord.prediction_method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Generated Timestamp:</span>
                <span className="font-medium text-stone-600">{selectedRecord.created_at}</span>
              </div>
            </div>

            <div className="text-right pt-2">
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 font-semibold rounded-xl text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {recordToDelete && (
        <Modal
          isOpen={!!recordToDelete}
          onClose={() => setRecordToDelete(null)}
          title="Confirm Deletion"
          maxWidth="sm"
        >
          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-3 text-rose-700">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <p className="text-sm font-semibold">Delete Prediction Record #{recordToDelete.id}?</p>
            </div>
            <p className="text-stone-600">
              Are you sure you want to delete the forecast for <strong>{recordToDelete.food_item_name}</strong> on <strong>{recordToDelete.prediction_date}</strong> at <strong>{recordToDelete.hotel_name}</strong>?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRecordToDelete(null)}
                className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white font-semibold rounded-xl text-xs"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
