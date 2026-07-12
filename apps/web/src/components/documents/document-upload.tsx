'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { Select } from '../ui/select';
import type { Matter } from '@/lib/types';

interface DocumentUploadProps {
  open: boolean;
  onClose: () => void;
  onUpload: (file: File, matterId: string) => Promise<void>;
  matters: Matter[];
}

export function DocumentUpload({ open, onClose, onUpload, matters }: DocumentUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [matterId, setMatterId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File | null) => {
    setFile(f);
    setError(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleSubmit = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }
    if (!matterId) {
      setError('Please select a matter');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      await onUpload(file, matterId);
      setFile(null);
      setMatterId('');
      onClose();
    } catch {
      setError('Upload failed. Please try again.');
    }
    setUploading(false);
  };

  const matterOptions = [
    { value: '', label: 'Select a matter...' },
    ...matters.map((m) => ({ value: m.id, label: `${m.name} (${m.clientName})` })),
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Upload Document"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={uploading} disabled={!file || !matterId}>
            Upload
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Drag & Drop */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
            ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400'}
            ${file ? 'bg-slate-50' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.txt,.rtf"
            onChange={(e) => handleFile(e.target.files?.[0] || null)}
          />
          {file ? (
            <div className="space-y-2">
              <div className="w-12 h-12 mx-auto rounded-xl bg-blue-50 flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="font-medium text-slate-900">{file.name}</p>
              <p className="text-sm text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              <button
                onClick={(e) => { e.stopPropagation(); setFile(null); }}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="font-medium text-slate-700">Drop your file here or click to browse</p>
              <p className="text-sm text-slate-500">PDF, DOCX, DOC, TXT up to 50MB</p>
            </div>
          )}
        </div>

        {/* Matter Select */}
        <Select
          label="Associate with Matter"
          options={matterOptions}
          value={matterId}
          onChange={(e) => setMatterId(e.target.value)}
        />

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
