'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface Run { id: string; client: string; period: string; status: string; totalEntries: number; matchedEntries: number; variance: string; flagged: number; date: string; }

function extractList(res: any): any[] {
  if (Array.isArray(res)) return res;
  if (res?.data?.data) return res.data.data;
  if (Array.isArray(res?.data)) return res.data;
  return [];
}

export default function CAReconciliationPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [runs, setRuns] = useState<Run[]>([]);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    api.get('/filings')
      .then((res: any) => {
        const filings = extractList(res);
        setRuns(filings.length > 0 ? filings.map((f: any) => ({
          id: f.id,
          client: f.client || 'Unknown',
          period: f.period || '—',
          status: f.status === 'overdue' ? 'REVIEW_REQUIRED' : f.status === 'filed' ? 'COMPLETED' : 'PENDING',
          totalEntries: 0,
          matchedEntries: 0,
          variance: '—',
          flagged: 0,
          date: f.dueDate || '—',
        })) : [
          { id:'r1',client:'ABC Pvt Ltd',period:'Apr-Jun 2026',status:'COMPLETED',totalEntries:1243,matchedEntries:1219,variance:'₹18,540',flagged:12,date:'2026-07-20' },
          { id:'r2',client:'DEF Ltd',period:'Apr-Jun 2026',status:'REVIEW_REQUIRED',totalEntries:876,matchedEntries:854,variance:'₹42,300',flagged:8,date:'2026-07-22' },
          { id:'r3',client:'XYZ Corp',period:'Jan-Mar 2026',status:'COMPLETED',totalEntries:2150,matchedEntries:2138,variance:'₹9,100',flagged:5,date:'2026-06-15' },
          { id:'r4',client:'LMN India',period:'Apr-Jun 2026',status:'PENDING',totalEntries:0,matchedEntries:0,variance:'—',flagged:0,date:'—' },
        ]);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const statusBadge = (s: string) => {
    const m: Record<string, string> = { COMPLETED: 'bg-green-50 text-green-700', REVIEW_REQUIRED: 'bg-yellow-50 text-yellow-700', PENDING: 'bg-gray-100 text-gray-500', PROCESSING: 'bg-blue-50 text-blue-700' };
    return m[s] || 'bg-gray-100 text-gray-500';
  };

  if (loading) return <div className="p-6"><div className="h-8 w-56 bg-gray-200 rounded animate-pulse mb-4" /><div className="h-64 bg-gray-200 rounded-lg animate-pulse" /></div>;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div><h1 className="text-2xl font-bold text-gray-900">Bookkeeping Reconciliation</h1><p className="text-gray-500 text-sm mt-1">Match bank statements with client books — AI-powered reconciliation</p></div>
        <button onClick={()=>setShowUpload(true)} className="px-4 py-2 bg-green-700 text-white text-sm rounded-lg hover:bg-green-800">+ Start New Reconciliation</button>
      </div>

      {showUpload && (
        <div className="bg-white rounded-lg border shadow-sm p-6 space-y-4">
          <div className="flex justify-between"><h3 className="font-semibold text-gray-900">New Reconciliation</h3><button onClick={()=>setShowUpload(false)} className="text-gray-400 hover:text-gray-600">&times;</button></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-green-300 cursor-pointer transition-colors">
              <p className="text-2xl mb-2">📊</p>
              <p className="text-sm font-medium text-gray-700">Upload Trial Balance</p>
              <p className="text-xs text-gray-400 mt-1">Tally XML/JSON, Zoho Books export, or CSV</p>
              <input type="file" accept=".xml,.json,.csv" className="hidden" />
              <button className="mt-3 text-xs text-green-700 bg-green-50 px-3 py-1 rounded hover:bg-green-100">Browse Files</button>
            </div>
            <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-green-300 cursor-pointer transition-colors">
              <p className="text-2xl mb-2">🏦</p>
              <p className="text-sm font-medium text-gray-700">Upload Bank Statement</p>
              <p className="text-xs text-gray-400 mt-1">Bank PDF, CSV, or Excel export</p>
              <input type="file" accept=".pdf,.csv,.xls,.xlsx" className="hidden" />
              <button className="mt-3 text-xs text-green-700 bg-green-50 px-3 py-1 rounded hover:bg-green-100">Browse Files</button>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="flex-1 py-2 bg-green-700 text-white text-sm rounded-lg hover:bg-green-800" onClick={()=>{setShowUpload(false); const newRun: Run = { id: `r${Date.now()}`,client:'New Client',period:'Jul-Sep 2026',status:'PROCESSING',totalEntries:0,matchedEntries:0,variance:'—',flagged:0,date:new Date().toISOString().split('T')[0] }; setRuns([newRun,...runs]); }}>Start Processing</button>
            <button onClick={()=>setShowUpload(false)} className="px-4 py-2 border text-sm rounded-lg hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 text-left text-gray-600"><th className="p-3">Client</th><th className="p-3">Period</th><th className="p-3">Status</th><th className="p-3">Match Rate</th><th className="p-3">Variance</th><th className="p-3">Flagged</th><th className="p-3">Date</th></tr></thead>
          <tbody className="divide-y">
            {runs.map(r => {
              const rate = r.totalEntries > 0 ? ((r.matchedEntries / r.totalEntries) * 100).toFixed(1) : '—';
              return (
                <tr key={r.id} className="hover:bg-gray-50 cursor-pointer">
                  <td className="p-3 font-medium text-gray-900">{r.client}</td>
                  <td className="p-3 text-gray-600">{r.period}</td>
                  <td className="p-3"><span className={`text-xs px-2 py-0.5 rounded ${statusBadge(r.status)}`}>{r.status.replace('_',' ')}</span></td>
                  <td className="p-3 text-gray-600">{rate}{rate !== '—' ? '%' : ''}</td>
                  <td className="p-3 text-gray-600">{r.variance}</td>
                  <td className="p-3">{r.flagged > 0 ? <span className="text-yellow-600 font-medium">{r.flagged}</span> : <span className="text-gray-400">0</span>}</td>
                  <td className="p-3 text-xs text-gray-400">{r.date}</td>
                </tr>
              );
            })}
            {runs.length===0 && <tr><td colSpan={7} className="p-8 text-center text-gray-400">No reconciliation runs yet. Upload a trial balance to get started.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800"><strong>How it works:</strong> Upload your client&apos;s trial balance and bank statement. AI matches bank entries to books, flags differences, and produces a reconciliation report. All flagged items go to partner review — AI never auto-resolves differences.</p>
      </div>
    </div>
  );
}
