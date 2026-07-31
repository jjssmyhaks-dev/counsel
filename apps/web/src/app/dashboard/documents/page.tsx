'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { Document } from '@/lib/types';

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function StatusBadge({ status }: { status: string }) {
  const s = String(status || '').toLowerCase();
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium status-${s}`}>
      {String(status || '').charAt(0).toUpperCase() + String(status || '').slice(1)}
    </span>
  );
}

export default function DocumentsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filtered, setFiltered] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  useEffect(() => { loadDocuments(); }, []);

  useEffect(() => {
    let results = documents;
    if (search) {
      results = results.filter((d) =>
        (d.originalName || '').toLowerCase().includes(search.toLowerCase())
      );
    }
    if (statusFilter) {
      results = results.filter((d) => String(d.status || '').toLowerCase() === statusFilter.toLowerCase());
    }
    setFiltered(results);
  }, [search, statusFilter, documents]);

  async function loadDocuments() {
    setLoading(true);
    setError('');
    try {
      const resp = await api.get<{ data: Document[] }>('/documents');
      setDocuments(resp.data);
      setFiltered(resp.data);
    } catch {
      setError('Failed to load documents.');
    } finally {
      setLoading(false);
    }
  }

  function handleDelete(id: string) {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const input = fileInputRef.current;
    const file = input?.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setUploading(true);
    setUploadError('');
    try {
      await api.post('/documents', formData);
      setShowUpload(false);
      loadDocuments();
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="page-header !mb-0">
          <h1>Documents</h1>
          <p>Manage and analyze your firm&apos;s documents</p>
        </div>
        <button onClick={() => setShowUpload(true)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0c0a09] text-white rounded-xl text-sm font-medium hover:bg-[#0a8a5f] transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Upload
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#969e9b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input type="text" placeholder="Search documents..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-black/[0.08] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#15b881]/30" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border border-black/[0.08] rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#15b881]/30">
          <option value="">All Statuses</option>
          <option value="UPLOADED">Uploaded</option>
          <option value="PROCESSING">Processing</option>
          <option value="READY">Ready</option>
          <option value="FAILED">Failed</option>
        </select>
      </div>

      {error && <div className="bg-[#fdf0ee] border border-red-200 text-[#c2452e] px-4 py-3 rounded-xl text-sm flex items-center justify-between"><span>{error}</span><button onClick={loadDocuments} className="font-medium underline">Retry</button></div>}

      {loading && <div className="bg-white rounded-xl shadow-sm border overflow-hidden"><div className="p-5 space-y-4">{[1,2,3,4,5].map(i=><div key={i} className="flex items-center gap-4"><div className="skeleton h-10 w-10 rounded" /><div className="flex-1 space-y-2"><div className="skeleton h-4 w-2/3" /><div className="skeleton h-3 w-1/3" /></div><div className="skeleton h-6 w-20 rounded-full" /></div>)}</div></div>}

      {!loading && !error && filtered.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b bg-[#fefdfb]/50"><th className="text-left px-5 py-3 text-xs font-semibold text-[#969e9b] uppercase">Name</th><th className="text-left px-5 py-3 text-xs font-semibold text-[#969e9b] uppercase">Size</th><th className="text-left px-5 py-3 text-xs font-semibold text-[#969e9b] uppercase">Status</th><th className="text-left px-5 py-3 text-xs font-semibold text-[#969e9b] uppercase hidden md:table-cell">Matter</th><th className="text-left px-5 py-3 text-xs font-semibold text-[#969e9b] uppercase hidden md:table-cell">Uploaded</th><th className="text-right px-5 py-3 text-xs font-semibold text-[#969e9b] uppercase">Actions</th></tr></thead>
              <tbody>
                {filtered.map((doc) => (
                  <tr key={doc.id} className="border-b hover:bg-[#fefdfb] transition-colors">
                    <td className="px-5 py-3 cursor-pointer" onClick={() => router.push(`/dashboard/documents/${doc.id}`)}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-[#eaf7f0] rounded flex items-center justify-center">
                          <svg className="w-4 h-4 text-[#0a8a5f]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        </div>
                        <div><p className="text-sm font-medium truncate max-w-[220px]">{doc.originalName}</p><p className="text-xs text-[#969e9b]">{formatSize(doc.sizeBytes)}</p></div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs font-mono uppercase text-[#969e9b]">{(doc.mimeType || '').split('/')[1] || '—'}</td>
                    <td className="px-5 py-3"><StatusBadge status={doc.status} /></td>
                    <td className="px-5 py-3 text-sm text-[#717d79] hidden md:table-cell max-w-[180px] truncate">{doc.matter?.name || '—'}</td>
                    <td className="px-5 py-3 text-sm text-[#969e9b] hidden md:table-cell">{formatDate(doc.createdAt)}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => router.push(`/dashboard/documents/${doc.id}`)} className="text-xs text-[#0a8a5f] hover:text-[#15b881] font-medium">View</button>
                        <button onClick={() => handleDelete(doc.id)} className="text-xs text-red-500 hover:text-[#f0705b] font-medium">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <div className="w-16 h-16 bg-black/[0.03] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#969e9b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </div>
          <h3 className="text-lg font-semibold mb-1">{search || statusFilter ? 'No matching documents' : 'No documents yet'}</h3>
          <p className="text-[#969e9b] text-sm mb-4">{search || statusFilter ? 'Try adjusting your search or filters.' : 'Upload your first document to get started with analysis.'}</p>
          <button onClick={() => setShowUpload(true)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0c0a09] text-white rounded-xl text-sm font-medium hover:bg-[#0a8a5f] transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Upload Document
          </button>
        </div>
      )}

      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowUpload(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Upload Document</h3>
              <button onClick={() => setShowUpload(false)} className="text-[#969e9b] hover:text-[#717d79]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleUpload}>
              <div className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${dragOver ? 'border-[#15b881]/50 bg-[#eaf7f0]' : 'border-black/[0.08]'}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); }}>
                <svg className="w-10 h-10 text-[#969e9b] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                <p className="text-sm text-[#717d79] font-medium">Drag & drop files here</p>
                <p className="text-xs text-[#969e9b] mt-1">PDF, DOCX, TXT up to 50MB</p>
                {uploadError && <p className="text-xs text-[#c2452e] mt-2 font-medium">{uploadError}</p>}
                <input ref={fileInputRef} type="file" className="mt-4 text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-[#eaf7f0] file:text-[#0a8a5f]" accept=".pdf,.docx,.txt,.xlsx,.png,.jpg,.rtf" />
              </div>
              <div className="flex gap-3 mt-4">
                <button type="button" onClick={() => setShowUpload(false)} className="flex-1 px-4 py-2 border border-black/[0.08] text-[#717d79] rounded-xl text-sm font-medium">Cancel</button>
                <button type="submit" disabled={uploading} className="flex-1 px-4 py-2 bg-[#0c0a09] text-white rounded-xl text-sm font-medium hover:bg-[#0a8a5f] transition-colors disabled:opacity-50">
                  {uploading ? 'Uploading…' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
