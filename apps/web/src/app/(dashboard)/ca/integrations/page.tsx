'use client';
import { useState, useEffect } from 'react';

interface IntegrationCard {
  id: string; name: string; category: string; description: string; status: 'connected'|'disconnected';
  icon: string; provider: string; setupSteps: string[];
}
type ActiveModal = { card: IntegrationCard; step: number } | null;

export default function CAIntegrationsPage() {
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<IntegrationCard[]>([]);
  const [modal, setModal] = useState<ActiveModal>(null);

  useEffect(() => {
    setTimeout(() => {
      setCards([
        { id:'tally',name:'Tally',category:'Accounting',description:'Connect your Tally data. Pull trial balance, ledgers, vouchers for automatic reconciliation. Dominant accounting system used by 95% of Indian SMEs.',status:'disconnected',icon:'📊',provider:'Tally Solutions',
          setupSteps: ['What this does: Pulls trial balance, ledgers, and vouchers from your Tally instance so your CA team can reconcile accounts automatically.','What you need: Tally ERP 9 or TallyPrime installed on your computer. Export your data as XML from Tally → Upload to Counsel. v1 uses manual export (simple drag-and-drop).','Your Tally connection will be saved under your firm. No live access to your Tally data — you control when to export and upload.','Test Connection: Upload a sample Tally XML file to verify parsing.'] },
        { id:'gsp',name:'GSP (GST Filing)',category:'Government',description:'Fetch GSTR-2A/2B data, check filing status, prepare e-invoices. Choose your GSP provider: ClearTax, Masters India, or WhiteBooks.',status:'disconnected',icon:'🧾',provider:'ClearTax / Masters India / WhiteBooks',
          setupSteps: ['What this does: Fetches your GST return data (GSTR-2A, GSTR-1, GSTR-3B) from the GST portal through a licensed GSP partner. Your CA team can check filing status, reconcile input tax credit, and prepare returns.','What you need: (1) Your GSTIN, (2) Authorization on the GST portal to share data with your GSP, (3) GSP API credentials from your provider. Counsel works with ClearTax, Masters India, or WhiteBooks — you can switch anytime.','IMPORTANT: Counsel NEVER auto-files your returns. All data goes to your CA for review. Filing requires DSC + UDIN — always a human action.','Test Connection: Enter your GSP credentials to verify the API connection.'] },
        { id:'eri',name:'Income Tax ERI',category:'Government',description:'Fetch 26AS tax credit statements, AIS pre-fill data, TDS return status, notices — read-only via ERI API.',status:'disconnected',icon:'📄',provider:'Income Tax Department',
          setupSteps: ['What this does: Reads tax credit statements (26AS), Annual Information Statements (AIS), ITR filing status, and notices from the Income Tax portal. Read-only — helps your CA prepare ITR data and track notices.','What you need: ERI (e-Return Intermediary) registration with ITD. This is a formal process — application, technical evaluation, compliance check. Counsel guides you through it but it takes 4-6 weeks.','ERI registration is a program-level step (M19). You can use Counsel for everything else while ERI is pending.','Test Connection: ERI API requires ITD registration approval first. Status will show as "pending" until then.'] },
        { id:'mca',name:'MCA / ROC',category:'Government',description:'Company master data, CIN lookup, filing status, due-date tracking. Prepare forms — firm signs with DSC.',status:'disconnected',icon:'🏛️',provider:'MCA21 V3',
          setupSteps: ['What this does: Looks up company data from MCA21, checks filing history, tracks AOC-4/MGT-7/DIR-3 KYC deadlines, and prepares ROC form data.','What you need: (1) Your firm MCA21 login credentials, (2) CINs of client companies, (3) Your CA\'s DSC for signing.','IMPORTANT: Counsel prepares forms but NEVER files them. Your CA signs with DSC and files on MCA21 directly.','Test Connection: Verify a CIN lookup to confirm MCA connectivity.'] },
        { id:'udin',name:'UDIN (ICAI)',category:'Government',description:'Track which signed deliverables need UDIN. Get compliance alerts. UDIN generation stays manual at ICAI portal.',status:'disconnected',icon:'🔒',provider:'ICAI',
          setupSteps: ['What this does: Tracks which of your signed documents (audit reports, certificates, GST audits) still need UDIN. Alerts you before the 10-day deadline.','What you need: (1) ICAI membership number, (2) List of documents signed in the last 10 days.','UDIN generation itself is a manual ICAI-portal action — this tool just tracks what needs it.','Ready to use — no API keys needed. Just connect to start tracking.'] },
        { id:'whatsapp',name:'WhatsApp Business',category:'Communication',description:'Send compliance reminders, document requests, filing status updates to clients via WhatsApp.',status:'disconnected',icon:'💬',provider:'Meta (WhatsApp Business API)',
          setupSteps: ['What this does: Sends client-facing WhatsApp messages — compliance deadline reminders, document collection requests, filing status updates. Reaches clients on the app they already use.','What you need: (1) Facebook Business Manager account, (2) Phone number verified on WhatsApp Business API, (3) WhatsApp access token. Setup takes ~15 minutes at developers.facebook.com.','Your firm\'s WhatsApp number will show as the sender. Clients can reply — messages are tracked in Counsel.','Test Connection: Enter your WhatsApp credentials to send a test message.'] },
        { id:'zoho',name:'Zoho Books',category:'Accounting',description:'Pull chart of accounts, trial balance, transactions for non-Tally clients. Same reconciliation as Tally.',status:'disconnected',icon:'📚',provider:'Zoho',
          setupSteps: ['What this does: Pulls accounting data from Zoho Books — trial balance, ledger, invoices, transactions. Feeds into the same reconciliation pipeline as Tally.','What you need: (1) Zoho Books login, (2) Organization ID, (3) OAuth token from Zoho Developer Console.','Your Zoho Books data is read-only — Counsel never modifies your books.','Test Connection: Enter your Zoho credentials to pull a trial balance test.'] },
        { id:'quickbooks',name:'QuickBooks',category:'Accounting',description:'Pull data from QuickBooks Online for reconciliation and tax prep.',status:'disconnected',icon:'📗',provider:'Intuit',
          setupSteps: ['What this does: Pulls accounting data from QuickBooks Online — trial balance, transactions, invoices.','What you need: (1) QuickBooks Online login, (2) Realm ID, (3) OAuth token from Intuit Developer.','Read-only access — your QuickBooks data is safe.','Test Connection: Enter credentials to verify API access.'] },
      ]);
      setLoading(false);
    }, 700);
  }, []);

  const gov = cards.filter(c => c.category === 'Government');
  const acc = cards.filter(c => c.category === 'Accounting');
  const comm = cards.filter(c => c.category === 'Communication');

  const openModal = (card: IntegrationCard) => setModal({ card, step: 0 });
  const closeModal = () => setModal(null);
  const nextStep = () => setModal(m => m ? { ...m, step: m.step + 1 } : null);
  const prevStep = () => setModal(m => m ? { ...m, step: Math.max(0, m.step - 1) } : null);

  if (loading) return <div className="p-6"><div className="h-8 w-48 skeleton-bg rounded animate-pulse mb-4" /><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[...Array(6)].map((_,i)=><div key={i} className="h-40 skeleton-bg rounded-lg animate-pulse"/>)}</div></div>;

  const renderSection = (title: string, sectionCards: IntegrationCard[]) => (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sectionCards.map(card => (
          <div key={card.id} className="bg-white rounded-lg border shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <span className="text-2xl">{card.icon}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${card.status === 'connected' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {card.status === 'connected' ? '✓ Connected' : 'Not Connected'}
              </span>
            </div>
            <h3 className="font-semibold text-gray-900">{card.name}</h3>
            <p className="text-sm text-gray-500 flex-1">{card.description}</p>
            <p className="text-xs text-gray-400">Provider: {card.provider}</p>
            <button onClick={() => openModal(card)}
              className={`mt-auto w-full text-sm py-1.5 rounded-lg font-medium transition-colors ${card.status === 'connected' ? 'border border-green-300 text-green-700 hover:bg-green-50' : 'bg-green-700 text-white hover:bg-green-800'}`}>
              {card.status === 'connected' ? 'Manage' : 'Connect'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">Integrations</h1><p className="text-gray-500 text-sm mt-1">Connect your tools — no technical expertise needed. Each integration has a simple step-by-step setup wizard.</p></div>

      {renderSection('Government & Regulatory', gov)}
      {renderSection('Accounting Software', acc)}
      {renderSection('Client Communication', comm)}

      {/* Modal / Step Wizard */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={closeModal}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{modal.card.icon}</span>
                <div><h3 className="text-xl font-bold text-gray-900">Connect {modal.card.name}</h3><p className="text-sm text-gray-500">{modal.card.provider}</p></div>
              </div>

              {/* Step indicator */}
              <div className="flex gap-1">{[1,2,3,4].map((_,i)=><div key={i} className={`flex-1 h-1 rounded ${i <= modal.step ? 'bg-green-600' : 'bg-gray-200'}`}/>)}</div>

              {/* Step content */}
              <div className="bg-gray-50 rounded-lg p-4 min-h-[120px]">
                <p className="text-sm font-medium text-gray-500 mb-2">Step {modal.step + 1} of 4</p>
                <p className="text-gray-700 whitespace-pre-line">{modal.card.setupSteps[modal.step]}</p>
              </div>

              {/* Actions */}
              <div className="flex justify-between">
                <div>
                  {modal.step > 0 && <button onClick={prevStep} className="text-sm text-gray-500 hover:text-gray-700">&larr; Back</button>}
                </div>
                <div className="flex gap-2">
                  {modal.step < 3 && <button onClick={nextStep} className="px-4 py-2 bg-green-700 text-white text-sm rounded-lg hover:bg-green-800">Next Step</button>}
                  {modal.step === 3 && (
                    <button onClick={() => { const updated = cards.map(c => c.id === modal.card.id ? { ...c, status: 'connected' as const } : c); setCards(updated); closeModal(); }}
                      className="px-4 py-2 bg-green-700 text-white text-sm rounded-lg hover:bg-green-800 font-medium">✓ Connect {modal.card.name}</button>
                  )}
                </div>
              </div>

              {/* Skip / Close */}
              <button onClick={closeModal} className="w-full text-sm text-gray-400 hover:text-gray-600">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
