'use client';

import { useState } from 'react';

// ─── Types (mirror shared types) ───

interface PlaybookRule {
  id: string;
  name: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  clauseType: string;
  criteria: string;
  recommendedAction: string;
  examples: string[];
  enabled: boolean;
}

// ─── Default rules ───

const CLAUSE_TYPE_OPTIONS = [
  'Indemnification',
  'Limitation of Liability',
  'Confidentiality',
  'Termination',
  'Governing Law',
  'Dispute Resolution',
  'Force Majeure',
  'Assignment',
  'Payment Terms',
  'Non-Compete',
  'Data Protection',
  'IP Assignment',
  'Warranty',
  'Insurance',
  'Other',
];

const RISK_LEVELS: PlaybookRule['riskLevel'][] = ['low', 'medium', 'high', 'critical'];

function makeId(): string {
  return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const DEFAULT_RULES: PlaybookRule[] = [
  {
    id: makeId(),
    name: 'Indemnification — Unlimited Liability',
    description: 'Flag clauses where one party indemnifies the other without any cap on liability.',
    riskLevel: 'critical',
    clauseType: 'Indemnification',
    criteria: 'The indemnification clause does not specify a liability cap, or the cap is explicitly stated as unlimited.',
    recommendedAction: 'Negotiate a reasonable cap, typically tied to the contract value or a multiple of fees paid.',
    examples: ['"Party A shall indemnify Party B for any and all claims, losses, damages..."'],
    enabled: true,
  },
  {
    id: makeId(),
    name: 'Limitation of Liability — Mutual vs Unilateral',
    description: 'Ensure the limitation of liability clause applies mutually to both parties.',
    riskLevel: 'high',
    clauseType: 'Limitation of Liability',
    criteria: 'The limitation of liability language applies only to one party or carves out significant exceptions for the counterparty.',
    recommendedAction: 'Request mutual limitation language. If carve-outs exist, ensure they are reciprocal.',
    examples: ['"Notwithstanding the foregoing, Party B\'s liability shall cap at..." (only one party capped)'],
    enabled: true,
  },
  {
    id: makeId(),
    name: 'Termination — Without Cause Window',
    description: 'Assess whether the termination-for-convenience clause is unreasonably short.',
    riskLevel: 'medium',
    clauseType: 'Termination',
    criteria: 'Either party may terminate without cause with less than 30 days written notice.',
    recommendedAction: 'Negotiate for 60-90 day notice period, or include a wind-down provision.',
    examples: ['"This agreement may be terminated by either party upon 7 days written notice."'],
    enabled: true,
  },
  {
    id: makeId(),
    name: 'Governing Law — Unfavourable Jurisdiction',
    description: 'Check whether the governing law and venue favour the counterparty.',
    riskLevel: 'medium',
    clauseType: 'Governing Law',
    criteria: `Governing law is outside the firm's client's home state and the venue is exclusive courts in that foreign jurisdiction.`,
    recommendedAction: `Propose the client's home-state law or at minimum a neutral venue (AAA/JAMS).`,
    examples: ['"This agreement shall be governed by the laws of Delaware and exclusive venue in Wilmington."'],
    enabled: true,
  },
  {
    id: makeId(),
    name: 'IP Assignment — Work-for-Hire Clarity',
    description: 'Verify that IP assignment language clearly defines what constitutes "Work Product".',
    riskLevel: 'high',
    clauseType: 'IP Assignment',
    criteria: 'The definition of assigned IP is overly broad or includes pre-existing IP without explicit carve-out.',
    recommendedAction: 'Insert a carve-out for background IP and narrowly define deliverables.',
    examples: ['"All intellectual property developed during the term of this agreement, whether or not related to the project..."'],
    enabled: true,
  },
];

// ─── Component ───

export function PlaybookEditor() {
  const [rules, setRules] = useState<PlaybookRule[]>(DEFAULT_RULES);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function updateRule(id: string, field: keyof PlaybookRule, value: string | boolean) {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
    setSaved(false);
  }

  function addRule() {
    const newRule: PlaybookRule = {
      id: makeId(),
      name: '',
      description: '',
      riskLevel: 'medium',
      clauseType: CLAUSE_TYPE_OPTIONS[0],
      criteria: '',
      recommendedAction: '',
      examples: [],
      enabled: true,
    };
    setRules((prev) => [...prev, newRule]);
    setSaved(false);
  }

  function removeRule(id: string) {
    setRules((prev) => prev.filter((r) => r.id !== id));
    setSaved(false);
  }

  function handleSave() {
    setSaving(true);
    // Simulate API call
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      // Clear saved indicator after 3 seconds
      setTimeout(() => setSaved(false), 3000);
    }, 800);
  }

  function getRiskBadgeClass(level: PlaybookRule['riskLevel']): string {
    return `risk-${level}`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Playbook Rules</h2>
          <p className="text-sm text-slate-500 mt-1">
            Define rules that the AI uses to flag risky clauses during document analysis.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-sm text-green-600 font-medium flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Saving...
              </>
            ) : (
              'Save Playbook'
            )}
          </button>
        </div>
      </div>

      {/* Rules list */}
      {rules.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <svg className="mx-auto h-10 w-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="mt-3 text-sm text-slate-500">No rules defined yet. Add your first rule to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rules.map((rule) => (
            <div key={rule.id} className="bg-white rounded-xl border border-slate-200 shadow-sm">
              {/* Card header */}
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <input
                    type="text"
                    value={rule.name}
                    onChange={(e) => updateRule(rule.id, 'name', e.target.value)}
                    placeholder="Rule name..."
                    className="text-sm font-semibold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none flex-1 min-w-0 py-0.5"
                  />
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getRiskBadgeClass(rule.riskLevel)}`}
                  >
                    {rule.riskLevel}
                  </span>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  {/* Enabled toggle */}
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <span className="text-xs text-slate-500">{rule.enabled ? 'Enabled' : 'Disabled'}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={rule.enabled}
                      onClick={() => updateRule(rule.id, 'enabled', !rule.enabled)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        rule.enabled ? 'bg-blue-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          rule.enabled ? 'translate-x-[18px]' : 'translate-x-[3px]'
                        }`}
                      />
                    </button>
                  </label>
                  {/* Remove button */}
                  <button
                    onClick={() => removeRule(rule.id)}
                    className="text-slate-400 hover:text-red-600 transition-colors p-1"
                    title="Remove rule"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Card body */}
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Clause Type */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                      Clause Type
                    </label>
                    <select
                      value={rule.clauseType}
                      onChange={(e) => updateRule(rule.id, 'clauseType', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 text-sm px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    >
                      {CLAUSE_TYPE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Severity / Risk Level */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                      Risk Level
                    </label>
                    <select
                      value={rule.riskLevel}
                      onChange={(e) => updateRule(rule.id, 'riskLevel', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 text-sm px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    >
                      {RISK_LEVELS.map((lvl) => (
                        <option key={lvl} value={lvl}>
                          {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                    Description
                  </label>
                  <textarea
                    value={rule.description}
                    onChange={(e) => updateRule(rule.id, 'description', e.target.value)}
                    placeholder="Brief description of what this rule flags..."
                    rows={2}
                    className="w-full rounded-lg border border-slate-300 text-sm px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
                  />
                </div>

                {/* Risk Criteria */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                    Risk Criteria
                  </label>
                  <textarea
                    value={rule.criteria}
                    onChange={(e) => updateRule(rule.id, 'criteria', e.target.value)}
                    placeholder="Specific criteria that triggers this rule..."
                    rows={3}
                    className="w-full rounded-lg border border-slate-300 text-sm px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
                  />
                </div>

                {/* Recommended Action */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                    Recommended Action
                  </label>
                  <textarea
                    value={rule.recommendedAction}
                    onChange={(e) => updateRule(rule.id, 'recommendedAction', e.target.value)}
                    placeholder="What action should the reviewer take?"
                    rows={2}
                    className="w-full rounded-lg border border-slate-300 text-sm px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Rule button */}
      <button
        onClick={addRule}
        className="w-full flex items-center justify-center gap-2 px-5 py-3 border-2 border-dashed border-slate-300 rounded-xl text-sm font-medium text-slate-500 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Add Rule
      </button>
    </div>
  );
}
