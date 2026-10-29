import React, { useState, useEffect, useRef } from 'react';
import {
  Database, Upload, Download, AlertCircle, CheckCircle2, XCircle,
  ChevronLeft, ChevronRight, Info, FileText, Search
} from 'lucide-react';
import { api, AuthHotel } from '../api';
import { HistoricalRecord } from '../types';
import { Badge } from '../components/Badge';
import { CSVPreviewResult, CSVImportResult } from '../types';

interface HistoricalDataPageProps {
  hotel?: AuthHotel | null;
}

export const HistoricalDataPage: React.FC<HistoricalDataPageProps> = ({ hotel }) => {
  const [records, setRecords] = useState<HistoricalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [search, setSearch] = useState('');
  const [mealFilter, setMealFilter] = useState('');

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CSVPreviewResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<CSVImportResult | null>(null);
  const [dedupStrategy, setDedupStrategy] = useState<'skip' | 'update' | 'keep_both'>('skip');
  const [previewing, setPreviewing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadRecords(); }, [page, mealFilter]);

  const loadRecords = async () => {
    try {
      setLoading(true);
      const targetHotelId = hotel?.role === 'hotel' ? hotel.hotel_id : undefined;
      const res = await api.getHistoricalRecords({ 
        page, 
        limit: 20, 
        hotel_id: targetHotelId,
        meal_type: mealFilter || undefined, 
        search: search || undefined 
      });
      setRecords(res.data); setTotalPages(res.pagination.total_pages); setTotalRecords(res.pagination.total_records);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handlePreview = async () => {
    if (!uploadFile) return;
    try {
      setPreviewing(true); setUploadError(null); setPreview(null); setImportResult(null);
      const result = await api.previewHistoricalCsv(uploadFile);
      setPreview(result);
    } catch (e: any) { setUploadError(e.message); }
    finally { setPreviewing(false); }
  };

  const handleImport = async () => {
    if (!uploadFile) return;
    try {
      setImporting(true); setUploadError(null);
      const result = await api.importHistoricalCsv(uploadFile, dedupStrategy);
      setImportResult(result); setPreview(null); setUploadFile(null);
      if (fileRef.current) fileRef.current.value = '';
      loadRecords();
    } catch (e: any) { setUploadError(e.message); }
    finally { setImporting(false); }
  };

  const statusColor = (s: string) =>
    s === 'valid' ? 'text-emerald-700 bg-emerald-50' :
    s === 'invalid' ? 'text-rose-700 bg-rose-50' : 'text-amber-700 bg-amber-50';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-stone-900">Historical Data Management</h2>
        <p className="text-sm text-stone-500">Upload operational CSV records, preview data quality, and manage imported history.</p>
      </div>

      {/* Upload Panel */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100"><Upload className="w-5 h-5 text-emerald-700" /></div>
          <div>
            <h3 className="font-bold text-stone-900 text-sm">Import Historical Records CSV</h3>
            <p className="text-xs text-stone-500">Required columns: hotel_name, record_date (YYYY-MM-DD), meal_type, food_item_name, actual_guest_count, actual_quantity_consumed, unit</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-stone-600 mb-1.5">Select CSV File</label>
            <input ref={fileRef} type="file" accept=".csv"
              onChange={e => { setUploadFile(e.target.files?.[0] || null); setPreview(null); setImportResult(null); setUploadError(null); }}
              className="w-full text-xs text-stone-600 border border-stone-200 rounded-xl bg-stone-50 px-3 py-2 cursor-pointer file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-800 hover:file:bg-emerald-100" />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-600 mb-1.5">Duplicate Strategy</label>
            <select value={dedupStrategy} onChange={e => setDedupStrategy(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-stone-50 text-xs focus:ring-2 focus:ring-emerald-700 focus:outline-hidden">
              <option value="skip">Skip duplicates (default)</option>
              <option value="update">Update existing records</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={handlePreview} disabled={!uploadFile || previewing}
            className="px-4 py-2 bg-stone-800 text-white text-xs font-semibold rounded-xl hover:bg-stone-900 disabled:opacity-50 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />{previewing ? 'Previewing...' : 'Preview & Validate'}
          </button>
          {preview && preview.valid_rows_count > 0 && (
            <button onClick={handleImport} disabled={importing}
              className="px-4 py-2 bg-[#1B4332] text-white text-xs font-semibold rounded-xl hover:bg-[#144531] disabled:opacity-50 flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" />{importing ? 'Importing...' : `Import ${preview.valid_rows_count} Valid Rows`}
            </button>
          )}
          <a href={api.getTemplateDownloadUrl()} className="px-4 py-2 border border-stone-200 text-stone-700 text-xs font-semibold rounded-xl hover:bg-stone-50 flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" /> Download Template
          </a>
        </div>

        {uploadError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{uploadError}</span>
          </div>
        )}

        {/* Import success result */}
        {importResult && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-emerald-800"><CheckCircle2 className="w-4 h-4" /> Import Completed</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Rows', value: importResult.total_rows_processed, color: 'text-stone-800' },
                { label: 'Imported', value: importResult.imported_records, color: 'text-emerald-800' },
                { label: 'Skipped Duplicates', value: importResult.skipped_duplicates, color: 'text-amber-700' },
                { label: 'Invalid Discarded', value: importResult.invalid_discarded_records, color: 'text-rose-700' },
              ].map(({ label, value, color }) => (
                <div key={label} className="p-2 bg-white rounded-lg border border-emerald-100">
                  <p className="text-stone-500">{label}</p>
                  <p className={`font-bold text-base ${color}`}>{value}</p>
                </div>
              ))}
            </div>
            {importResult.sample_discarded_issues?.length > 0 && (
              <div className="mt-2 p-2 bg-rose-50 rounded-lg border border-rose-100 text-rose-700">
                <p className="font-semibold mb-1">Sample issues in discarded rows:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {importResult.sample_discarded_issues.map((issue, i) => <li key={i}>{issue}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Preview Table */}
        {preview && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {[
                { label: 'Total Rows', value: preview.total_rows_inspected, color: 'text-stone-800' },
                { label: 'Valid', value: preview.valid_rows_count, color: 'text-emerald-800' },
                { label: 'Duplicates', value: preview.duplicate_rows_count, color: 'text-amber-700' },
                { label: 'Invalid', value: preview.invalid_rows_count, color: 'text-rose-700' },
              ].map(({ label, value, color }) => (
                <div key={label} className="p-3 bg-stone-50 rounded-xl border border-stone-100">
                  <p className="text-stone-500">{label}</p>
                  <p className={`font-bold text-xl ${color}`}>{value}</p>
                </div>
              ))}
            </div>
            <p className="text-xs font-bold text-stone-700">Preview (first 15 rows):</p>
            <div className="overflow-x-auto rounded-xl border border-stone-200">
              <table className="w-full text-[11px]">
                <thead className="bg-stone-100 text-stone-500 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-2 px-3">Row</th><th className="py-2 px-3">Hotel</th>
                    <th className="py-2 px-3">Date</th><th className="py-2 px-3">Meal</th>
                    <th className="py-2 px-3">Food Item</th><th className="py-2 px-3 text-right">Guests</th>
                    <th className="py-2 px-3 text-right">Qty</th><th className="py-2 px-3">Unit</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {preview.preview_rows.map((r) => (
                    <tr key={r.row_number} className="hover:bg-stone-50">
                      <td className="py-1.5 px-3">{r.row_number}</td>
                      <td className="py-1.5 px-3 max-w-[100px] truncate">{r.hotel_name}</td>
                      <td className="py-1.5 px-3">{r.record_date}</td>
                      <td className="py-1.5 px-3">{r.meal_type}</td>
                      <td className="py-1.5 px-3 max-w-[120px] truncate">{r.food_item_name}</td>
                      <td className="py-1.5 px-3 text-right">{r.actual_guest_count}</td>
                      <td className="py-1.5 px-3 text-right">{r.actual_quantity_consumed}</td>
                      <td className="py-1.5 px-3">{r.unit}</td>
                      <td className="py-1.5 px-3">
                        <span className={`px-2 py-0.5 rounded-full font-semibold capitalize ${statusColor(r.status)}`}>{r.status}</span>
                        {r.issues.length > 0 && <p className="text-rose-600 text-[10px]">{r.issues[0]}</p>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Historical Records Browsing Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-stone-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div>
            <h3 className="font-bold text-stone-900 text-sm">Stored Historical Records</h3>
            <p className="text-xs text-stone-500">{totalRecords.toLocaleString()} total records in database</p>
          </div>
          <div className="flex gap-2">
            <form onSubmit={e => { e.preventDefault(); setPage(1); loadRecords(); }} className="flex gap-2">
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search hotel or item..."
                className="px-3 py-1.5 text-xs rounded-lg border border-stone-200 bg-stone-50 w-40 focus:outline-hidden focus:ring-1 focus:ring-emerald-700" />
              <button type="submit" className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200"><Search className="w-3.5 h-3.5" /></button>
            </form>
            <select value={mealFilter} onChange={e => { setMealFilter(e.target.value); setPage(1); }}
              className="px-2 py-1.5 text-xs rounded-lg border border-stone-200 bg-stone-50 focus:outline-hidden focus:ring-1 focus:ring-emerald-700">
              <option value="">All Meals</option>
              <option value="Breakfast">Breakfast</option>
              <option value="Lunch">Lunch</option>
              <option value="Dinner">Dinner</option>
            </select>
            <a href={api.getExportUrl('historical')} className="flex items-center gap-1 px-3 py-1.5 border border-stone-200 text-stone-600 text-xs rounded-lg hover:bg-stone-50 font-semibold">
              <Download className="w-3.5 h-3.5" /> Export
            </a>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Date</th><th className="py-3 px-4">Hotel</th>
                <th className="py-3 px-4">Meal</th><th className="py-3 px-4">Food Item</th>
                <th className="py-3 px-4 text-right">Actual Guests</th>
                <th className="py-3 px-4 text-right">Consumed</th>
                <th className="py-3 px-4 text-right">Waste</th>
                <th className="py-3 px-4">Season</th>
                <th className="py-3 px-4">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr><td colSpan={9} className="py-8 text-center text-stone-400">Loading records…</td></tr>
              ) : records.map(r => (
                <tr key={r.id} className="hover:bg-stone-50/70">
                  <td className="py-2.5 px-4 font-medium text-stone-900 whitespace-nowrap">{r.record_date}</td>
                  <td className="py-2.5 px-4 text-stone-700">{r.hotel_name}</td>
                  <td className="py-2.5 px-4"><Badge variant={r.meal_type === 'Breakfast' ? 'amber' : r.meal_type === 'Lunch' ? 'blue' : 'green'}>{r.meal_type}</Badge></td>
                  <td className="py-2.5 px-4 text-stone-800 font-medium max-w-[160px] truncate">{r.food_item_name}</td>
                  <td className="py-2.5 px-4 text-right font-bold text-emerald-800">{r.actual_guest_count}</td>
                  <td className="py-2.5 px-4 text-right">{r.actual_quantity_consumed} <span className="text-stone-400">{r.unit}</span></td>
                  <td className="py-2.5 px-4 text-right text-amber-700">{r.waste_quantity ? r.waste_quantity.toFixed(2) : '—'}</td>
                  <td className="py-2.5 px-4 text-stone-500">{r.season}</td>
                  <td className="py-2.5 px-4">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-500 border border-stone-200">
                      {r.source_type === 'synthetic_demonstration' ? 'Demo' : r.source_type === 'uploaded_csv' ? 'CSV' : 'Public'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-stone-100 flex items-center justify-between text-xs text-stone-600">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-200 disabled:opacity-40 hover:bg-stone-50">
            <ChevronLeft className="w-3.5 h-3.5" /> Previous
          </button>
          <span>Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-200 disabled:opacity-40 hover:bg-stone-50">
            Next <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
