import React, { useEffect, useState } from 'react';
import { 
  Building2, 
  UtensilsCrossed, 
  Database, 
  Sparkles, 
  TrendingUp, 
  ArrowRight,
  Clock,
  Layers,
  ChefHat
} from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, 
  ResponsiveContainer, CartesianGrid, Legend 
} from 'recharts';
import { api, AuthHotel } from '../api';
import { DashboardStats } from '../types';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';

interface DashboardPageProps {
  onNavigateToNewPrediction: () => void;
  onNavigateToHistory: () => void;
  hotel?: AuthHotel | null;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ 
  onNavigateToNewPrediction, 
  onNavigateToHistory,
  hotel
}) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, [hotel?.hotel_id]);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const hotelId = hotel?.role === 'hotel' ? hotel.hotel_id : undefined;
      const data = await api.getDashboardStats(hotelId);
      setStats(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-stone-200/70 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-80 bg-stone-200/70 rounded-2xl" />
          <div className="h-80 bg-stone-200/70 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center text-rose-800">
        <p className="font-semibold text-lg">Unable to load dashboard data</p>
        <p className="text-sm mt-1">{error || 'Server error'}</p>
        <button
          onClick={loadStats}
          className="mt-4 px-4 py-2 bg-rose-700 text-white rounded-xl text-sm font-medium hover:bg-rose-800"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#1B4332] to-[#2D6A4F] text-white rounded-3xl p-8 shadow-sm relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-emerald-200 text-xs font-semibold backdrop-blur-xs mb-3">
            <ChefHat className="w-3.5 h-3.5 text-amber-300" />
            Hotel F&B Operations Management
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Provision Requirement & Guest Forecaster
          </h2>
          <p className="mt-2 text-sm text-emerald-100/90 leading-relaxed">
            Machine learning analytics for commercial hotel dining. Predict breakfast, lunch, and dinner 
            guest counts and forecast precise ingredient requirements in kilograms, litres, or pieces.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={onNavigateToNewPrediction}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-900 font-bold text-sm rounded-xl transition-all shadow-xs"
            >
              <Sparkles className="w-4 h-4 text-stone-900" />
              <span>Generate New Prediction</span>
            </button>
            <button
              onClick={onNavigateToHistory}
              className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-medium text-sm rounded-xl transition-colors backdrop-blur-xs"
            >
              <Clock className="w-4 h-4 text-emerald-200" />
              <span>View Past Forecasts</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {hotel?.role === 'hotel' ? (
          <StatCard
            title="Dining Hall Capacity"
            value={`${hotel.dining_capacity} seats`}
            subtitle={`${hotel.city} (${hotel.star_rating}★)`}
            icon={Building2}
            color="forest"
          />
        ) : (
          <StatCard
            title="Monitored Hotels"
            value={stats.total_hotels}
            subtitle="Operating properties"
            icon={Building2}
            color="forest"
          />
        )}
        <StatCard
          title="Active Food Items"
          value={stats.total_food_items}
          subtitle="Catalogue ingredients"
          icon={UtensilsCrossed}
          color="amber"
        />
        <StatCard
          title="Historical Records"
          value={stats.total_historical_records.toLocaleString()}
          subtitle="Collected meal services"
          icon={Database}
          color="blue"
        />
        <StatCard
          title="Forecasts Made"
          value={stats.total_predictions}
          subtitle="Predictions logged"
          icon={Sparkles}
          color="purple"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Guest Count Trends */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-stone-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-stone-900">Historical Guest Attendance Trends</h3>
              <p className="text-xs text-stone-500">Average, minimum, and peak guests served per service date</p>
            </div>
            <Badge variant="green">Last 14 Days</Badge>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.guest_trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0ECE4" />
                <XAxis 
                  dataKey="record_date" 
                  tick={{ fontSize: 11, fill: '#78716C' }}
                  tickFormatter={(val) => val.slice(5)}
                />
                <YAxis tick={{ fontSize: 11, fill: '#78716C' }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1C1917', 
                    borderRadius: '12px', 
                    color: '#FFF', 
                    fontSize: '12px',
                    border: 'none'
                  }} 
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Line 
                  type="monotone" 
                  dataKey="avg_guest_count" 
                  name="Avg Guests" 
                  stroke="#1B4332" 
                  strokeWidth={2.5} 
                  dot={{ r: 3, fill: '#1B4332' }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="max_guest_count" 
                  name="Peak Guests" 
                  stroke="#D97706" 
                  strokeWidth={2} 
                  strokeDasharray="4 4" 
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Meal Session Distribution */}
        <div className="bg-white rounded-2xl p-6 border border-stone-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-stone-900">Meal Session Load</h3>
              <p className="text-xs text-stone-500">Average guest attendance by session</p>
            </div>
            <Layers className="w-4 h-4 text-stone-400" />
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.meal_distribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0ECE4" />
                <XAxis dataKey="meal_type" tick={{ fontSize: 11, fill: '#78716C' }} />
                <YAxis tick={{ fontSize: 11, fill: '#78716C' }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1C1917', 
                    borderRadius: '12px', 
                    color: '#FFF', 
                    fontSize: '12px',
                    border: 'none' 
                  }} 
                />
                <Bar dataKey="avg_guests" name="Avg Guests" fill="#2D8A63" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Consumed Items & Recent Predictions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Food Items */}
        <div className="bg-white rounded-2xl p-6 border border-stone-200/80 shadow-xs">
          <h3 className="text-base font-bold text-stone-900 mb-1">Top Utilized Buffet Items</h3>
          <p className="text-xs text-stone-500 mb-4">Cumulative consumption across all properties</p>
          <div className="space-y-3">
            {stats.top_food_items.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-100">
                <div className="flex items-center space-x-3">
                  <span className="w-6 h-6 rounded-lg bg-stone-200 text-stone-700 flex items-center justify-center text-xs font-bold">
                    {idx + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-stone-900">{item.name}</p>
                    <p className="text-xs text-stone-500">{item.category}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-stone-900">
                    {item.total_consumed.toLocaleString()} <span className="text-xs font-normal text-stone-500">{item.unit}</span>
                  </p>
                  <p className="text-[11px] text-stone-500">~{item.avg_per_service} {item.unit}/svc</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Predictions Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-stone-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-stone-900">Recent Prediction Logs</h3>
              <p className="text-xs text-stone-500">Dual output: Predicted Guests & Recommended Quantity</p>
            </div>
            <button
              onClick={onNavigateToHistory}
              className="text-xs font-semibold text-emerald-800 hover:text-emerald-900 flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-100 text-stone-500 uppercase tracking-wider font-semibold">
                  <th className="pb-3">Date & Session</th>
                  <th className="pb-3">Hotel</th>
                  <th className="pb-3">Food Item</th>
                  <th className="pb-3 text-right">Predicted Guests</th>
                  <th className="pb-3 text-right">Recommended Qty</th>
                  <th className="pb-3 text-right">Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {stats.recent_predictions.map((p) => (
                  <tr key={p.id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="py-3">
                      <p className="font-semibold text-stone-900">{p.prediction_date}</p>
                      <p className="text-[11px] text-stone-500">{p.meal_type}</p>
                    </td>
                    <td className="py-3 font-medium text-stone-700">{p.hotel_name}</td>
                    <td className="py-3">
                      <p className="font-semibold text-stone-900">{p.food_item_name}</p>
                      <Badge variant="gray">{p.food_category}</Badge>
                    </td>
                    <td className="py-3 text-right">
                      <span className="font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/60">
                        {p.predicted_guest_count} Guests
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <span className="font-bold text-amber-900 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/60">
                        {p.recommended_food_quantity} {p.unit}
                      </span>
                      <p className="text-[10px] text-stone-400 mt-0.5">Buffer: +{p.safety_buffer_percent}%</p>
                    </td>
                    <td className="py-3 text-right text-[11px] text-stone-500 max-w-[150px] truncate" title={p.prediction_method}>
                      {p.prediction_method.includes('Random Forest') ? 'Random Forest' : 'Per-Guest Factor'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
