'use client';

import { useState } from 'react';

export default function MetricsPage() {
  const [loading] = useState(false);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-black/[0.06] rounded w-48" />
        <div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 bg-black/[0.06] rounded-xl" />)}</div>
        <div className="h-64 bg-black/[0.06] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1>Pilot Metrics Dashboard</h1>
        <p>Sterling &amp; Associates — Week 4 of 4</p>
      </div>

      {/* Executive Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Users" value="18" sub="of 20 seats" good />
        <StatCard label="Weekly Active" value="14" sub="78% ▸ target 60%" good />
        <StatCard label="Days Since Launch" value="28" sub="started Jun 15" />
        <StatCard label="Health" value="Good" sub="no critical issues" good />
      </div>

      {/* Adoption Funnel */}
      <Card title="Adoption Funnel">
        <div className="space-y-4">
          <FunnelBar label="Users Invited" value={20} max={20} color="bg-slate-600" />
          <FunnelBar label="Users Activated" value={18} max={20} color="bg-[#0a8a5f]" />
          <FunnelBar label="Weekly Active (W4)" value={14} max={20} color="bg-emerald-600" />
          <FunnelBar label="Power Users (≥10 actions/week)" value={6} max={20} color="bg-amber-600" />
        </div>
      </Card>

      {/* Module Usage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Module Usage (Weekly Avg)">
          <div className="space-y-4">
            <ModuleBar label="KB Queries" value={52} max={60} color="bg-[#0a8a5f]" />
            <ModuleBar label="Documents Analyzed" value={18} max={30} color="bg-emerald-600" />
            <ModuleBar label="Drafts Generated" value={14} max={25} color="bg-purple-600" />
            <ModuleBar label="Meetings Processed" value={8} max={15} color="bg-orange-600" />
            <ModuleBar label="Research Briefs" value={5} max={10} color="bg-pink-600" />
          </div>
        </Card>

        <Card title="Time Savings">
          <div className="space-y-4">
            <MetricRow
              label="Contract review time (avg)"
              before="4.2 hrs"
              after="2.1 hrs"
              delta="-50%"
              good
            />
            <MetricRow
              label="Estimated hours saved"
              before="—"
              after="168 hrs"
              delta="across firm"
            />
            <MetricRow
              label="Draft finalization rate"
              before="—"
              after="64%"
              delta="9 of 14 drafts"
              good
            />
            <MetricRow
              label="KB confidence (high)"
              before="—"
              after="78%"
              delta="+12% since W1"
              good
            />
          </div>
        </Card>
      </div>

      {/* Weekly Trend */}
      <Card title="Weekly Activity Trend">
        <div className="h-48 flex items-end gap-2">
          {[
            { week: 'W1', actions: 89, users: 11 },
            { week: 'W2', actions: 134, users: 13 },
            { week: 'W3', actions: 178, users: 15 },
            { week: 'W4', actions: 210, users: 14 },
          ].map((w) => (
            <div key={w.week} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs font-medium text-[#717d79]">{w.actions}</span>
              <div className="w-full bg-[#0a8a5f] rounded-t-lg" style={{ height: `${(w.actions / 210) * 100}%` }} />
              <span className="text-xs text-[#969e9b]">{w.week}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-[#969e9b] mt-3 text-center">Total AI actions per week (documents + KB + drafts + meetings)</p>
      </Card>

      {/* Recent Activity Feed */}
      <Card title="Recent Activity">
        <div className="space-y-3">
          {[
            { time: '2 min ago', user: 'Jane Partner', action: 'Ran contract analysis', resource: 'Merger Agreement v3.pdf', icon: '📄' },
            { time: '8 min ago', user: 'Mark Associate', action: 'Asked KB query', resource: 'What is our standard indemnification language?', icon: '🔍' },
            { time: '22 min ago', user: 'Sarah Paralegal', action: 'Generated draft', resource: 'Client update email — finalized', icon: '✏️' },
            { time: '45 min ago', user: 'Jane Partner', action: 'Processed meeting', resource: 'Weekly M&A sync — 8 action items', icon: '🎙️' },
            { time: '1 hr ago', user: 'Mark Associate', action: 'Uploaded document', resource: 'Vendor Agreement Q3.pdf', icon: '⬆️' },
            { time: '2 hrs ago', user: 'Admin', action: 'Invited user', resource: 'lisa.paralegal@sterlinglaw.com', icon: '👤' },
            { time: '3 hrs ago', user: 'Jane Partner', action: 'Created matter', resource: 'Acme Corp Due Diligence', icon: '📁' },
            { time: '5 hrs ago', user: 'Mark Associate', action: 'Completed action item', resource: 'Review liability cap language', icon: '✅' },
          ].map((entry, i) => (
            <div key={i} className="flex items-start gap-3 text-sm">
              <span className="text-lg">{entry.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[#4b5551]">
                  <span className="font-medium text-[#0c0a09]">{entry.user}</span>
                  {' '}{entry.action}
                </p>
                <p className="text-[#969e9b] truncate">{entry.resource}</p>
              </div>
              <span className="text-xs text-[#969e9b] whitespace-nowrap">{entry.time}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function StatCard({ label, value, sub, good }: { label: string; value: string | number; sub?: string; good?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-black/[0.06] p-5">
      <p className="text-2xl font-bold text-[#0c0a09]">{value}</p>
      <p className="text-sm text-[#717d79]">{label}</p>
      {sub && (
        <p className={`text-xs mt-1 ${good ? 'text-green-600' : 'text-[#969e9b]'}`}>
          {good ? '↑ ' : ''}{sub}
        </p>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-black/[0.06] p-6">
      <h3 className="text-lg font-semibold text-[#0c0a09] mb-4">{title}</h3>
      {children}
    </div>
  );
}

function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = (value / max) * 100;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-[#717d79]">{label}</span>
        <span className="font-medium text-[#0c0a09]">{value}</span>
      </div>
      <div className="h-3 bg-black/[0.04] rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ModuleBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = (value / max) * 100;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-[#717d79]">{label}</span>
        <span className="font-medium text-[#0c0a09]">{value}</span>
      </div>
      <div className="h-2.5 bg-black/[0.04] rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MetricRow({ label, before, after, delta, good }: { label: string; before: string; after: string; delta: string; good?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[#717d79]">{label}</span>
      <div className="flex items-center gap-3">
        {before !== '—' && <span className="text-[#969e9b] line-through">{before}</span>}
        <span className="font-medium text-[#0c0a09]">{after}</span>
        <span className={`text-xs font-medium ${good ? 'text-green-600' : 'text-[#717d79]'}`}>{delta}</span>
      </div>
    </div>
  );
}
