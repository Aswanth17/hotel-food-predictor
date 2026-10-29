import React, { useState, useEffect } from 'react';
import {
  Cpu, RefreshCw, AlertTriangle, CheckCircle2, XCircle,
  Trophy, TrendingDown, TrendingUp, Zap
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis
} from 'recharts';
import { api } from '../api';
import { ModelMetric } from '../types';
import { Badge } from '../components/Badge';

export const ModelPerformancePage: React.FC = () => {
  const [data,        setData]        = useState<any>(null);
  const [comparison,  setComparison]  = useState<any>(null);
  const [loading,     setLoading]     = useState(true);
  const [training,    setTraining]    = useState(false);
  const [trainXGB,    setTrainXGB]    = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [success,     setSuccess]     = useState<string | null>(null);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true); setError(null);
    try {
      const [metrics, comp] = await Promise.all([
        api.getModelMetrics(),
        api.getModelComparison().catch(() => null)
      ]);
      setData(metrics);
      setComparison(comp);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleRetrain = async () => {
    setTraining(true); setError(null); setSuccess(null);
    try {
      const res = await api.retrainModels();
      setSuccess(`Random Forest trained. Guest R²: ${res.guest_model?.r2_score?.toFixed(4)}, Food R²: ${res.food_model?.r2_score?.toFixed(4)}`);
      loadAll();
    } catch (e: any) { setError(e.message); }
    finally { setTraining(false); }
  };

  const handleTrainXGB = async () => {
    setTrainXGB(true); setError(null); setSuccess(null);
    try {
      const res = await api.retrainXGBoost();
      setSuccess(`XGBoost trained. Guest R²: ${res.guest_model?.r2_score?.toFixed(4)}, Food R²: ${res.food_model?.r2_score?.toFixed(4)}`);
      loadAll();
    } catch (e: any) { setError(e.message); }
    finally { setTrainXGB(false); }
  };

  // ── Metric card ─────────────────────────────────────────────────────────────
  const MetricCard = ({ model, label, algorithm }: { model: ModelMetric | null; label: string; algorithm?: string }) => {
    if (!model) return (
      <div className="bg-white rounded-2xl border border-stone-200 p-6 flex flex-col items-center justify-center gap-3 text-center h-52">
        <XCircle className="w-8 h-8 text-stone-300" />
        <p className="font-semibold text-stone-600">{label}</p>
        <p className="text-xs text-stone-400">Not yet trained. Click "Train" to begin.</p>
      </div>
    );

    const r2Color = model.r2_score >= 0.85 ? 'text-emerald-700' : model.r2_score >= 0.6 ? 'text-amber-700' : 'text-rose-700';
    const r2Bg    = model.r2_score >= 0.85 ? 'bg-emerald-50 border-emerald-200' : model.r2_score >= 0.6 ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200';

    const mapeVal = (model as any).mape;
    const accuracy = mapeVal != null && mapeVal < 100 ? (100 - mapeVal).toFixed(1) + '%' : 'N/A';

    return (
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-stone-100 bg-stone-50/70 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-stone-900 text-sm">{label}</h3>
            <p className="text-xs text-stone-500 mt-0.5">{algorithm || model.algorithm}</p>
          </div>
          <Badge variant={model.is_reliable ? 'green' : 'red'}>
            {model.is_reliable ? 'Reliable' : 'Unreliable'}
          </Badge>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className={`p-2.5 rounded-xl border ${r2Bg}`}>
              <p className="text-stone-500">R²</p>
              <p className={`text-lg font-extrabold mt-0.5 ${r2Color}`}>{model.r2_score.toFixed(3)}</p>
              <p className="text-[10px] text-stone-400">Fit quality</p>
            </div>
            <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-100">
              <p className="text-stone-500">MAE</p>
              <p className="text-lg font-extrabold text-stone-900 mt-0.5">{model.mae.toFixed(2)}</p>
              <p className="text-[10px] text-stone-400">Avg error</p>
            </div>
            <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-100">
              <p className="text-stone-500">RMSE</p>
              <p className="text-lg font-extrabold text-stone-900 mt-0.5">{model.rmse.toFixed(2)}</p>
              <p className="text-[10px] text-stone-400">Penalised</p>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-100">
              <p className="text-stone-500">Acc.</p>
              <p className="text-lg font-extrabold text-blue-700 mt-0.5">{accuracy}</p>
              <p className="text-[10px] text-stone-400">100−MAPE</p>
            </div>
          </div>
          <div className="flex gap-3 text-xs text-stone-500">
            <span>Dataset: <strong className="text-stone-800">{model.dataset_size}</strong></span>
            <span>Train: <strong className="text-stone-800">{model.train_size}</strong></span>
            <span>Test: <strong className="text-stone-800">{model.test_size}</strong></span>
          </div>
          <p className="text-[11px] text-stone-400">Trained: {model.training_date?.slice(0, 16)}</p>
        </div>
      </div>
    );
  };

  // ── Comparison bar chart ────────────────────────────────────────────────────
  const ComparisonChart = () => {
    if (!comparison?.comparison?.length) return null;
    const comp = comparison.comparison;

    const guestItems = comp.filter((r: any) => r.model_name.includes('guest'));
    const foodItems  = comp.filter((r: any) => r.model_name.includes('food'));

    const buildChartData = (items: any[], metric: string) =>
      items.map((r: any) => ({
        name: r.algorithm_key === 'xgboost' ? 'XGBoost' : 'Random Forest',
        value: parseFloat(r[metric]?.toFixed(3) || '0'),
        fill: r.algorithm_key === 'xgboost' ? '#3b82f6' : '#10b981'
      }));

    const best = comparison.best_models || {};

    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h3 className="font-bold text-stone-900">RF vs XGBoost Comparison</h3>
        </div>

        {/* Best model summary */}
        <div className="grid grid-cols-2 gap-4">
          {['guest', 'food'].map(t => (
            <div key={t} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-xs text-amber-600 font-semibold uppercase tracking-wide">
                Best for {t === 'guest' ? 'Guest Count' : 'Food Quantity'}
              </p>
              <p className="font-bold text-stone-900 mt-1 text-sm">
                {best[t]?.includes('xgb') ? '🔵 XGBoost' : '🟢 Random Forest'}
              </p>
              <p className="text-[11px] text-stone-500 mt-0.5">Selected by lowest RMSE on test set</p>
            </div>
          ))}
        </div>

        {/* Charts grid */}
        {[
          { title: 'Guest Count — MAE (lower ✓)', items: guestItems, metric: 'mae' },
          { title: 'Food Quantity — MAE (lower ✓)', items: foodItems, metric: 'mae' },
          { title: 'Guest Count — RMSE (lower ✓)', items: guestItems, metric: 'rmse' },
          { title: 'Food Quantity — RMSE (lower ✓)', items: foodItems, metric: 'rmse' },
          { title: 'Guest Count — R² (higher ✓)', items: guestItems, metric: 'r2_score' },
          { title: 'Food Quantity — R² (higher ✓)', items: foodItems, metric: 'r2_score' },
        ].map(({ title, items, metric }) => (
          items.length >= 2 && (
            <div key={title} className="bg-white rounded-xl border border-stone-200 p-4">
              <p className="text-sm font-semibold text-stone-700 mb-3">{title}</p>
              <ResponsiveContainer width="100%" height={100}>
                <BarChart data={buildChartData(items, metric)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={100} />
                  <Tooltip formatter={(v: any) => v.toFixed(4)} />
                  <Bar dataKey="value" radius={[0,6,6,0]}>
                    {buildChartData(items, metric).map((entry, idx) => (
                      <rect key={idx} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )
        ))}
      </div>
    );
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Cpu className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-stone-900">ML Model Performance</h2>
            <p className="text-sm text-stone-500">Random Forest vs XGBoost — fair comparison on same data</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleRetrain} disabled={training}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white text-sm font-semibold rounded-xl hover:bg-emerald-800 disabled:opacity-60 transition-colors">
            <RefreshCw className={`w-4 h-4 ${training ? 'animate-spin' : ''}`} />
            {training ? 'Training RF…' : 'Train RF'}
          </button>
          <button onClick={handleTrainXGB} disabled={trainXGB}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-60 transition-colors">
            <Zap className={`w-4 h-4 ${trainXGB ? 'animate-spin' : ''}`} />
            {trainXGB ? 'Training XGB…' : 'Train XGBoost'}
          </button>
        </div>
      </div>

      {error   && <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0"/>{error}</div>}
      {success && <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm flex gap-2"><CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0"/>{success}</div>}

      {/* Explanation banner */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
        <p className="font-semibold mb-1">📊 How to read these metrics</p>
        <ul className="list-disc list-inside space-y-0.5 text-xs">
          <li><strong>R²</strong> (Coefficient of Determination): Higher is better. 1.0 = perfect, 0.0 = baseline average.</li>
          <li><strong>MAE</strong> (Mean Absolute Error): Average prediction error in original units. Lower is better.</li>
          <li><strong>RMSE</strong>: Like MAE but penalises large errors more. Lower is better.</li>
          <li><strong>Accuracy %</strong> = 100 − MAPE (only when actuals are non-zero). Not classification accuracy.</li>
          <li>Both models evaluated on the same 20% hold-out test set with seed 42 — fair comparison.</li>
        </ul>
      </div>

      {/* Random Forest section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <h3 className="font-bold text-stone-900">🌲 Random Forest (Pure-Python Implementation)</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MetricCard model={data?.guest_count_model} label="Guest Count Predictor" />
          <MetricCard model={data?.food_quantity_model} label="Food Quantity Predictor" />
        </div>
      </div>

      {/* XGBoost section */}
      {comparison?.comparison?.some((r: any) => r.algorithm_key === 'xgboost') && (() => {
        const xgbGuest = comparison.comparison.find((r: any) => r.algorithm_key === 'xgboost' && r.model_name.includes('guest'));
        const xgbFood  = comparison.comparison.find((r: any) => r.algorithm_key === 'xgboost' && r.model_name.includes('food'));
        return (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <h3 className="font-bold text-stone-900">⚡ XGBoost (Gradient Boosted Trees)</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MetricCard model={xgbGuest as any} label="Guest Count Predictor (XGB)" algorithm="XGBoost Regressor" />
              <MetricCard model={xgbFood  as any} label="Food Quantity Predictor (XGB)" algorithm="XGBoost Regressor" />
            </div>
          </div>
        );
      })()}

      {/* Comparison charts */}
      {comparison && <ComparisonChart />}

      {/* Dataset info */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5">
        <h3 className="font-bold text-stone-900 mb-2">📚 Training Data Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-stone-500 text-xs">Total Records Available</p>
            <p className="font-bold text-stone-900 text-lg">{data?.total_training_records_available?.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-stone-500 text-xs">Guest Model Records</p>
            <p className="font-bold text-stone-900 text-lg">{data?.guest_count_model?.dataset_size ?? '—'}</p>
          </div>
          <div>
            <p className="text-stone-500 text-xs">Food Model Records</p>
            <p className="font-bold text-stone-900 text-lg">{data?.food_quantity_model?.dataset_size ?? '—'}</p>
          </div>
          <div>
            <p className="text-stone-500 text-xs">Split Strategy</p>
            <p className="font-bold text-stone-900 text-lg">80/20</p>
          </div>
        </div>
        <p className="text-xs text-stone-400 mt-3">
          Evaluation method: random 80/20 train-test split with fixed seed 42.
          Metrics computed on the 20% hold-out test set not seen during training.
          No preprocessing steps were fit on test data.
        </p>
      </div>
    </div>
  );
};
