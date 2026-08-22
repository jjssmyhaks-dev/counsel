'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

const serif = 'font-serif';

// ─── Types ────────────────────────────────────────────────────────────────

interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  type: string;
  status: string;
  entryCount: number;
  createdAt: string;
  updatedAt: string;
  _count?: { entries: number };
}

interface KnowledgeEntry {
  id: string;
  title: string;
  content?: string;
  summary?: string;
  entry_type: string;
  category?: string;
  tags?: string[];
  confidence?: number;
  usage_count?: number;
  knowledge_base_id?: string;
  kb_name?: string;
  created_at?: string;
  access_level?: string;
}

interface KbStats {
  totalBases: number;
  totalEntries: number;
  totalRelations: number;
  entriesByType: Array<{ entry_type: string; count: number }>;
  bases: Array<{ id: string; name: string; type: string; entry_count: number; active_entries: number }>;
  topEntries: Array<{ id: string; title: string; entry_type: string; usage_count: number }>;
}

type View = 'overview' | 'bases' | 'entries' | 'search' | 'ingest';

const ENTRY_TYPES = ['FACT', 'RULE', 'PRECEDENT', 'REGULATION', 'TEMPLATE', 'CLAUSE', 'GUIDELINE'] as const;
const KB_TYPES = ['GENERAL', 'LEGAL', 'CONSULTING', 'CA', 'PLAYBOOK'] as const;

const ENTRY_TYPE_COLORS: Record<string, string> = {
  FACT: 'bg-blue-50 text-blue-700 border-blue-200',
  RULE: 'bg-amber-50 text-amber-700 border-amber-200',
  PRECEDENT: 'bg-purple-50 text-purple-700 border-purple-200',
  REGULATION: 'bg-red-50 text-red-700 border-red-200',
  TEMPLATE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CLAUSE: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  GUIDELINE: 'bg-pink-50 text-pink-700 border-pink-200',
};

const KB_TYPE_ICONS: Record<string, string> = {
  GENERAL: '📚',
  LEGAL: '⚖️',
  CONSULTING: '💼',
  CA: '📊',
  PLAYBOOK: '📋',
};

// ─── Main Component ───────────────────────────────────────────────────────

export default function KnowledgePage() {
  const [view, setView] = useState<View>('overview');
  const [stats, setStats] = useState<KbStats | null>(null);
  const [bases, setBases] = useState<KnowledgeBase[]>([]);
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [selectedBase, setSelectedBase] = useState<KnowledgeBase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Load stats
  const loadStats = useCallback(async () => {
    try {
      const data = await api.get<KbStats>('/kb/stats');
      setStats(data);
    } catch { /* ignore */ }
  }, []);

  // Load bases
  const loadBases = useCallback(async () => {
    try {
      const data = await api.get<{ data: KnowledgeBase[] }>('/kb/bases');
      setBases(Array.isArray(data?.data) ? data.data : []);
    } catch { /* ignore */ }
  }, []);

  // Load entries for a base
  const loadEntries = useCallback(async (baseId: string) => {
    try {
      const data = await api.get<{ data: KnowledgeEntry[] }>(`/kb/bases/${baseId}/entries?limit=100`);
      setEntries(Array.isArray(data?.data) ? data.data : []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadStats(), loadBases()]).finally(() => setLoading(false));
  }, [loadStats, loadBases]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`${serif} text-[1.75rem] font-normal tracking-[-0.02em] text-[#0c0a09] dark:text-white`}>
            Knowledge Base
          </h1>
          <p className="text-[13px] text-[#717d79] dark:text-[#969e9b] mt-1">
            Structured knowledge for AI agents — rules, precedents, regulations, and guidelines
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('search')}
            className="px-4 py-2 rounded-xl text-[13px] font-medium border border-black/[0.08] dark:border-slate-700 text-[#4b5551] dark:text-[#969e9b] hover:bg-black/[0.02] dark:hover:bg-slate-800 transition-colors"
          >
            🔍 Search
          </button>
          <button
            onClick={() => setView('ingest')}
            className="px-4 py-2 rounded-xl text-[13px] font-medium bg-[#15b881] text-white hover:bg-[#0a8a5f] transition-colors"
          >
            + Ingest from Document
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-1 bg-black/[0.03] dark:bg-slate-800/50 rounded-xl p-1">
        {(['overview', 'bases', 'entries'] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${
              view === v
                ? 'bg-white dark:bg-slate-900 text-[#0c0a09] dark:text-white shadow-sm'
                : 'text-[#717d79] dark:text-[#969e9b] hover:text-[#0c0a09] dark:hover:text-white'
            }`}
          >
            {v === 'overview' ? '📊 Overview' : v === 'bases' ? '📚 Knowledge Bases' : '📝 Entries'}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-[13px]">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-500 hover:text-red-700">×</button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="py-16 text-center">
          <div className="w-8 h-8 border-2 border-black/[0.06] border-t-[#15b881] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[13px] text-[#717d79]">Loading knowledge base...</p>
        </div>
      ) : (
        <>
          {view === 'overview' && <OverviewView stats={stats} onNavigate={setView} />}
          {view === 'bases' && <BasesView bases={bases} onSelect={(b) => { setSelectedBase(b); loadEntries(b.id); setView('entries'); }} onRefresh={loadBases} setError={setError} />}
          {view === 'entries' && <EntriesView entries={entries} selectedBase={selectedBase} onBack={() => setView('bases')} onRefresh={() => selectedBase && loadEntries(selectedBase.id)} setError={setError} />}
          {view === 'search' && <SearchView onBack={() => setView('overview')} />}
          {view === 'ingest' && <IngestView bases={bases} onBack={() => setView('overview')} setError={setError} />}
        </>
      )}
    </div>
  );
}

// ─── Overview View ────────────────────────────────────────────────────────

function OverviewView({ stats, onNavigate }: { stats: KbStats | null; onNavigate: (v: View) => void }) {
  if (!stats) {
    return (
      <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-black/[0.04] dark:border-slate-800">
        <div className="w-16 h-16 bg-[#eaf7f0] rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">📚</span>
        </div>
        <h3 className={`${serif} text-lg font-normal text-[#0c0a09] dark:text-white mb-2`}>No Knowledge Base Yet</h3>
        <p className="text-[13px] text-[#717d79] dark:text-[#969e9b] max-w-md mx-auto mb-4">
          Create your first knowledge base to start building structured knowledge for your AI agents.
        </p>
        <button
          onClick={() => onNavigate('bases')}
          className="px-4 py-2 rounded-xl text-[13px] font-medium bg-[#15b881] text-white hover:bg-[#0a8a5f] transition-colors"
        >
          Create Knowledge Base
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon="📚"
          label="Knowledge Bases"
          value={stats.totalBases}
          onClick={() => onNavigate('bases')}
        />
        <StatCard
          icon="📝"
          label="Knowledge Entries"
          value={stats.totalEntries}
          onClick={() => onNavigate('entries')}
        />
        <StatCard
          icon="🔗"
          label="Relations"
          value={stats.totalRelations}
          onClick={() => onNavigate('overview')}
        />
      </div>

      {/* Entry Type Distribution */}
      {stats.entriesByType.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-black/[0.04] dark:border-slate-800 p-6">
          <h3 className={`${serif} text-base font-normal text-[#0c0a09] dark:text-white mb-4`}>Entry Types</h3>
          <div className="space-y-2">
            {stats.entriesByType.map((item) => (
              <div key={item.entry_type} className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${ENTRY_TYPE_COLORS[item.entry_type] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                  {item.entry_type}
                </span>
                <div className="flex-1 h-2 bg-black/[0.04] dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#15b881] rounded-full transition-all"
                    style={{ width: `${Math.min(100, (item.count / Math.max(...stats.entriesByType.map(e => e.count))) * 100)}%` }}
                  />
                </div>
                <span className="text-[12px] text-[#717d79] dark:text-[#969e9b] w-8 text-right">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Knowledge Bases */}
      {stats.bases.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-black/[0.04] dark:border-slate-800 p-6">
          <h3 className={`${serif} text-base font-normal text-[#0c0a09] dark:text-white mb-4`}>Your Knowledge Bases</h3>
          <div className="space-y-2">
            {stats.bases.map((kb) => (
              <div key={kb.id} className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-black/[0.02] dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{KB_TYPE_ICONS[kb.type] || '📚'}</span>
                  <div>
                    <p className="text-[13px] font-medium text-[#0c0a09] dark:text-white">{kb.name}</p>
                    <p className="text-[11px] text-[#717d79] dark:text-[#969e9b]">{kb.type} · {kb.active_entries} entries</p>
                  </div>
                </div>
                <span className="text-[12px] text-[#969e9b]">{kb.entry_count} total</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Used Entries */}
      {stats.topEntries.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-black/[0.04] dark:border-slate-800 p-6">
          <h3 className={`${serif} text-base font-normal text-[#0c0a09] dark:text-white mb-4`}>Most Used Entries</h3>
          <div className="space-y-2">
            {stats.topEntries.slice(0, 5).map((entry, i) => (
              <div key={entry.id} className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-black/[0.02] dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-[12px] text-[#969e9b] w-5">#{i + 1}</span>
                  <div>
                    <p className="text-[13px] font-medium text-[#0c0a09] dark:text-white">{entry.title}</p>
                    <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium border ${ENTRY_TYPE_COLORS[entry.entry_type] || ''}`}>
                      {entry.entry_type}
                    </span>
                  </div>
                </div>
                <span className="text-[12px] text-[#717d79] dark:text-[#969e9b]">{entry.usage_count} uses</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, onClick }: { icon: string; label: string; value: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-white dark:bg-slate-900 rounded-2xl border border-black/[0.04] dark:border-slate-800 p-5 text-left hover:border-[#15b881]/30 transition-all group"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        <svg className="w-4 h-4 text-black/[0.08] dark:text-white/20 group-hover:text-[#15b881] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
      <p className={`${serif} text-2xl font-normal text-[#0c0a09] dark:text-white`}>{value}</p>
      <p className="text-[12px] text-[#717d79] dark:text-[#969e9b] mt-1">{label}</p>
    </button>
  );
}

// ─── Bases View ───────────────────────────────────────────────────────────

function BasesView({ bases, onSelect, onRefresh, setError }: {
  bases: KnowledgeBase[];
  onSelect: (b: KnowledgeBase) => void;
  onRefresh: () => void;
  setError: (e: string) => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState<string>('GENERAL');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await api.post('/kb/bases', { name: newName, description: newDesc, type: newType });
      setNewName(''); setNewDesc(''); setNewType('GENERAL'); setShowCreate(false);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to create knowledge base');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this knowledge base and all its entries?')) return;
    try {
      await api.delete(`/kb/bases/${id}`);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to delete');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className={`${serif} text-base font-normal text-[#0c0a09] dark:text-white`}>Knowledge Bases ({bases.length})</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-3 py-1.5 rounded-xl text-[13px] font-medium bg-[#15b881] text-white hover:bg-[#0a8a5f] transition-colors"
        >
          + New Knowledge Base
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#15b881]/20 p-6 space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-[#717d79] dark:text-[#969e9b] mb-1">Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g., M&A Playbook, GST Rules, Contract Templates"
              className="w-full px-3 py-2 rounded-xl border border-black/[0.08] dark:border-slate-700 text-[13px] bg-white dark:bg-slate-900 text-[#0c0a09] dark:text-white placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#717d79] dark:text-[#969e9b] mb-1">Description</label>
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="What kind of knowledge does this base contain?"
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-black/[0.08] dark:border-slate-700 text-[13px] bg-white dark:bg-slate-900 text-[#0c0a09] dark:text-white placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30 resize-none"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#717d79] dark:text-[#969e9b] mb-1">Type</label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-black/[0.08] dark:border-slate-700 text-[13px] bg-white dark:bg-slate-900 text-[#0c0a09] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#15b881]/30"
            >
              {KB_TYPES.map(t => <option key={t} value={t}>{KB_TYPE_ICONS[t]} {t}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={creating || !newName.trim()}
              className="px-4 py-2 rounded-xl text-[13px] font-medium bg-[#15b881] text-white hover:bg-[#0a8a5f] transition-colors disabled:opacity-50">
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-xl text-[13px] font-medium border border-black/[0.08] dark:border-slate-700 text-[#717d79] dark:text-[#969e9b] hover:bg-black/[0.02] dark:hover:bg-slate-800 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Bases List */}
      {bases.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-black/[0.04] dark:border-slate-800">
          <p className="text-[13px] text-[#717d79] dark:text-[#969e9b]">No knowledge bases yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {bases.map((kb) => (
            <div key={kb.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-black/[0.04] dark:border-slate-800 p-5 hover:border-[#15b881]/20 transition-all">
              <div className="flex items-center justify-between">
                <button onClick={() => onSelect(kb)} className="flex items-center gap-4 text-left flex-1">
                  <span className="text-3xl">{KB_TYPE_ICONS[kb.type] || '📚'}</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[15px] font-semibold text-[#0c0a09] dark:text-white">{kb.name}</h3>
                    {kb.description && <p className="text-[12px] text-[#717d79] dark:text-[#969e9b] mt-0.5 truncate">{kb.description}</p>}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[11px] text-[#969e9b]">{kb.entryCount} entries</span>
                      <span className="text-[11px] text-[#969e9b]">·</span>
                      <span className="text-[11px] text-[#969e9b]">{kb.type}</span>
                      <span className="text-[11px] text-[#969e9b]">·</span>
                      <span className="text-[11px] text-[#969e9b]">{kb.status}</span>
                    </div>
                  </div>
                </button>
                <button onClick={() => handleDelete(kb.id)}
                  className="p-2 text-[#969e9b] hover:text-red-500 transition-colors" title="Delete">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Entries View ─────────────────────────────────────────────────────────

function EntriesView({ entries, selectedBase, onBack, onRefresh, setError }: {
  entries: KnowledgeEntry[];
  selectedBase: KnowledgeBase | null;
  onBack: () => void;
  onRefresh: () => void;
  setError: (e: string) => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newType, setNewType] = useState('FACT');
  const [newCategory, setNewCategory] = useState('');
  const [newTags, setNewTags] = useState('');
  const [newSummary, setNewSummary] = useState('');
  const [creating, setCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = entries.filter(e =>
    !searchTerm || e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = async () => {
    if (!newTitle.trim() || !newContent.trim() || !selectedBase) return;
    setCreating(true);
    try {
      await api.post(`/kb/bases/${selectedBase.id}/entries`, {
        title: newTitle,
        content: newContent,
        entryType: newType,
        category: newCategory || undefined,
        tags: newTags ? newTags.split(',').map(t => t.trim()).filter(Boolean) : [],
        summary: newSummary || undefined,
      });
      setNewTitle(''); setNewContent(''); setNewType('FACT'); setNewCategory(''); setNewTags(''); setNewSummary('');
      setShowCreate(false);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to create entry');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (!confirm('Delete this knowledge entry?')) return;
    try {
      await api.delete(`/kb/entries/${id}`);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to delete entry');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1 text-[#717d79] hover:text-[#0c0a09] dark:hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className={`${serif} text-base font-normal text-[#0c0a09] dark:text-white`}>
              {selectedBase ? selectedBase.name : 'All Entries'}
            </h2>
            <p className="text-[11px] text-[#717d79] dark:text-[#969e9b]">{filtered.length} entries</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter entries..."
            className="px-3 py-1.5 rounded-xl text-[13px] border border-black/[0.08] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#0c0a09] dark:text-white placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30 w-48"
          />
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-3 py-1.5 rounded-xl text-[13px] font-medium bg-[#15b881] text-white hover:bg-[#0a8a5f] transition-colors"
          >
            + Add Entry
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showCreate && selectedBase && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#15b881]/20 p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-[#717d79] mb-1">Title</label>
              <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g., Standard Indemnification Clause"
                className="w-full px-3 py-2 rounded-xl border border-black/[0.08] dark:border-slate-700 text-[13px] bg-white dark:bg-slate-900 text-[#0c0a09] dark:text-white placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30" />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#717d79] mb-1">Type</label>
              <select value={newType} onChange={(e) => setNewType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-black/[0.08] dark:border-slate-700 text-[13px] bg-white dark:bg-slate-900 text-[#0c0a09] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#15b881]/30">
                {ENTRY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#717d79] mb-1">Content</label>
            <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)}
              placeholder="Full text of the knowledge entry..."
              rows={5}
              className="w-full px-3 py-2 rounded-xl border border-black/[0.08] dark:border-slate-700 text-[13px] bg-white dark:bg-slate-900 text-[#0c0a09] dark:text-white placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30 resize-none font-mono" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-[#717d79] mb-1">Category</label>
              <input type="text" value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
                placeholder="e.g., indemnification"
                className="w-full px-3 py-2 rounded-xl border border-black/[0.08] dark:border-slate-700 text-[13px] bg-white dark:bg-slate-900 text-[#0c0a09] dark:text-white placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30" />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#717d79] mb-1">Tags (comma-separated)</label>
              <input type="text" value={newTags} onChange={(e) => setNewTags(e.target.value)}
                placeholder="e.g., M&A, indemnification, risk"
                className="w-full px-3 py-2 rounded-xl border border-black/[0.08] dark:border-slate-700 text-[13px] bg-white dark:bg-slate-900 text-[#0c0a09] dark:text-white placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30" />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#717d79] mb-1">Summary</label>
              <input type="text" value={newSummary} onChange={(e) => setNewSummary(e.target.value)}
                placeholder="One-line summary"
                className="w-full px-3 py-2 rounded-xl border border-black/[0.08] dark:border-slate-700 text-[13px] bg-white dark:bg-slate-900 text-[#0c0a09] dark:text-white placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={creating || !newTitle.trim() || !newContent.trim()}
              className="px-4 py-2 rounded-xl text-[13px] font-medium bg-[#15b881] text-white hover:bg-[#0a8a5f] transition-colors disabled:opacity-50">
              {creating ? 'Creating...' : 'Create Entry'}
            </button>
            <button onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-xl text-[13px] font-medium border border-black/[0.08] dark:border-slate-700 text-[#717d79] dark:text-[#969e9b] hover:bg-black/[0.02] dark:hover:bg-slate-800 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Entries List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-black/[0.04] dark:border-slate-800">
          <p className="text-[13px] text-[#717d79] dark:text-[#969e9b]">
            {entries.length === 0 ? 'No entries yet. Add one or ingest from a document.' : 'No entries match your filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((entry) => (
            <div key={entry.id} className="bg-white dark:bg-slate-900 rounded-xl border border-black/[0.04] dark:border-slate-800 p-4 hover:border-[#15b881]/20 transition-all">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${ENTRY_TYPE_COLORS[entry.entry_type] || ''}`}>
                      {entry.entry_type}
                    </span>
                    {entry.category && (
                      <span className="text-[11px] text-[#717d79] dark:text-[#969e9b]">· {entry.category}</span>
                    )}
                  </div>
                  <h3 className="text-[13px] font-medium text-[#0c0a09] dark:text-white">{entry.title}</h3>
                  {entry.summary && (
                    <p className="text-[12px] text-[#717d79] dark:text-[#969e9b] mt-1 line-clamp-2">{entry.summary}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    {entry.confidence !== undefined && (
                      <span className="text-[11px] text-[#969e9b]">Confidence: {(entry.confidence * 100).toFixed(0)}%</span>
                    )}
                    {entry.usage_count !== undefined && (
                      <span className="text-[11px] text-[#969e9b]">{entry.usage_count} uses</span>
                    )}
                    {entry.kb_name && (
                      <span className="text-[11px] text-[#969e9b]">in {entry.kb_name}</span>
                    )}
                  </div>
                </div>
                <button onClick={() => handleDeleteEntry(entry.id)}
                  className="p-1 text-[#969e9b] hover:text-red-500 transition-colors flex-shrink-0 ml-2" title="Delete">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Search View ──────────────────────────────────────────────────────────

function SearchView({ onBack }: { onBack: () => void }) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const data = await api.post<{ results: any[] }>('/kb/search', { query: query.trim(), topK: 20 });
      setResults(data?.results || []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1 text-[#717d79] hover:text-[#0c0a09] dark:hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className={`${serif} text-base font-normal text-[#0c0a09] dark:text-white`}>Semantic Search</h2>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search across all knowledge entries..."
          className="flex-1 px-4 py-3 rounded-xl border border-black/[0.08] dark:border-slate-700 text-[13px] bg-white dark:bg-slate-900 text-[#0c0a09] dark:text-white placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30"
        />
        <button type="submit" disabled={searching || !query.trim()}
          className="px-6 py-3 rounded-xl text-[13px] font-medium bg-[#15b881] text-white hover:bg-[#0a8a5f] transition-colors disabled:opacity-50">
          {searching ? 'Searching...' : 'Search'}
        </button>
      </form>

      {searching && (
        <div className="py-12 text-center">
          <div className="w-8 h-8 border-2 border-black/[0.06] border-t-[#15b881] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[13px] text-[#717d79]">Searching knowledge base...</p>
        </div>
      )}

      {!searching && results.length > 0 && (
        <div className="space-y-2">
          <p className="text-[12px] text-[#717d79] dark:text-[#969e9b]">{results.length} results found</p>
          {results.map((r: any, i: number) => (
            <div key={r.id || i} className="bg-white dark:bg-slate-900 rounded-xl border border-black/[0.04] dark:border-slate-800 p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${ENTRY_TYPE_COLORS[r.entry_type] || ''}`}>
                  {r.entry_type}
                </span>
                {r.similarity !== undefined && (
                  <span className="text-[11px] text-[#15b881] font-medium">{(r.similarity * 100).toFixed(0)}% match</span>
                )}
              </div>
              <h3 className="text-[13px] font-medium text-[#0c0a09] dark:text-white">{r.title}</h3>
              {r.summary && <p className="text-[12px] text-[#717d79] dark:text-[#969e9b] mt-1">{r.summary}</p>}
              {r.content && <p className="text-[11px] text-[#969e9b] mt-2 line-clamp-3 font-mono">{r.content.substring(0, 300)}</p>}
            </div>
          ))}
        </div>
      )}

      {!searching && results.length === 0 && query && (
        <div className="text-center py-12">
          <p className="text-[13px] text-[#717d79]">No results found. Try a different search term.</p>
        </div>
      )}
    </div>
  );
}

// ─── Ingest View ──────────────────────────────────────────────────────────

function IngestView({ bases, onBack, setError }: {
  bases: KnowledgeBase[];
  onBack: () => void;
  setError: (e: string) => void;
}) {
  const [docId, setDocId] = useState('');
  const [targetKb, setTargetKb] = useState('');
  const [ingesting, setIngesting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);

  useEffect(() => {
    api.get<{ data: any[] }>('/documents?limit=50')
      .then((res: any) => setDocuments(Array.isArray(res?.data?.data) ? res.data.data : []))
      .catch(() => {});
  }, []);

  const handleIngest = async () => {
    if (!docId) return;
    setIngesting(true);
    try {
      const data = await api.post('/kb/ingest', {
        documentId: docId,
        knowledgeBaseId: targetKb || undefined,
      });
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Ingestion failed');
    } finally {
      setIngesting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-xl">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1 text-[#717d79] hover:text-[#0c0a09] dark:hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h2 className={`${serif} text-base font-normal text-[#0c0a09] dark:text-white`}>Ingest from Document</h2>
          <p className="text-[11px] text-[#717d79] dark:text-[#969e9b]">AI will extract knowledge entries from a document</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-black/[0.04] dark:border-slate-800 p-6 space-y-4">
        <div>
          <label className="block text-[12px] font-medium text-[#717d79] mb-1">Document</label>
          <select value={docId} onChange={(e) => setDocId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-black/[0.08] dark:border-slate-700 text-[13px] bg-white dark:bg-slate-900 text-[#0c0a09] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#15b881]/30">
            <option value="">Select a document...</option>
            {documents.map((d: any) => (
              <option key={d.id} value={d.id}>{d.originalName} ({d.status})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[12px] font-medium text-[#717d79] mb-1">Target Knowledge Base (optional)</label>
          <select value={targetKb} onChange={(e) => setTargetKb(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-black/[0.08] dark:border-slate-700 text-[13px] bg-white dark:bg-slate-900 text-[#0c0a09] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#15b881]/30">
            <option value="">Auto-create "Document Knowledge" base</option>
            {bases.map((kb) => (
              <option key={kb.id} value={kb.id}>{KB_TYPE_ICONS[kb.type]} {kb.name} ({kb.entryCount} entries)</option>
            ))}
          </select>
        </div>

        <button onClick={handleIngest} disabled={ingesting || !docId}
          className="w-full px-4 py-3 rounded-xl text-[13px] font-medium bg-[#15b881] text-white hover:bg-[#0a8a5f] transition-colors disabled:opacity-50">
          {ingesting ? 'Extracting knowledge...' : 'Extract Knowledge Entries'}
        </button>

        {result && (
          <div className="bg-[#eaf7f0] rounded-xl p-4 text-[13px] text-[#0a8a5f]">
            <p className="font-medium">✅ Ingestion complete</p>
            <p className="mt-1">Entries found: {result.entriesFound} · Created: {result.entriesCreated}</p>
          </div>
        )}
      </div>
    </div>
  );
}
