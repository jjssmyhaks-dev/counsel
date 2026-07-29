'use client';
import { useState, useEffect } from 'react';

interface Item { id: string; type: string; client: string; title: string; dueDate: string; status: string; severity: string; }

export default function CACompliancePage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState<'list'|'calendar'>('list');

  useEffect(() => {
    setTimeout(() => {
      setItems([
        { id:'1',type:'GST',client:'ABC Pvt Ltd',title:'GSTR-3B — July 2026',dueDate:'2026-08-20',status:'upcoming',severity:'warning' },
        { id:'2',type:'GST',client:'DEF Ltd',title:'GSTR-1 — July 2026',dueDate:'2026-08-11',status:'upcoming',severity:'warning' },
        { id:'3',type:'Income Tax',client:'DEF Ltd',title:'TDS Return 26Q — Q1 2026-27',dueDate:'2026-07-31',status:'overdue',severity:'critical' },
        { id:'4',type:'ROC',client:'XYZ Corp',title:'AOC-4 — FY 2025-26',dueDate:'2026-09-30',status:'upcoming',severity:'normal' },
        { id:'5',type:'ROC',client:'XYZ Corp',title:'MGT-7 — FY 2025-26',dueDate:'2026-09-30',status:'upcoming',severity:'normal' },
        { id:'6',type:'Audit',client:'GHI & Co',title:'Tax Audit Report — Form 3CD',dueDate:'2026-09-15',status:'upcoming',severity:'warning' },
        { id:'7',type:'Income Tax',client:'ABC Pvt Ltd',title:'ITR-6 — AY 2026-27',dueDate:'2026-09-30',status:'upcoming',severity:'normal' },
        { id:'8',type:'ROC',client:'LMN India',title:'DIR-3 KYC — FY 2025-26',dueDate:'2026-09-30',status:'upcoming',severity:'normal' },
      ]);
      setLoading(false);
    }, 600);
  }, []);

  const filtered = items.filter(i => filter === 'all' || i.type.toLowerCase() === filter.toLowerCase());

  const sevColor = (s: string) => s === 'critical' ? 'bg-red-50 border-red-300 text-red-700' : s === 'warning' ? 'bg-yellow-50 border-yellow-300 text-yellow-700' : 'bg-blue-50 border-blue-200 text-blue-700';

  const statusBadge = (s: string) => s === 'overdue' ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50';

  if (loading) return <div className="p-6"><div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-4" /><div className="h-64 bg-gray-200 rounded-lg animate-pulse" /></div>;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div><h1 className="text-2xl font-bold text-gray-900">Compliance Calendar</h1><p className="text-gray-500 text-sm mt-1">GST · Income Tax · ROC · TDS · Audit — all deadlines tracked</p></div>
        <div className="flex gap-2">
          <button onClick={()=>setView('list')} className={`text-sm px-3 py-1 rounded ${view==='list'?'bg-green-700 text-white':'bg-gray-100'}`}>List</button>
          <button onClick={()=>setView('calendar')} className={`text-sm px-3 py-1 rounded ${view==='calendar'?'bg-green-700 text-white':'bg-gray-100'}`}>Calendar</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {['all','GST','Income Tax','ROC','Audit','TDS'].map(f => (
          <button key={f} onClick={()=>setFilter(f)} className={`text-sm px-3 py-1 rounded-full border ${filter===f?'bg-green-700 text-white border-green-700':'bg-white text-gray-600 hover:border-green-300'}`}>
            {f === 'all' ? 'All' : f}
          </button>
        ))}
      </div>

      {view === 'list' && (
        <div className="bg-white rounded-lg border shadow-sm divide-y">
          {filtered.map(i => (
            <div key={i.id} className="flex items-center gap-3 p-3 flex-wrap">
              <div className={`text-xs font-medium px-2 py-0.5 rounded border ${sevColor(i.severity)}`}>{i.severity==='critical'?'OVERDUE':i.severity==='warning'?'DUE SOON':'ON TRACK'}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{i.type}: {i.title}</p>
                <p className="text-xs text-gray-500">{i.client}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded ${statusBadge(i.status)}`}>{i.status}</span>
              <span className="text-sm text-gray-600 font-medium">{i.dueDate}</span>
            </div>
          ))}
          {filtered.length===0 && <div className="p-8 text-center text-gray-400">No compliance items found for this filter.</div>}
        </div>
      )}

      {view === 'calendar' && (
        <div className="bg-white rounded-lg border shadow-sm p-20 text-center text-gray-400">
          <p className="text-lg">📅 Calendar View</p>
          <p className="text-sm">Interactive calendar coming soon. All deadlines are tracked in the list view.</p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[{label:'Overdue',count:items.filter(i=>i.severity==='critical').length,color:'text-red-600'},
          {label:'This Week',count:items.filter(i=>i.severity==='warning').length,color:'text-yellow-600'},
          {label:'This Month',count:items.filter(i=>i.severity==='normal').length,color:'text-blue-600'},
          {label:'Upcoming',count:items.filter(i=>i.status==='upcoming').length,color:'text-green-600'},
        ].map((s,i) => (
          <div key={i} className="bg-white rounded-lg border p-3 text-center shadow-sm">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.count}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
