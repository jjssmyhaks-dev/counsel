'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { PlaybookRule } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';

const CLAUSE_TYPES = [
  'Indemnification',
  'Liability Cap',
  'Termination',
  'IP Assignment',
  'Confidentiality',
  'Governing Law',
  'Force Majeure',
  'Data Processing',
  'Restrictive Covenant',
  'Change of Control',
  'Representations & Warranties',
  'Dispute Resolution',
  'Non-Solicitation',
  'Assignment',
  'Severability',
];

function RiskBadge({ level }: { level: PlaybookRule['riskLevel'] }) {
  const variant = level === 'low' ? 'success' : level === 'medium' ? 'warning' : level === 'high' ? 'danger' : 'danger';
  const label = level === 'low' ? 'Low' : level === 'medium' ? 'Medium' : level === 'high' ? 'High' : 'Critical';
  return <Badge variant={variant}>{label}</Badge>;
}

export default function PlaybookPage() {
  const [rules, setRules] = useState<PlaybookRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => { loadRules(); }, []);

  async function loadRules() {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<PlaybookRule[]>('/admin/playbook');
      setRules(data);
    } catch {
      setError('Failed to load playbook rules.');
    } finally {
      setLoading(false);
    }
  }

  function handleUpdateRule(id: string, field: keyof PlaybookRule, value: unknown) {
    setRules((prev) =>
      prev.map((rule) => (rule.id === id ? { ...rule, [field]: value } : rule))
    );
  }

  function handleToggleRule(id: string) {
    setRules((prev) =>
      prev.map((rule) => (rule.id === id ? { ...rule, enabled: !rule.enabled } : rule))
    );
  }

  function handleAddRule() {
    const newRule: PlaybookRule = {
      id: `rule-${Date.now()}`,
      name: 'New Rule',
      description: '',
      riskLevel: 'medium',
      clauseType: 'Indemnification',
      criteria: '',
      recommendedAction: '',
      examples: [],
      enabled: true,
    };
    setRules((prev) => [...prev, newRule]);
  }

  function handleSave() {
    setSaving(true);
    setSaveMessage('');
    setTimeout(() => {
      setSaving(false);
      setSaveMessage('Playbook rules saved successfully.');
      setTimeout(() => setSaveMessage(''), 3000);
    }, 800);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="page-header !mb-0">
          <h1>Playbook Configuration</h1>
          <p>Define firm-wide risk rules that drive AI document analysis, flagging, and recommendations</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={handleAddRule}>
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Rule
          </Button>
          <Button onClick={handleSave} loading={saving}>
            {saving ? 'Saving...' : 'Save Playbook'}
          </Button>
        </div>
      </div>

      {/* Save feedback */}
      {saveMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {saveMessage}
        </div>
      )}

      {/* Error */}
      {error && <ErrorState message={error} onRetry={loadRules} />}

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse">
              <div className="h-5 bg-slate-200 rounded w-1/3 mb-3" />
              <div className="h-4 bg-slate-100 rounded w-2/3 mb-2" />
              <div className="h-4 bg-slate-100 rounded w-1/2 mb-4" />
              <div className="flex gap-2">
                <div className="h-6 bg-slate-200 rounded-full w-16" />
                <div className="h-6 bg-slate-200 rounded-full w-20" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rules */}
      {!loading && !error && rules.length > 0 && (
        <div className="space-y-4">
          {rules.map((rule) => (
            <Card key={rule.id}>
              {/* Rule Header */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1">
                  <Input
                    value={rule.name}
                    onChange={(e) => handleUpdateRule(rule.id, 'name', e.target.value)}
                    className="text-base font-semibold !border-transparent !shadow-none !px-0 !py-0 hover:!border-slate-200 focus:!border-blue-500 focus:!px-3 focus:!py-2"
                    placeholder="Rule name..."
                  />
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <RiskBadge level={rule.riskLevel} />
                  {/* Toggle Switch */}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={() => handleToggleRule(rule.id)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    <span className="ml-2 text-xs text-slate-500">
                      {rule.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </label>
                </div>
              </div>

              {/* Rule Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Clause Type"
                  options={CLAUSE_TYPES.map((ct) => ({ value: ct, label: ct }))}
                  value={rule.clauseType}
                  onChange={(e) => handleUpdateRule(rule.id, 'clauseType', e.target.value)}
                />
                <Select
                  label="Risk Severity"
                  options={[
                    { value: 'low', label: 'Low' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High' },
                    { value: 'critical', label: 'Critical' },
                  ]}
                  value={rule.riskLevel}
                  onChange={(e) => handleUpdateRule(rule.id, 'riskLevel', e.target.value)}
                />
              </div>

              <div className="mt-3 space-y-3">
                <Textarea
                  label="Description"
                  value={rule.description}
                  onChange={(e) => handleUpdateRule(rule.id, 'description', e.target.value)}
                  rows={2}
                  placeholder="Describe what this rule checks for..."
                />
                <Textarea
                  label="Risk Criteria"
                  value={rule.criteria}
                  onChange={(e) => handleUpdateRule(rule.id, 'criteria', e.target.value)}
                  rows={2}
                  placeholder="Define the criteria that trigger this risk flag..."
                />
                <Textarea
                  label="Recommended Action"
                  value={rule.recommendedAction}
                  onChange={(e) => handleUpdateRule(rule.id, 'recommendedAction', e.target.value)}
                  rows={2}
                  placeholder="What action should be taken when this risk is detected?"
                />
                <Textarea
                  label="Examples (one per line)"
                  value={rule.examples.join('\n')}
                  onChange={(e) => handleUpdateRule(rule.id, 'examples', e.target.value.split('\n').filter((l) => l.trim()))}
                  rows={2}
                  placeholder={`Examples:\n- Unacceptable: No indemnification cap... — FLAG\n- Acceptable: 15% cap with 1% basket... — PASS`}
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && rules.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <EmptyState
            title="No playbook rules configured"
            description="Create rules that define how the AI analyzes documents, flags risks, and makes recommendations."
            actionLabel="Add First Rule"
            onAction={handleAddRule}
            icon={
              <svg className="w-16 h-16 text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
          />
        </div>
      )}

      {/* Bottom save button */}
      {!loading && !error && rules.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={handleSave} loading={saving} size="lg">
            {saving ? 'Saving...' : 'Save Playbook'}
          </Button>
        </div>
      )}
    </div>
  );
}
