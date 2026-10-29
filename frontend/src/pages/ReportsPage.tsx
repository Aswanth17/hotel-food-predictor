import React, { useState, useEffect } from 'react';
import {
  BarChart2, TrendingUp, Download, Calendar, Filter, PieChart as PieIcon,
  ChevronDown, RefreshCw, Hotel as HotelIcon
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid
} from 'recharts';
import { api } from '../api';
import { Hotel } from '../types';

const GREENS = ['#1B4332', '#2D6A4F', '#40916C', '#52B788', '#74C69D', '#95D5B2', '#B7E4C7'];

export const ReportsPage: React.FC = () => {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [selectedHotel, setSelectedHotel] = useState<number | ''>('');
  const [period, setPeriod] = useState<'7' | '30' | '90' | '180'>('30');
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getHotels().then(h => { setHotels(h); if (h.length) setSelectedHotel(h[0].id); });
  }, []);

  useEffect(() => { if (selectedHotel) load(); }, [selectedHotel, period]);

  const load = async () => {
    if (!selectedHotel) return;
    try {
      setLoading(true); setError(null);
      const res = await api.getReport({ hotel_id: selectedHotel, days: parseInt(period) as any });
      setReport(res);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const mealColors = { Breakfast: '#F59E0B', Lunch: '#3B82F6', Dinner: '#1B4332' };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-stone-900">Analytics & Reports</h2>
          <p className="text-sm text-stone-500">Visual insights on guest patterns and food consumption trends.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={selectedHotel} onChange={e => setSelectedHotel(Number(e.target.value))}
            className="px-3 py-2 text-xs rounded-xl border border-stone-200 bg-white font-semibold text-stone-800 focus:ring-2 focus:ring-emerald-700 focus:outline-hidden min-w-[180px]">
            {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <div className="flex rounded-xl border border-stone-200 overflow-hidden text-xs font-semibold">
            {(['7', '30', '90', '180'] as const).map(d => (
              <button key={d} onClick={() => setPeriod(d)}
                className={`px-3 py-2 ${period === d ? 'bg-[#1B4332] text-white' : 'bg-white text-stone-600 hover:bg-stone-50'}`}>
                {d}d
              </button>
            ))}
          </div>
          <button onClick={load} className="p-2 rounded-xl border border-stone-200 hover:bg-stone-50"><RefreshCw className="w-4 h-4 text-stone-500" /></button>
          {report && (
            <a href={api.getExportUrl('summary', { hotel_id: selectedHotel as number, days: parseInt(period) })}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#1B4332] text-white text-xs font-semibold rounded-xl hover:bg-[#144531]">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </a>
          )}
        </div>
      </div>

      {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">{error}</div>}

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1,2,3,4].map(i => <div key={i} className="h-72 bg-stone-200/60 rounded-2xl animate-pulse" />)}
        </div>
      ) : !report ? (
        <div className="p-12 text-center text-stone-400 bg-white rounded-2xl border border-stone-200">
          <BarChart2 className="w-10 h-10 mx-auto mb-3 text-stone-300" />
          <p>Select a hotel to view analytics.</p>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {[
              { label: 'Total Predictions', value: report.summary?.total_predictions, suffix: '', icon: '🔮' },
              { label: 'Avg Guest Count', value: report.summary?.avg_predicted_guests?.toFixed(0), suffix: ' guests', icon: '👥' },
              { label: 'Avg Food Qty', value: report.summary?.avg_recommended_quantity?.toFixed(1), suffix: ' ' + (report.summary?.most_common_unit || 'kg'), icon: '🍽️' },
              { label: 'Most Active Meal', value: report.summary?.most_common_meal, suffix: '', icon: '🕐' },
            ].map(({ label, value, suffix, icon }) => (
              <div key={label} className="bg-white rounded-2xl border border-stone-200 p-4 shadow-xs">
                <div className="text-2xl mb-1">{icon}</div>
                <p className="text-stone-500">{label}</p>
                <p className="font-extrabold text-stone-900 text-lg mt-0.5">{value ?? '—'}{suffix}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Predicted Guest Count Over Time */}
            {report.guest_count_trend?.length > 0 && (
              <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-5">
                <h3 className="font-bold text-stone-900 text-sm mb-4">Predicted Guest Count Trend</h3>
                <div className="h-52">
                  <ResponsiveContainer>
                    <AreaChart data={report.guest_count_trend} margin={{ left: -10 }}>
                      <defs>
                        <linearGradient id="gGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1B4332" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#1B4332" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      <Area type="monotone" dataKey="avg_guest_count" stroke="#1B4332" strokeWidth={2} fill="url(#gGrad)" name="Avg Guests" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Meal Type Distribution */}
            {report.meal_distribution?.length > 0 && (
              <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-5">
                <h3 className="font-bold text-stone-900 text-sm mb-4">Predictions by Meal Type</h3>
                <div className="h-52">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={report.meal_distribution} dataKey="count" nameKey="meal_type" cx="50%" cy="50%" outerRadius={80} label={(entry: any) => `${entry.meal_type || ''} ${(((entry.percent as number) || 0) * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                        {report.meal_distribution.map((entry: any, i: number) => (
                          <Cell key={i} fill={(mealColors as any)[entry.meal_type] || GREENS[i % GREENS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Top Food Items by Recommended Quantity */}
            {report.top_food_items?.length > 0 && (
              <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-5">
                <h3 className="font-bold text-stone-900 text-sm mb-4">Top Food Items — Avg Recommended Quantity</h3>
                <div className="h-52">
                  <ResponsiveContainer>
                    <BarChart data={report.top_food_items} layout="vertical" margin={{ left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="food_item_name" tick={{ fontSize: 9 }} width={110} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v, n, p) => [`${v} ${p.payload.unit}`, 'Avg Qty']} />
                      <Bar dataKey="avg_quantity" radius={[0, 4, 4, 0]}>
                        {report.top_food_items.map((_: any, i: number) => <Cell key={i} fill={GREENS[i % GREENS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Guest Count by Day of Week */}
            {report.guest_count_by_dow?.length > 0 && (
              <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-5">
                <h3 className="font-bold text-stone-900 text-sm mb-4">Avg Predicted Guests by Day of Week</h3>
                <div className="h-52">
                  <ResponsiveContainer>
                    <BarChart data={report.guest_count_by_dow}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="day_name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      <Bar dataKey="avg_guests" radius={[4, 4, 0, 0]} name="Avg Guests">
                        {report.guest_count_by_dow.map((_: any, i: number) => (
                          <Cell key={i} fill={i >= 5 ? '#1B4332' : '#52B788'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[10px] text-stone-400 mt-2">Darker bars indicate weekends (higher occupancy expected)</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
