'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Document, PaginatedResponse, CreateDocumentRequest } from '@/lib/types';
import { api, mockGetDocuments, mockGetDocument, mockGetAnalysis } from '@/lib/api';
import type { Analysis } from '@/lib/types';
import { ApiError } from '@/lib/api';

export function useDocuments() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<PaginatedResponse<Document>>('/documents');
      setDocuments(res.data);
    } catch {
      try {
        const res = await mockGetDocuments();
        setDocuments(res.data);
      } catch (mockErr) {
        setError(mockErr instanceof ApiError ? mockErr.message : 'Failed to load documents');
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  return { documents, loading, error, refetch: fetchDocuments };
}

export function useDocument(id: string) {
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    api.get<Document>(`/documents/${id}`)
      .then(setDocument)
      .catch(async () => {
        try {
          const doc = await mockGetDocument(id);
          setDocument(doc);
        } catch (mockErr) {
          setError(mockErr instanceof ApiError ? mockErr.message : 'Failed to load document');
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  return { document, loading, error };
}

export function useAnalysis(documentId: string) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!documentId) return;
    setLoading(true);
    setError(null);
    api.get<Analysis>(`/documents/${documentId}/analysis`)
      .then(setAnalysis)
      .catch(async () => {
        try {
          const a = await mockGetAnalysis(documentId);
          setAnalysis(a);
        } catch (mockErr) {
          setError(mockErr instanceof ApiError ? mockErr.message : 'Failed to load analysis');
        }
      })
      .finally(() => setLoading(false));
  }, [documentId]);

  return { analysis, loading, error };
}

export function useUploadDocument() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(async (file: File, matterId: string) => {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('matterId', matterId);
      const result = await api.upload<Document>('/documents/upload', formData);
      setUploading(false);
      return result;
    } catch (err) {
      setUploading(false);
      const message = err instanceof ApiError ? err.message : 'Upload failed';
      setError(message);
      throw err;
    }
  }, []);

  return { upload, uploading, error };
}
