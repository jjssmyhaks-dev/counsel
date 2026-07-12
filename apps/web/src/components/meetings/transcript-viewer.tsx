import React from 'react';
import type { Meeting } from '@/lib/types';

interface TranscriptViewerProps {
  meeting: Meeting;
  transcript?: string;
}

export function TranscriptViewer({ meeting, transcript }: TranscriptViewerProps) {
  const displayTranscript = transcript || meeting.transcript;

  if (!displayTranscript) {
    return (
      <div className="py-12 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-slate-900 mb-1">No Transcript Available</h3>
        <p className="text-sm text-slate-500 mb-4">
          Upload a recording or transcript file to enable AI-powered meeting analysis.
        </p>
        <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Upload Transcript
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 rounded-lg p-6 max-h-[500px] overflow-y-auto">
      <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
        {displayTranscript}
      </pre>
    </div>
  );
}
