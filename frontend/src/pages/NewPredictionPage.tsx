import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Users, 
  Utensils, 
  Calendar, 
  Clock, 
  Building2, 
  ShieldAlert, 
  Sliders, 
  AlertCircle, 
  CheckCircle2, 
  Info,
  ChevronRight,
  ListPlus
} from 'lucide-react';
import { api, AuthHotel } from '../api';
import { Hotel, FoodItem, Prediction } from '../types';
import { Badge } from '../components/Badge';

interface NewPredictionPageProps {
  onPredictionComplete?: () => void;
  hotel?: AuthHotel | null;
  onNavigateToUpgrade?: () => void;
}

export const NewPredictionPage: React.FC<NewPredictionPageProps> = ({ 
  onPredictionComplete,
  hotel,
  onNavigateToUpgrade
}) => {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Form state
  const [selectedHotelId, setSelectedHotelId] = useState<number | ''>('');
  const [forecastDate, setForecastDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [selectedMeal, setSelectedMeal] = useState<'Breakfast' | 'Lunch' | 'Dinner'>('Breakfast');
  const [selectedFoodItemId, setSelectedFoodItemId] = useState<number | ''>('');
  const [safetyBufferPercent, setSafetyBufferPercent] = useState<number>(5.0);
  const [isHolidayOrEvent, setIsHolidayOrEvent] = useState<boolean>(false);

  // Batch mode state
  const [batchMode, setBatchMode] = useState<boolean>(false);
  const [selectedBatchItemIds, setSelectedBatchItemIds] = useState<number[]>([]);
  const [batchResults, setBatchResults] = useState<Prediction[]>([]);

  // Execution state
  const [predicting, setPredicting] = useState<boolean>(false);
  const [predictionResult, setPredictionResult] = useState<Prediction | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoadingInitial(true);
      const [hotelsList, itemsList, settings] = await Promise.all([
        api.getHotels(),
        api.getFoodItems(),
        api.getSettings().catch(() => ({ default_safety_buffer: '5.0' }))
      ]);
      setHotels(hotelsList);
      setFoodItems(itemsList);
      if (hotel?.role === 'hotel') {
        setSelectedHotelId(hotel.hotel_id);
      } else if (hotelsList.length > 0) {
        setSelectedHotelId(hotelsList[0].id);
      }
      if (itemsList.length > 0) setSelectedFoodItemId(itemsList[0].id);
      if (settings?.default_safety_buffer) {
        setSafetyBufferPercent(parseFloat(settings.default_safety_buffer) || 5.0);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load initial hotel and food data');
    } finally {
      setLoadingInitial(false);
    }
  };

  const handleSinglePrediction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHotelId || !selectedFoodItemId || !forecastDate) {
      setError('Please select a hotel, date, meal, and food item.');
      return;
    }

    try {
      setPredicting(true);
      setError(null);
      setPredictionResult(null);

      const result = await api.makePrediction({
        hotel_id: Number(selectedHotelId),
        date: forecastDate,
        meal_type: selectedMeal,
        food_item_id: Number(selectedFoodItemId),
        safety_buffer_percent: Number(safetyBufferPercent),
        is_holiday_or_event: isHolidayOrEvent ? 1 : 0
      });

      setPredictionResult(result);
      if (onPredictionComplete) onPredictionComplete();
    } catch (err: any) {
      setError(err.message || 'Prediction execution failed.');
    } finally {
      setPredicting(false);
    }
  };

  const handleBatchPrediction = async () => {
    if (!selectedHotelId || !forecastDate || selectedBatchItemIds.length === 0) {
      setError('Please select hotel, date, meal, and at least one food item for batch forecasting.');
      return;
    }

    try {
      setPredicting(true);
      setError(null);
      setBatchResults([]);

      const res = await api.makeBatchPrediction({
        hotel_id: Number(selectedHotelId),
        date: forecastDate,
        meal_type: selectedMeal,
        food_item_ids: selectedBatchItemIds,
        safety_buffer_percent: Number(safetyBufferPercent),
        is_holiday_or_event: isHolidayOrEvent ? 1 : 0
      });

      setBatchResults(res.data || []);
      if (onPredictionComplete) onPredictionComplete();
    } catch (err: any) {
      setError(err.message || 'Batch prediction failed.');
    } finally {
      setPredicting(false);
    }
  };

  const selectedHotel = hotels.find((h) => h.id === Number(selectedHotelId));
  const selectedFoodItem = foodItems.find((f) => f.id === Number(selectedFoodItemId));

  if (loadingInitial) {
    return (
      <div className="p-8 text-center text-stone-500 animate-pulse">
        <Sparkles className="w-8 h-8 mx-auto mb-2 text-stone-400 animate-spin" />
        <p>Loading operational hotel catalogue & parameters...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-stone-900 tracking-tight">Generate F&B Provision Forecast</h2>
          <p className="text-sm text-stone-500">
            Produces Predicted Guest Count & Recommended Food Quantity simultaneously.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-stone-100 p-1 rounded-xl border border-stone-200">
          <button
            type="button"
            onClick={() => setBatchMode(false)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              !batchMode ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Single Item Mode
          </button>
          <button
            type="button"
            onClick={() => setBatchMode(true)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              batchMode ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Multi-Item Buffet Mode
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
          <div>
            <p className="font-semibold">Prediction Parameter Error</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Main Forecast Form */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-xs">
        <form onSubmit={handleSinglePrediction} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Hotel Selector */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">
                1. Operating Hotel {hotel?.role === 'hotel' ? '(Private Workspace)' : '*'}
              </label>
              {hotel?.role === 'hotel' ? (
                <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-stone-900 text-sm flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-emerald-700" />
                      {hotel.hotel_name}
                    </div>
                    <p className="text-xs text-stone-600 mt-0.5">
                      {hotel.city} · {hotel.star_rating}★ · Capacity: <strong className="text-emerald-800">{hotel.dining_capacity} seats</strong>
                    </p>
                  </div>
                  {onNavigateToUpgrade && (
                    <button
                      type="button"
                      onClick={onNavigateToUpgrade}
                      className="text-xs font-semibold text-emerald-800 bg-white border border-emerald-300 hover:bg-emerald-100/50 px-2.5 py-1.5 rounded-lg transition"
                    >
                      Upgrade &rarr;
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <select
                    value={selectedHotelId}
                    onChange={(e) => setSelectedHotelId(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-700 focus:bg-white transition-all font-medium"
                    required
                  >
                    {hotels.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name} — {h.city} ({h.dining_capacity} dining cap, {h.star_rating}★)
                      </option>
                    ))}
                  </select>
                  {selectedHotel && (
                    <p className="mt-1.5 text-xs text-stone-500">
                      Property capacity: <span className="font-semibold">{selectedHotel.dining_capacity} dining seats</span> | {selectedHotel.total_rooms} rooms
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Date Selector */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">
                2. Forecast Date *
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={forecastDate}
                  onChange={(e) => setForecastDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-700 focus:bg-white transition-all font-medium"
                  required
                />
              </div>
              <p className="mt-1.5 text-xs text-stone-500">
                Determines day of week, seasonal factors, and weekend occupancy trends.
              </p>
            </div>
          </div>

          {/* Meal Session Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">
              3. Service Session / Meal *
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['Breakfast', 'Lunch', 'Dinner'] as const).map((meal) => {
                const isSelected = selectedMeal === meal;
                return (
                  <button
                    key={meal}
                    type="button"
                    onClick={() => setSelectedMeal(meal)}
                    className={`py-3 px-4 rounded-xl border text-sm font-semibold transition-all flex flex-col items-center justify-center gap-1 ${
                      isSelected
                        ? 'border-emerald-700 bg-emerald-50 text-emerald-900 shadow-xs ring-2 ring-emerald-700/20'
                        : 'border-stone-200 bg-stone-50/50 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    <span>{meal}</span>
                    <span className="text-[10px] font-normal text-stone-500">
                      {meal === 'Breakfast' ? 'High In-house %' : meal === 'Dinner' ? 'Evening Dining' : 'Midday Service'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Food Item Selection */}
          {!batchMode ? (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">
                4. Food Item & Measurement Unit *
              </label>
              <select
                value={selectedFoodItemId}
                onChange={(e) => setSelectedFoodItemId(Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-700 focus:bg-white transition-all font-medium"
                required
              >
                {foodItems.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} [{f.category}] — Measured in {f.unit.toUpperCase()} (~{f.default_consumption_per_guest} {f.unit}/guest)
                  </option>
                ))}
              </select>
              {selectedFoodItem && (
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="blue">{selectedFoodItem.category}</Badge>
                  <Badge variant="amber">Unit: {selectedFoodItem.unit}</Badge>
                  <span className="text-xs text-stone-500">
                    Standard kitchen factor: {selectedFoodItem.default_consumption_per_guest} {selectedFoodItem.unit} per guest
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                  4. Select Multiple Buffet Menu Items *
                </label>
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedBatchItemIds(foodItems.map((f) => f.id))}
                    className="text-emerald-800 hover:underline font-semibold"
                  >
                    Select All
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => setSelectedBatchItemIds([])}
                    className="text-stone-500 hover:underline"
                  >
                    Clear All
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-56 overflow-y-auto p-3 border border-stone-200 rounded-xl bg-stone-50/50">
                {foodItems.map((item) => {
                  const isChecked = selectedBatchItemIds.includes(item.id);
                  return (
                    <label
                      key={item.id}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                        isChecked ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold' : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          setSelectedBatchItemIds((prev) =>
                            isChecked ? prev.filter((id) => id !== item.id) : [...prev, item.id]
                          );
                        }}
                        className="rounded-sm text-emerald-700 focus:ring-emerald-700"
                      />
                      <span className="truncate">{item.name}</span>
                      <span className="ml-auto text-[10px] text-stone-500 uppercase">{item.unit}</span>
                    </label>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-stone-500">
                {selectedBatchItemIds.length} items selected for this service forecast.
              </p>
            </div>
          )}

          {/* Safety Buffer & Special Event Controls */}
          <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/70 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-amber-700" />
                    Kitchen Safety Buffer
                  </label>
                  <span className="text-sm font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200">
                    +{safetyBufferPercent}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="25"
                  step="0.5"
                  value={safetyBufferPercent}
                  onChange={(e) => setSafetyBufferPercent(parseFloat(e.target.value))}
                  className="w-full accent-amber-600 cursor-pointer"
                />
                <p className="text-[11px] text-amber-800/80 mt-1">
                  Standard hotel recommended buffer is 5%. Protects against walk-ins and banquet overruns without causing waste.
                </p>
              </div>

              <div className="sm:border-l sm:border-amber-200 sm:pl-6 flex items-center">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-stone-800">
                  <input
                    type="checkbox"
                    checked={isHolidayOrEvent}
                    onChange={(e) => setIsHolidayOrEvent(e.target.checked)}
                    className="w-4 h-4 rounded-sm text-emerald-700 focus:ring-emerald-700"
                  />
                  <span>Special Event / Holiday / High-Occupancy Date</span>
                </label>
              </div>
            </div>
          </div>

          {/* Action Submit */}
          <div>
            {!batchMode ? (
              <button
                type="submit"
                disabled={predicting}
                className="w-full py-3.5 px-6 bg-[#1B4332] hover:bg-[#144531] text-white font-bold text-base rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {predicting ? (
                  <>
                    <Sparkles className="w-5 h-5 text-amber-300 animate-spin" />
                    <span>Calculating Guest Occupancy & Provision Requirements...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 text-amber-300" />
                    <span>Calculate Dual Provision Prediction</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleBatchPrediction}
                disabled={predicting || selectedBatchItemIds.length === 0}
                className="w-full py-3.5 px-6 bg-[#1B4332] hover:bg-[#144531] text-white font-bold text-base rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {predicting ? (
                  <>
                    <Sparkles className="w-5 h-5 text-amber-300 animate-spin" />
                    <span>Processing Buffet Batch Forecast...</span>
                  </>
                ) : (
                  <>
                    <ListPlus className="w-5 h-5 text-amber-300" />
                    <span>Generate Forecast for {selectedBatchItemIds.length} Buffet Items</span>
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>

      {/* DUAL PREDICTION RESULTS SECTION */}
      {predictionResult && !batchMode && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              Forecast Results
            </h3>
            <Badge variant="green">{predictionResult.prediction_method}</Badge>
          </div>

          {/* The TWO Mandatory Outputs in High-Visibility Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Output 1: PREDICTED GUEST COUNT */}
            <div className="bg-gradient-to-br from-emerald-900 to-emerald-950 text-white rounded-3xl p-6 sm:p-8 shadow-md border border-emerald-800 relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-emerald-300" />
                  Output 1: Guest Attendance
                </span>
                <span className="text-[11px] bg-emerald-800/60 px-2.5 py-0.5 rounded-full border border-emerald-700">
                  {predictionResult.meal_type} Session
                </span>
              </div>

              <h4 className="text-sm text-emerald-100 font-medium mt-1">Predicted Guest Count</h4>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-5xl font-extrabold tracking-tight text-white">
                  {predictionResult.predicted_guest_count}
                </span>
                <span className="text-lg font-medium text-emerald-300">Guests Expected</span>
              </div>

              <div className="mt-6 pt-4 border-t border-emerald-800/80 text-xs text-emerald-200/90 space-y-1">
                <p>
                  Hotel: <span className="font-semibold text-white">{predictionResult.hotel_name}</span>
                </p>
                <p>
                  Date: <span className="font-semibold text-white">{predictionResult.prediction_date}</span>
                </p>
                {selectedHotel && (
                  <p>
                    Dining Room Fill: <span className="font-semibold text-white">
                      {Math.round((predictionResult.predicted_guest_count / selectedHotel.dining_capacity) * 100)}%
                    </span> of {selectedHotel.dining_capacity} capacity
                  </p>
                )}
              </div>
            </div>

            {/* Output 2: RECOMMENDED FOOD QUANTITY */}
            <div className="bg-gradient-to-br from-amber-900 to-amber-950 text-white rounded-3xl p-6 sm:p-8 shadow-md border border-amber-800 relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <Utensils className="w-4 h-4 text-amber-300" />
                  Output 2: Culinary Provision
                </span>
                <span className="text-[11px] bg-amber-800/60 px-2.5 py-0.5 rounded-full border border-amber-700">
                  {predictionResult.unit.toUpperCase()}
                </span>
              </div>

              <h4 className="text-sm text-amber-100 font-medium mt-1">
                Recommended Food Quantity ({predictionResult.food_item_name})
              </h4>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-5xl font-extrabold tracking-tight text-white">
                  {predictionResult.recommended_food_quantity}
                </span>
                <span className="text-lg font-bold text-amber-300 uppercase">
                  {predictionResult.unit}
                </span>
              </div>

              <div className="mt-6 pt-4 border-t border-amber-800/80 text-xs text-amber-200/90 space-y-1">
                <p>
                  Base Estimated Quantity: <span className="font-semibold text-white">{predictionResult.base_estimated_quantity} {predictionResult.unit}</span>
                </p>
                <p>
                  Safety Buffer ({predictionResult.safety_buffer_percent}%): <span className="font-semibold text-white">+{predictionResult.safety_buffer_quantity} {predictionResult.unit}</span>
                </p>
                <p className="text-[11px] text-amber-300/80">
                  * Expressed as a kitchen recommendation, not a fixed guarantee.
                </p>
              </div>
            </div>
          </div>

          {/* Breakdown & Methodology Table */}
          <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-xs">
            <h4 className="text-sm font-bold text-stone-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Info className="w-4 h-4 text-stone-500" />
              Calculation Breakdown & Model Audit Trail
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
                <span className="text-stone-500">Methodology Applied</span>
                <p className="font-bold text-stone-900 mt-1">{predictionResult.prediction_method}</p>
              </div>
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
                <span className="text-stone-500">Base Net Requirement</span>
                <p className="font-bold text-stone-900 mt-1">{predictionResult.base_estimated_quantity} {predictionResult.unit}</p>
              </div>
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
                <span className="text-stone-500">Kitchen Safety Margin</span>
                <p className="font-bold text-emerald-800 mt-1">+{predictionResult.safety_buffer_quantity} {predictionResult.unit} (+{predictionResult.safety_buffer_percent}%)</p>
              </div>
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
                <span className="text-stone-500">Final Recommendation</span>
                <p className="font-bold text-amber-900 mt-1">{predictionResult.recommended_food_quantity} {predictionResult.unit}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BATCH RESULTS TABLE */}
      {batchMode && batchResults.length > 0 && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-stone-900">
                Buffet Menu Forecast Summary ({batchResults.length} Items)
              </h3>
              <p className="text-xs text-stone-500">
                Predicted Guest Count: <span className="font-bold text-emerald-800">{batchResults[0]?.predicted_guest_count} Guests</span>
              </p>
            </div>
            <Badge variant="green">Safety Buffer: +{safetyBufferPercent}%</Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500 uppercase tracking-wider font-semibold">
                  <th className="pb-3">Food Item</th>
                  <th className="pb-3">Category</th>
                  <th className="pb-3 text-right">Base Qty</th>
                  <th className="pb-3 text-right">Buffer</th>
                  <th className="pb-3 text-right font-bold text-stone-900">Recommended Qty</th>
                  <th className="pb-3 text-center">Unit</th>
                  <th className="pb-3 text-right">Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {batchResults.map((res) => (
                  <tr key={res.id} className="hover:bg-stone-50">
                    <td className="py-3 font-semibold text-stone-900">{res.food_item_name}</td>
                    <td className="py-3 text-stone-500">{res.food_category}</td>
                    <td className="py-3 text-right text-stone-600">{res.base_estimated_quantity}</td>
                    <td className="py-3 text-right text-emerald-700 font-medium">+{res.safety_buffer_quantity}</td>
                    <td className="py-3 text-right font-bold text-amber-900 text-sm">
                      {res.recommended_food_quantity}
                    </td>
                    <td className="py-3 text-center">
                      <Badge variant="amber">{res.unit}</Badge>
                    </td>
                    <td className="py-3 text-right text-stone-400 text-[11px] truncate max-w-[140px]" title={res.prediction_method}>
                      {res.prediction_method.includes('Random Forest') ? 'Random Forest ML' : 'Per-Guest Factor'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
