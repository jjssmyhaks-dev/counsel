'use client';

import { useEffect, useState } from 'react';
import { getFirm, getUser } from '@/lib/auth';
import type { Firm, User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

function PlanBadge({ plan }: { plan: Firm['plan'] }) {
  const variant = plan === 'enterprise' ? 'success' : plan === 'professional' ? 'info' : 'neutral';
  return <Badge variant={variant}>{plan.charAt(0).toUpperCase() + plan.slice(1)}</Badge>;
}

export default function SettingsPage() {
  const [firm, setFirm] = useState<Firm | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const [firmName, setFirmName] = useState('');
  const [firmDomain, setFirmDomain] = useState('');
  const [features, setFeatures] = useState<Firm['settings']['features']>({
    documentAnalysis: true,
    research: true,
    drafting: true,
    knowledgeBase: true,
    meetings: true,
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');

  useEffect(() => {
    const u = getUser();
    const f = getFirm();
    setUser(u);
    setFirm(f);
    if (f) {
      setFirmName(f.name);
      setFirmDomain(f.domain);
      setFeatures(f.settings.features);
    }
    setLoading(false);
  }, []);

  function handleSave() {
    setSaving(true);
    setSaveMessage('');
    setTimeout(() => {
      setSaving(false);
      setEditing(false);
      setSaveMessage('Firm profile updated successfully.');
      setTimeout(() => setSaveMessage(''), 3000);
    }, 800);
  }

  function toggleFeature(key: keyof Firm['settings']['features']) {
    setFeatures((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="page-header">
          <div className="h-8 bg-slate-200 rounded w-48 animate-pulse mb-2" />
          <div className="h-4 bg-slate-100 rounded w-64 animate-pulse" />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse">
          <div className="h-6 bg-slate-200 rounded w-1/3 mb-4" />
          <div className="space-y-3">
            <div className="h-10 bg-slate-100 rounded" />
            <div className="h-10 bg-slate-100 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="page-header">
        <h1>Settings</h1>
        <p>Manage your firm profile, features, and platform configuration</p>
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

      {/* Firm Profile */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-900">Firm Profile</h3>
          {!editing ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Edit Profile
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSave} loading={saving}>Save Changes</Button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Firm Name</label>
            {editing ? (
              <Input
                value={firmName}
                onChange={(e) => setFirmName(e.target.value)}
                placeholder="Sterling & Associates LLP"
              />
            ) : (
              <p className="text-sm text-slate-900 font-medium">{firmName}</p>
            )}
          </div>

          {/* Domain */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Domain</label>
            {editing ? (
              <Input
                value={firmDomain}
                onChange={(e) => setFirmDomain(e.target.value)}
                placeholder="sterling-law.com"
              />
            ) : (
              <p className="text-sm text-slate-500 font-mono">{firmDomain}</p>
            )}
          </div>

          {/* Plan */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Plan</label>
            <div className="flex items-center gap-2">
              <PlanBadge plan={firm?.plan || 'professional'} />
              <span className="text-xs text-slate-400">Current subscription plan</span>
            </div>
          </div>

          {/* Stats */}
          {firm && (
            <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-100">
              <div>
                <p className="text-xs text-slate-500">Firm ID</p>
                <p className="text-sm font-mono text-slate-600">{firm.id}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Member Since</p>
                <p className="text-sm text-slate-600">{new Date(firm.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
              </div>
              {user && (
                <>
                  <div>
                    <p className="text-xs text-slate-500">Current User</p>
                    <p className="text-sm text-slate-600">{user.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Your Role</p>
                    <Badge variant={user.role === 'admin' ? 'danger' : user.role === 'partner' ? 'info' : 'success'}>
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </Badge>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Features Toggles */}
      <Card>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Features</h3>
        <p className="text-sm text-slate-500 mb-6">
          Enable or disable platform features for your firm. Disabled features will be hidden from all users.
        </p>
        <div className="space-y-4">
          {[
            { key: 'documentAnalysis' as const, label: 'Document Analysis', description: 'AI-powered document review, risk analysis, and clause flagging' },
            { key: 'research' as const, label: 'Research Synthesis', description: 'Legal research briefs, precedent analysis, and memo generation' },
            { key: 'drafting' as const, label: 'Drafting', description: 'AI-assisted legal drafting for emails, memos, reports, and briefs' },
            { key: 'knowledgeBase' as const, label: 'Knowledge Base', description: 'Firm-wide search across documents, precedents, and playbooks' },
            { key: 'meetings' as const, label: 'Meetings', description: 'Transcript processing, action item extraction, and meeting intelligence' },
          ].map(({ key, label, description }) => (
            <div key={key} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-800">{label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{description}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4 flex-shrink-0">
                <input
                  type="checkbox"
                  checked={features[key]}
                  onChange={() => toggleFeature(key)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          ))}
        </div>
      </Card>

      {/* API Configuration */}
      <Card>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">API Configuration</h3>
        <p className="text-sm text-slate-500 mb-4">
          API endpoint for programmatic access to the Counsel platform.
        </p>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">API Endpoint URL</label>
          <div className="flex items-center gap-2 bg-slate-50 rounded-lg border border-slate-200 px-3 py-2">
            <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <code className="text-sm text-slate-600 font-mono select-all">https://api.counsel.ai/v1</code>
          </div>
        </div>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900">Danger Zone</h3>
            <p className="text-sm text-slate-500 mt-1 mb-4">
              Permanently delete your firm and all associated data. This action cannot be undone.
            </p>

            {!showDeleteConfirm ? (
              <Button
                variant="danger"
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete Firm
              </Button>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
                <p className="text-sm text-red-800 font-medium">
                  This will permanently delete all data including documents, matters, drafts, research, and user accounts.
                </p>
                <div>
                  <label className="block text-xs font-medium text-red-700 mb-1">
                    Type <span className="font-mono font-bold">DELETE</span> to confirm:
                  </label>
                  <Input
                    value={deleteInput}
                    onChange={(e) => setDeleteInput(e.target.value)}
                    placeholder='Type "DELETE" to confirm'
                    className="border-red-300"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="danger"
                    disabled={deleteInput !== 'DELETE'}
                    onClick={() => {
                      // In a real app, this would call the delete API
                      setShowDeleteConfirm(false);
                      setDeleteInput('');
                    }}
                  >
                    Permanently Delete
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteInput('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
