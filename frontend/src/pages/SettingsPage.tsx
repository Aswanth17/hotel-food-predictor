import React, { useState, useEffect } from 'react';
import { Settings, Save, Info, Cpu, Database, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { api } from '../api';

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<any>(null);
  const [localBuffer, setLocalBuffer] = useState('5');

  useEffect(() => {
    load();
    api.getHealth().then(setHealth).catch(() => {});
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const s = await api.getSettings();
      setSettings(s);
      setLocalBuffer(s['default_safety_buffer'] ?? '5');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    const bufferVal = parseFloat(localBuffer);
    if (isNaN(bufferVal) || bufferVal < 0 || bufferVal > 50) {
      setError('Safety buffer must be between 0% and 50%.');
      return;
    }
    try {
      setSaving(true); setError(null);
      await api.updateSettings({ default_safety_buffer: bufferVal.toString() });
      setSuccess('Settings saved successfully.');
      setTimeout(() => setSuccess(null), 3000);
      load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-extrabold text-stone-900">Settings & About</h2>
        <p className="text-sm text-stone-500">Configure system defaults and review project information.</p>
      </div>

      {success && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {success}
        </div>
      )}
      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Prediction Defaults */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
            <Settings className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h3 className="font-bold text-stone-900">Prediction Defaults</h3>
            <p className="text-xs text-stone-500">Default values applied when making new food quantity predictions.</p>
          </div>
        </div>

        {loading ? (
          <div className="h-20 bg-stone-100 rounded-xl animate-pulse" />
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-stone-50 rounded-xl border border-stone-100">
              <label className="block text-sm font-bold text-stone-700 mb-1">
                Default Safety Buffer (%)
              </label>
              <p className="text-xs text-stone-500 mb-3">
                Extra food quantity added on top of the base ML prediction to account for unexpected guest surges.
                Formula: <code className="bg-stone-200 px-1 rounded text-[11px]">Recommended Qty = Base Qty × (1 + buffer/100)</code>
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="number" min="0" max="50" step="0.5"
                  value={localBuffer}
                  onChange={e => setLocalBuffer(e.target.value)}
                  className="w-28 px-3 py-2 rounded-xl border border-stone-200 bg-white focus:ring-2 focus:ring-emerald-700 focus:outline-hidden text-sm font-bold text-stone-900"
                />
                <span className="text-stone-500 text-sm font-medium">%</span>
                <div className="flex gap-1">
                  {[0, 5, 10, 15, 20].map(v => (
                    <button key={v} onClick={() => setLocalBuffer(String(v))}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                        localBuffer === String(v)
                          ? 'bg-[#1B4332] text-white border-[#1B4332]'
                          : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                      }`}>
                      {v}%
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-stone-400 mt-2">
                Recommended range: 5%–15%. Current DB value: <strong>{settings['default_safety_buffer'] ?? '5'}%</strong>
              </p>
            </div>

            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#1B4332] text-white text-sm font-bold rounded-xl hover:bg-[#144531] disabled:opacity-60">
              <Save className="w-4 h-4" />{saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        )}
      </div>

      {/* System Status */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-100">
              <Cpu className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="font-bold text-stone-900">System Status</h3>
          </div>
          <button onClick={() => api.getHealth().then(setHealth)} className="text-xs text-stone-500 flex items-center gap-1 hover:text-stone-800">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {health ? (
          <div className="grid grid-cols-2 gap-3 text-xs">
            {[
              { label: 'API Status', value: health.status === 'healthy' ? '✅ Healthy' : '❌ Degraded', ok: health.status === 'healthy' },
              { label: 'Database', value: health.database_connected ? '✅ Connected' : '❌ Disconnected', ok: health.database_connected },
              { label: 'Guest Count Model', value: health.models?.guest_count_model_present ? '✅ Loaded' : '⚠️ Not trained', ok: health.models?.guest_count_model_present },
              { label: 'Food Qty Model', value: health.models?.food_quantity_model_present ? '✅ Loaded' : '⚠️ Not trained', ok: health.models?.food_quantity_model_present },
            ].map(({ label, value, ok }) => (
              <div key={label} className={`p-3 rounded-xl border ${ok ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
                <p className="text-stone-500">{label}</p>
                <p className="font-bold text-stone-900 mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-stone-400">Connecting to backend…</p>
        )}
      </div>

      {/* About the Project */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-100">
            <Info className="w-5 h-5 text-amber-600" />
          </div>
          <h3 className="font-bold text-stone-900">About This Project</h3>
        </div>
        <div className="space-y-3 text-sm text-stone-700">
          <div className="p-4 bg-gradient-to-br from-[#144531]/5 to-amber-50/50 rounded-xl border border-stone-100">
            <h4 className="font-bold text-stone-900 text-base mb-1">Food Provision Requirement Predictor for Hotels</h4>
            <p className="text-xs text-stone-500">Final Year College Project — Hotel F&B Demand Analytics System</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {[
              { label: 'Frontend', value: 'React 18 + TypeScript + Vite' },
              { label: 'Styling', value: 'Tailwind CSS v4' },
              { label: 'Charts', value: 'Recharts' },
              { label: 'Backend', value: 'Python Flask (REST API)' },
              { label: 'Database', value: 'SQLite (local)' },
              { label: 'ML Engine', value: 'Pure-Python Random Forest (no DLL deps)' },
            ].map(({ label, value }) => (
              <div key={label} className="p-3 bg-stone-50 rounded-xl border border-stone-100">
                <p className="text-stone-400">{label}</p>
                <p className="font-semibold text-stone-800">{value}</p>
              </div>
            ))}
          </div>
          <div className="p-4 bg-stone-50 rounded-xl border border-stone-100 text-xs space-y-2">
            <p className="font-bold text-stone-700">Two Core ML Outputs</p>
            <div className="flex gap-2 flex-wrap">
              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg font-semibold border border-emerald-200">
                1️⃣ Predicted Guest Count
              </span>
              <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg font-semibold border border-amber-200">
                2️⃣ Recommended Food Quantity (kg / litres / pieces)
              </span>
            </div>
            <p className="text-stone-500 leading-relaxed">
              Guest Count is predicted by a Random Forest using hotel capacity, star rating, day-of-week, meal type, seasonality, and event indicators.
              Food Quantity is then predicted from the guest count estimate using per-item historical consumption rates, with a configurable safety buffer applied.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
