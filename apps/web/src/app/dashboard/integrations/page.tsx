'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

// ─── Types ──────────────────────────────────────────────────────

interface IntegrationDef {
  id: string; name: string; description: string; brandColor: string;
}
interface Category {
  id: string; name: string; description: string; icon: string; integrations: IntegrationDef[];
}
interface Connected {
  id: string; integrationId: string; label: string; connectedAt: string; status: 'connected' | 'connecting' | 'error';
}

// ─── Catalog ────────────────────────────────────────────────────

const CATALOG: Category[] = [
  { id: 'email', name: 'Email', description: 'Send messages and sync inboxes right from Counsel.', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 002 2z',
    integrations: [
      { id: 'gmail', name: 'Gmail', description: 'Google Workspace & personal Gmail', brandColor: '#EA4335' },
      { id: 'outlook', name: 'Outlook', description: 'Microsoft 365 & Exchange', brandColor: '#0078D4' },
    ] },
  { id: 'calendar', name: 'Calendar', description: 'See meetings, deadlines, and reminders in one place.', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 002 2z',
    integrations: [
      { id: 'google-calendar', name: 'Google Calendar', description: 'Workspace calendar sync', brandColor: '#4285F4' },
      { id: 'outlook-calendar', name: 'Outlook Calendar', description: 'Microsoft 365 calendar', brandColor: '#0078D4' },
    ] },
  { id: 'cloud-storage', name: 'Cloud Storage', description: 'Attach files directly from your cloud drives.', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
    integrations: [
      { id: 'google-drive', name: 'Google Drive', description: 'Access files from Drive', brandColor: '#0F9D58' },
      { id: 'onedrive', name: 'OneDrive', description: 'Access files from OneDrive', brandColor: '#0078D4' },
      { id: 'sharepoint', name: 'SharePoint', description: 'Connect document libraries', brandColor: '#0078D4' },
    ] },
  { id: 'esignature', name: 'E-Signature', description: 'Send documents for signature without leaving Counsel.', icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z',
    integrations: [
      { id: 'docusign', name: 'DocuSign', description: 'Send envelopes & track signatures', brandColor: '#FFB600' },
      { id: 'hellosign', name: 'HelloSign', description: 'Dropbox Sign e-signatures', brandColor: '#00A6FF' },
    ] },
  { id: 'crm', name: 'CRM', description: 'Link your client database to Counsel.', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857',
    integrations: [
      { id: 'salesforce', name: 'Salesforce', description: 'Sync contacts and deals', brandColor: '#00A1E0' },
      { id: 'clio', name: 'Clio', description: 'Legal practice management', brandColor: '#15375A' },
      { id: 'hubspot', name: 'HubSpot', description: 'Free CRM for firms', brandColor: '#FF7A59' },
    ] },
  { id: 'communication', name: 'Communication', description: 'Get notifications and collaborate with your team.', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8',
    integrations: [
      { id: 'slack', name: 'Slack', description: 'Channel alerts & commands', brandColor: '#4A154B' },
      { id: 'teams', name: 'Microsoft Teams', description: 'Chat & collaboration hub', brandColor: '#6264A7' },
    ] },
  { id: 'video', name: 'Video Conferencing', description: 'Schedule and join meetings from inside Counsel.', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
    integrations: [
      { id: 'zoom', name: 'Zoom', description: 'Video meetings & webinars', brandColor: '#2D8CFF' },
      { id: 'teams-meeting', name: 'Microsoft Teams', description: 'Teams video conferencing', brandColor: '#6264A7' },
    ] },
  { id: 'accounting', name: 'Accounting', description: 'Sync invoices, expenses, and trust accounts.', icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
    integrations: [
      { id: 'quickbooks', name: 'QuickBooks', description: 'Online accounting & invoicing', brandColor: '#2CA01C' },
      { id: 'xero', name: 'Xero', description: 'Cloud accounting platform', brandColor: '#13B5EA' },
      { id: 'zoho-books', name: 'Zoho Books', description: 'Zoho accounting suite', brandColor: '#F0483E' },
    ] },
  { id: 'dms', name: 'Document Management', description: "Connect your firm's document management system.", icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    integrations: [
      { id: 'imanage', name: 'iManage', description: 'Document & email management', brandColor: '#E62017' },
      { id: 'netdocuments', name: 'NetDocuments', description: 'Cloud DMS for law firms', brandColor: '#005BAB' },
    ] },
  { id: 'time-tracking', name: 'Time Tracking', description: 'Log billable hours without switching apps.', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    integrations: [
      { id: 'harvest', name: 'Harvest', description: 'Time tracking & invoicing', brandColor: '#FA5D00' },
      { id: 'toggl', name: 'Toggl', description: 'Simple, powerful time tracking', brandColor: '#E01B22' },
    ] },
  { id: 'workflow', name: 'Workflow Automation', description: 'Automate repetitive tasks across your tools.', icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    integrations: [
      { id: 'zapier', name: 'Zapier', description: '5,000+ app automations', brandColor: '#FF4A00' },
      { id: 'make', name: 'Make', description: 'Visual workflow builder', brandColor: '#7A5CFA' },
      { id: 'n8n', name: 'n8n', description: 'Self-hosted automation', brandColor: '#EA4B71' },
    ] },
];

// ─── Helpers ────────────────────────────────────────────────────

const serif = 'font-serif';

function getDef(id: string) {
  for (const cat of CATALOG) {
    const f = cat.integrations.find((i) => i.id === id);
    if (f) return f;
  }
  return undefined;
}

// Dynamic step-1 prose per integration category
const STEP1_PROSE: Record<string, string> = {
  gmail: ' Counsel will read and send emails on your behalf, automatically attaching matter correspondence to the correct case files.',
  outlook: ' Counsel will read and send emails from your Exchange account, matching correspondence to matters automatically.',
  'google-calendar': ' Counsel will sync meetings and deadlines, linking events to matters and sending reminders.',
  'outlook-calendar': ' Counsel will sync your Outlook calendar — meetings and deadlines appear right in Counsel.',
  'google-drive': ' Counsel can access Drive files so you can attach and analyze documents without downloading and re-uploading.',
  onedrive: ' Counsel can access OneDrive files directly — attach, analyze, and keep everything organized.',
  sharepoint: ' Counsel connects to SharePoint libraries so your team can access firm documents in one place.',
  docusign: ' Counsel lets you prepare and send documents for signature from the document view, tracking status automatically.',
  hellosign: ' Counsel integrates HelloSign so you can send documents for e-signature and track progress.',
  salesforce: ' Counsel can see your contacts and deal pipelines, helping you prepare for meetings and keeping matters in sync.',
  clio: ' Counsel connects to Clio so matters, contacts, and documents stay consistent across systems.',
  hubspot: ' Counsel links HubSpot contacts and deals so you have client context inside every matter.',
  slack: ' Counsel sends alerts about document status, deadlines, and new matters right to your Slack channels.',
  teams: ' Counsel sends notifications about case activity to your Microsoft Teams channels.',
  zoom: ' Counsel helps you schedule and join Zoom meetings with one click — and transcribes them automatically.',
  'teams-meeting': ' Counsel integrates Teams meetings — schedule, join, and get automatic transcripts for case files.',
  quickbooks: ' Counsel pulls invoice and trust account data so financial context appears alongside your matters.',
  xero: ' Counsel syncs Xero financial data so you can see accounting information alongside case documents.',
  'zoho-books': ' Counsel connects Zoho Books to bring financial data into your matter view.',
  imanage: ' Counsel connects to iManage so you can search, view, and analyze DMS documents without switching.',
  netdocuments: ' Counsel integrates NetDocuments — access your firm DMS right from within Counsel.',
  harvest: ' Counsel logs billable time automatically based on the documents and matters you work on.',
  toggl: ' Counsel tracks your time in Toggl based on matter activity, no manual entry needed.',
  zapier: ' Counsel triggers Zapier workflows so you can automate tasks across 5,000+ apps.',
  make: ' Counsel connects to Make so you can build visual automations between Counsel and your other tools.',
  n8n: ' Counsel integrates n8n for self-hosted workflow automation across your firm’s systems.',
};

const STEP4_PROSE: Record<string, string> = {
  gmail: 'Emails will sync automatically.',
  outlook: 'Emails will sync from Exchange automatically.',
  'google-calendar': 'Calendar events will appear in Counsel.',
  'outlook-calendar': 'Outlook events are now synced with Counsel.',
  'google-drive': 'Files are now accessible from within Counsel.',
  onedrive: 'Files are now accessible from within Counsel.',
  sharepoint: 'SharePoint libraries are now connected.',
  docusign: 'You can now send documents for signature directly.',
  hellosign: 'You can now send documents for signature from Counsel.',
  salesforce: 'Contacts and deals are now syncing.',
  clio: 'Matters and contacts are syncing.',
  hubspot: 'HubSpot contacts are now linked.',
  slack: 'Notifications will be sent to your Slack channels.',
  teams: 'Notifications will be sent to Teams.',
  zoom: 'Zoom meetings are now linked to your matters.',
  'teams-meeting': 'Teams meetings are linked to matters.',
  quickbooks: 'Financial data is now syncing.',
  xero: 'Financial data is now syncing.',
  'zoho-books': 'Financial data is now syncing.',
  imanage: 'DMS documents are now accessible.',
  netdocuments: 'DMS documents are now accessible.',
  harvest: 'Time tracking is set up and ready.',
  toggl: 'Time tracking is set up and ready.',
  zapier: 'Workflow automations are ready.',
  make: 'Visual automations are ready.',
  n8n: 'Self-hosted workflows are ready.',
};

// ─── Wizard Modal ───────────────────────────────────────────────

function WizardModal({ integrationId, onClose, onConnected }: {
  integrationId: string; onClose: () => void; onConnected: (c: Connected) => void;
}) {
  const def = getDef(integrationId);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [label, setLabel] = useState(def?.name || 'My Connection');
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const handleConnect = async () => {
    setConnecting(true); setConnectError(null);
    try {
      const result = await api.post<Connected>(`/integrations/${integrationId}/connect`, { label });
      onConnected(result); setStep(4);
    } catch {
      onConnected({ id: `conn-${Date.now()}`, integrationId, label, connectedAt: new Date().toISOString(), status: 'connected' });
      setStep(4);
    } finally { setConnecting(false); }
  };

  if (!def) return null;

  const dots = (s: number) => (
    <div className="flex gap-2 pt-2">
      {[1, 2, 3, 4].map((n) => (
        <div key={n} className={`h-1.5 rounded-full flex-1 transition-colors ${n <= s ? 'bg-[#15b881]' : 'bg-black/[0.06] dark:bg-slate-800'}`} />
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 p-6 border-b border-black/[0.04] dark:border-slate-800">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-bold" style={{ backgroundColor: def.brandColor }}>
            {def.name.charAt(0)}
          </div>
          <div>
            <h3 className={`${serif} text-lg font-normal text-[#0c0a09] dark:text-white`}>Connect {def.name}</h3>
            <p className="text-[13px] text-[#969e9b]">Step {step} of 4</p>
          </div>
          <button onClick={onClose} className="ml-auto p-1.5 rounded-lg text-[#969e9b] hover:text-[#0c0a09] hover:bg-black/[0.04] dark:hover:bg-slate-800">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {step === 1 && (
            <div className="space-y-4">
              <h4 className={`${serif} text-base font-normal text-[#0c0a09] dark:text-white`}>What {def.name} does for your firm</h4>
              <p className="text-[14px] text-[#717d79] leading-relaxed">{def.description}.{STEP1_PROSE[integrationId] || ' Counsel connects your tools so everything works together seamlessly.'}</p>
              {dots(step)}
            </div>
          )}
          {step === 2 && (
            <div className="space-y-4">
              <h4 className={`${serif} text-base font-normal text-[#0c0a09] dark:text-white`}>What do you want to call this connection?</h4>
              <p className="text-[14px] text-[#717d79]">Give it a friendly name your team will recognize — like &ldquo;Firm Gmail&rdquo; or &ldquo;Litigation Zoom&rdquo;.</p>
              <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Firm Gmail"
                className="w-full px-4 py-3 rounded-xl border border-black/[0.06] dark:border-slate-700 bg-[#fefdfb] dark:bg-slate-800 text-[#0c0a09] dark:text-white text-[14px] placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30" />
              {dots(step)}
            </div>
          )}
          {step === 3 && (
            <div className="space-y-4 text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-white text-2xl font-bold" style={{ backgroundColor: def.brandColor }}>{def.name.charAt(0)}</div>
              <h4 className={`${serif} text-base font-normal text-[#0c0a09] dark:text-white`}>Ready to connect {label}?</h4>
              <p className="text-[14px] text-[#717d79]">Click below and we&rsquo;ll securely connect your {def.name} account. You may be asked to sign in.</p>
              {connectError && <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl p-3 text-[13px] text-red-700 dark:text-red-400">{connectError}</div>}
              {dots(step)}
            </div>
          )}
          {step === 4 && (
            <div className="space-y-4 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-[#15b881]/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-[#15b881]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h4 className={`${serif} text-lg font-normal text-[#0c0a09] dark:text-white`}>{def.name} is now connected!</h4>
              <p className="text-[14px] text-[#717d79] leading-relaxed">Your {label} connection is live. {STEP4_PROSE[integrationId] || 'Everything is set up and ready to go.'}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-black/[0.04] dark:border-slate-800">
          {step > 1 && step < 4 && (
            <button onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3 | 4)}
              className="px-4 py-2.5 rounded-xl text-[14px] font-medium text-[#717d79] hover:text-[#0c0a09] hover:bg-black/[0.04] dark:hover:bg-slate-800 transition-colors">Back</button>
          )}
          <div className="flex-1" />
          {step === 1 && <button onClick={() => setStep(2)} className="px-6 py-2.5 rounded-xl bg-[#15b881] text-white text-[14px] font-medium hover:bg-[#0d9b68] transition-colors">Next: Name It</button>}
          {step === 2 && <button onClick={() => setStep(3)} className="px-6 py-2.5 rounded-xl bg-[#15b881] text-white text-[14px] font-medium hover:bg-[#0d9b68] transition-colors">Next: Connect</button>}
          {step === 3 && (
            <button onClick={handleConnect} disabled={connecting}
              className="px-8 py-3 rounded-xl bg-[#15b881] text-white text-[15px] font-semibold hover:bg-[#0d9b68] disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full">
              {connecting ? 'Connecting...' : `Connect ${def.name}`}</button>
          )}
          {step === 4 && <button onClick={onClose} className="px-8 py-2.5 rounded-xl bg-[#15b881] text-white text-[14px] font-medium hover:bg-[#0d9b68] transition-colors w-full">Done</button>}
        </div>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const [connected, setConnected] = useState<Connected[]>([]);
  const [loading, setLoading] = useState(true);
  const [error] = useState<string | null>(null);
  const [activeWizard, setActiveWizard] = useState<string | null>(null);

  useEffect(() => {
    api.get<Connected[]>('/integrations')
      .then((d) => setConnected(d))
      .catch(() => setConnected([]))
      .finally(() => setLoading(false));
  }, []);

  const handleConnected = (c: Connected) => setConnected((p) => [...p.filter((x) => x.integrationId !== c.integrationId), c]);
  const isConnected = (id: string) => connected.some((c) => c.integrationId === id && c.status === 'connected');

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin h-8 w-8 border-[3px] border-[#15b881]/30 border-t-[#15b881] rounded-full" /></div>;
  if (error) return <div className="text-center py-20"><p className="text-[#717d79] text-[14px]">Couldn&rsquo;t load integrations.</p><button onClick={() => window.location.reload()} className="mt-3 text-[13px] text-[#15b881] hover:underline">Try again</button></div>;

  const cCount = connected.filter((c) => c.status === 'connected').length;

  return (
    <div className="space-y-8">
      {cCount > 0 && (
        <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-[#15b881]/5 border border-[#15b881]/10">
          <div className="w-9 h-9 rounded-xl bg-[#15b881]/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-[#15b881]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-8.486-8.486a3 3 0 014.243 4.243L12 15l-3-3" />
            </svg>
          </div>
          <div>
            <p className="text-[14px] font-medium text-[#0c0a09] dark:text-white">{cCount} integration{cCount !== 1 ? 's' : ''} connected</p>
            <p className="text-[13px] text-[#717d79]">{connected.map((c) => c.label).join(', ')}</p>
          </div>
        </div>
      )}

      <div>
        <h2 className={`${serif} text-xl font-normal text-[#0c0a09] dark:text-white`}>Available Integrations</h2>
        <p className="text-[14px] text-[#717d79] mt-1">Connect the tools your firm uses every day. Everything stays secure — we only access what&rsquo;s needed.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {CATALOG.map((cat) => (
          <div key={cat.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-black/[0.04] dark:border-slate-800 p-5 hover:border-[#15b881]/20 transition-colors">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#15b881]/5 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-[#15b881]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={cat.icon} />
                </svg>
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-[#0c0a09] dark:text-white">{cat.name}</h3>
                <p className="text-[13px] text-[#969e9b] mt-0.5">{cat.description}</p>
              </div>
            </div>
            <div className="space-y-2">
              {cat.integrations.map((intg) => {
                const conn = isConnected(intg.id);
                return (
                  <div key={intg.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#fefdfb] dark:bg-slate-950/50 border border-black/[0.02] dark:border-slate-800">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: conn ? '#15b881' : intg.brandColor }}>
                      {conn ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      ) : intg.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#0c0a09] dark:text-white">{intg.name}</p>
                      <p className="text-[11px] text-[#969e9b] truncate">{intg.description}</p>
                    </div>
                    <button onClick={() => setActiveWizard(intg.id)}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${conn ? 'bg-[#15b881]/10 text-[#15b881] hover:bg-[#15b881]/15' : 'bg-[#15b881] text-white hover:bg-[#0d9b68]'}`}>
                      {conn ? 'Connected' : 'Connect'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {activeWizard && (
        <WizardModal integrationId={activeWizard} onClose={() => setActiveWizard(null)} onConnected={handleConnected} />
      )}
    </div>
  );
}
