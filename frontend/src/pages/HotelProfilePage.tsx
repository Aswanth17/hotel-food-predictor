import React, { useState } from 'react';
import { 
  Building2, 
  Users, 
  BedDouble, 
  MapPin, 
  Star, 
  ShieldCheck, 
  ArrowUpRight, 
  CheckCircle2, 
  AlertCircle,
  Sparkles,
  TrendingUp,
  Save
} from 'lucide-react';
import { api, AuthHotel, setStoredHotel } from '../api';

interface HotelProfilePageProps {
  hotel: AuthHotel;
  onHotelUpdated: (updated: AuthHotel) => void;
  onNavigateToPrediction: () => void;
}

export const HotelProfilePage: React.FC<HotelProfilePageProps> = ({
  hotel,
  onHotelUpdated,
  onNavigateToPrediction
}) => {
  const [diningCapacity, setDiningCapacity] = useState<number>(hotel.dining_capacity || 150);
  const [totalRooms, setTotalRooms] = useState<number>(hotel.total_rooms || 100);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCapacityUpgrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      await api.upgradeCapacity(hotel.hotel_id, diningCapacity, totalRooms);
      const updated: AuthHotel = {
        ...hotel,
        dining_capacity: diningCapacity,
        total_rooms: totalRooms
      };
      setStoredHotel(updated);
      onHotelUpdated(updated);
      setSuccessMsg(`Capacity successfully upgraded! Dining hall now configured for ${diningCapacity} guests.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update capacity');
    } finally {
      setSaving(false);
    }
  };

  const addCapacityPreset = (delta: number) => {
    setDiningCapacity(prev => Math.max(20, prev + delta));
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#0E2F22] to-[#1E4D38] text-white p-6 rounded-2xl shadow-sm border border-emerald-900/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                Private Hotel Workspace
              </span>
              <span className="text-xs text-emerald-300/80">Tenant ID: #{hotel.hotel_id}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              {hotel.hotel_name}
            </h1>
            <p className="text-sm text-emerald-200/90 mt-1 flex items-center gap-3">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-amber-300" />
                {hotel.city}
              </span>
              <span className="flex items-center gap-1">
                <Star className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                {hotel.star_rating} Star Luxury Property
              </span>
            </p>
          </div>

          <button
            onClick={onNavigateToPrediction}
            className="inline-flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-stone-900 font-semibold px-4 py-2.5 rounded-xl text-sm transition shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-stone-900" />
            New Provision Forecast
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center gap-3 text-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Current Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Dining Hall Capacity</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-stone-900">{hotel.dining_capacity}</div>
          <p className="text-xs text-stone-500 mt-1">Maximum dining guests per service</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Guest Rooms</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-700">
              <BedDouble className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-stone-900">{hotel.total_rooms}</div>
          <p className="text-xs text-stone-500 mt-1">Available lodging inventory</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Data Isolation</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="text-sm font-bold text-emerald-700 mt-1">Strict Tenant Isolation</div>
          <p className="text-xs text-stone-500 mt-1">No other hotel can access your records</p>
        </div>
      </div>

      {/* Capacity Upgrade Section */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-stone-100">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-stone-900">Hotel Capacity Upgrade</h2>
            <p className="text-xs text-stone-500">
              Modify your dining seating or room capacity. The Machine Learning models automatically adjust their provision predictions based on this value.
            </p>
          </div>
        </div>

        <form onSubmit={handleCapacityUpgrade} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Dining Capacity */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                Dining Hall Capacity (Seats / Max Covers)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="20"
                  max="5000"
                  required
                  value={diningCapacity}
                  onChange={(e) => setDiningCapacity(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent text-lg font-semibold text-stone-900"
                />
                <span className="absolute right-4 top-3 text-xs text-stone-400 font-medium">seats</span>
              </div>
              <p className="text-xs text-stone-500">
                Determines the upper bound for guest count prediction per meal session.
              </p>

              {/* Quick Presets */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-stone-500 font-medium">Quick Adjust:</span>
                <button
                  type="button"
                  onClick={() => addCapacityPreset(25)}
                  className="px-2.5 py-1 text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition"
                >
                  +25 Seats
                </button>
                <button
                  type="button"
                  onClick={() => addCapacityPreset(50)}
                  className="px-2.5 py-1 text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition"
                >
                  +50 Seats
                </button>
                <button
                  type="button"
                  onClick={() => addCapacityPreset(100)}
                  className="px-2.5 py-1 text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition"
                >
                  +100 Seats
                </button>
              </div>
            </div>

            {/* Total Rooms */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                Total Guest Rooms
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="5"
                  max="2000"
                  required
                  value={totalRooms}
                  onChange={(e) => setTotalRooms(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent text-lg font-semibold text-stone-900"
                />
                <span className="absolute right-4 top-3 text-xs text-stone-400 font-medium">rooms</span>
              </div>
              <p className="text-xs text-stone-500">
                Used to calculate occupancy baselines for breakfast and dinner services.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0E2F22] hover:bg-[#1E4D38] text-white font-semibold text-sm transition shadow-sm disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving Changes...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save & Upgrade Capacity
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Information Banner */}
      <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-5 text-xs text-amber-900 space-y-2">
        <div className="font-bold flex items-center gap-2 text-sm text-amber-950">
          <Building2 className="w-4 h-4 text-amber-700" />
          Why You Only See Your Own Hotel
        </div>
        <p className="leading-relaxed">
          In this upgraded multi-tenant architecture, individual hotels have strict data isolation. 
          Your historical consumption records, custom calendar events, and food forecasts belong 
          exclusively to <strong>{hotel.hotel_name}</strong>. Cross-hotel comparisons, model performance metrics, 
          and all-hotel monitoring are managed under the centralized <strong>Admin account</strong>.
        </p>
      </div>
    </div>
  );
};
