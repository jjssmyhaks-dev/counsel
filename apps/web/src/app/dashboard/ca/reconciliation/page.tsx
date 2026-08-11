'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';

const serif = 'font-serif';

interface Client {
  id: string;
  name: string;
  email?: string;
  pan?: string;
  gstin?: string;
  _count?: { engagements: number; filings: number };
}

export default function CAReconciliationPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<Client[]>('/clients');
      setClients(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'reconciliation');
      await api.upload('/documents', formData);
      setUploadMsg('✅ "' + file.name + '" uploaded successfully for reconciliation.');
    } catch (err: any) {
      setUploadMsg('❌ Upload failed: ' + (err.message || 'Unknown error'));
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-48" />
        {[1, 2, 3].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className={`${serif} text-2xl font-bold text-[#0c0a09]`}>Reconciliation</h1>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={loadClients} className="font-medium underline">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className={`${serif} text-2xl font-bold text-[#0c0a09]`}>Reconciliation</h1>
        <p className="text-[#717d79] text-sm mt-1">Upload bank statements and reconcile client accounts</p>
      </div>

      {uploadMsg && (
        <div className={`px-4 py-3 rounded-xl text-sm ${uploadMsg.includes('✅') ? 'bg-[#eaf7f0] border border-[#c4d4b8] text-[#0a8a5f]' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {uploadMsg}
        </div>
      )}

      {/* Upload area */}
      <div className="bg-white rounded-2xl border border-black/[0.04] p-6">
        <h3 className="text-sm font-semibold text-[#0c0a09] mb-3">Upload Bank Statement / Ledger</h3>
        <div
          className="border-2 border-dashed border-black/[0.08] rounded-xl p-8 text-center cursor-pointer hover:border-[#15b881]/40 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".csv,.xlsx,.xls,.pdf,.txt"
            onChange={handleFileUpload}
            disabled={uploading}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="animate-spin w-6 h-6 border-2 border-[#15b881] border-t-transparent rounded-full" />
              <p className="text-sm text-[#717d79]">Uploading...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <svg className="w-8 h-8 text-[#969e9b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm text-[#0c0a09] font-medium">Click to upload or drag & drop</p>
              <p className="text-xs text-[#969e9b]">CSV, XLSX, PDF up to 10MB</p>
            </div>
          )}
        </div>
      </div>

      {/* Client list */}
      {clients.length === 0 ? (
        <div className="bg-white rounded-2xl border border-black/[0.04] p-12 text-center">
          <p className="text-[#717d79] text-sm">No clients yet. Add clients to start reconciliation.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map(client => (
            <div key={client.id} className="bg-white rounded-xl border border-black/[0.04] p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[#0c0a09]">{client.name}</p>
                <p className="text-xs text-[#717d79]">
                  {client.pan ? 'PAN: ' + client.pan + ' · ' : ''}
                  {client._count?.engagements || 0} engagements · {client._count?.filings || 0} filings
                </p>
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                className="px-3 py-1.5 bg-[#0c0a09] text-white rounded-lg text-xs font-medium hover:bg-[#0a8a5f] transition-colors"
              >
                Reconcile
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
