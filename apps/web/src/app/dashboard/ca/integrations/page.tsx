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
        { id:'tally',name:'Tally',category:'Accounting',description:'Connect your Tally data. Pull trial balance, ledgers, vouchers for automatic reconciliation.',status:'disconnected',icon:'📊',provider:'Tally Solutions',
          setupSteps: ['Step 1: Export your Tally data as XML. Go to Tally → Export → XML format.','Step 2: Upload the XML file here. Counsel parses trial balance, ledgers, and vouchers automatically.','Step 3: Map your Tally accounts to the chart of accounts. Counsel suggests mappings — you confirm.','Your Tally data is now connected. Upload new exports anytime for reconciliation.'] },
        { id:'gsp',name:'GSP (GST Filing)',category:'Government',description:'Fetch GSTR-2A/2B data, check filing status. Works with ClearTax, Masters India, or WhiteBooks.',status:'disconnected',icon:'🧾',provider:'ClearTax / Masters India / WhiteBooks',
          setupSteps: ['Step 1: Select your GSP provider (ClearTax, Masters India, or WhiteBooks).','Step 2: Enter your GSTIN and GSP API credentials.','Step 3: Authorize data sharing on the GST portal.','Ready. Your GSTR data will sync for reconciliation and filing prep.'] },
        { id:'eri',name:'Income Tax ERI',category:'Government',description:'Fetch 26AS tax credit statements, AIS pre-fill data, TDS return status — read-only via ERI API.',status:'disconnected',icon:'📄',provider:'Income Tax Department',
          setupSteps: ['Step 1: Register as an ERI (e-Return Intermediary) with ITD. Takes 4-6 weeks.','Step 2: Submit your ERI credentials to Counsel.','Step 3: Counsel fetches 26AS, AIS, and filing status for your clients.','All data is read-only — Counsel never files returns directly.'] },
        { id:'mca',name:'MCA / ROC',category:'Government',description:'Company master data, CIN lookup, filing status, due-date tracking. Firm signs with DSC.',status:'disconnected',icon:'🏛️',provider:'MCA21 V3',
          setupSteps: ['Step 1: Enter your MCA21 login credentials.','Step 2: Add client CINs. Counsel tracks their filing deadlines.','Step 3: Counsel prepares forms (AOC-4, MGT-7, DIR-3 KYC).','Your CA signs with DSC on MCA21 — Counsel never auto-files.'] },
        { id:'udin',name:'UDIN (ICAI)',category:'Government',description:'Track which signed deliverables need UDIN. Get compliance alerts before the 10-day deadline.',status:'disconnected',icon:'🔒',provider:'ICAI',
          setupSteps: ['Step 1: Enter your ICAI membership number.','Step 2: Log which documents you sign each day.','Step 3: Counsel alerts you before the 15-day UDIN deadline.','UDIN generation happens on the ICAI portal — Counsel just tracks what needs it.'] },
        { id:'whatsapp',name:'WhatsApp Business',category:'Communication',description:'Send compliance reminders, document requests, and filing updates to clients via WhatsApp.',status:'disconnected',icon:'💬',provider:'Meta (WhatsApp Business API)',
          setupSteps: ['Step 1: Set up a Facebook Business Manager account.','Step 2: Verify your phone number on WhatsApp Business API.','Step 3: Enter your WhatsApp access token in Counsel.','Done. Send reminders and updates to clients on WhatsApp.'] },
        { id:'zoho',name:'Zoho Books',category:'Accounting',description:'Pull chart of accounts, trial balance, transactions for non-Tally clients.',status:'disconnected',icon:'📚',provider:'Zoho',
          setupSteps: ['Step 1: Get your Zoho Organization ID and OAuth token from Zoho Developer Console.','Step 2: Enter credentials in Counsel.','Step 3: Select which organizations to sync.','Read-only sync complete — Counsel never modifies your books.'] },
        { id:'quickbooks',name:'QuickBooks',category:'Accounting',description:'Pull data from QuickBooks Online for reconciliation and tax prep.',status:'disconnected',icon:'📗',provider:'Intuit',
          setupSteps: ['Step 1: Get your Realm ID and OAuth token from Intuit Developer.','Step 2: Enter credentials in Counsel.','Step 3: Authorize the connection in QuickBooks.','Read-only sync complete. Ready for reconciliation.'] },
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

  if (loading) return <div className="p-6"><div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-4" /><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[...Array(6)].map((_,i)=><div key={i} className="h-40 bg-gray-200 rounded-lg animate-pulse"/>)}</div></div>;

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
      <div><h1 className="text-2xl font-bold text-gray-900">Integrations</h1><p className="text-gray-500 text-sm mt-1">Connect your tools — step-by-step wizards for every integration your CA practice needs.</p></div>

      {renderSection('Government & Regulatory', gov)}
      {renderSection('Accounting Software', acc)}
      {renderSection('Client Communication', comm)}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={closeModal}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{modal.card.icon}</span>
                <div><h3 className="text-xl font-bold text-gray-900">Connect {modal.card.name}</h3><p className="text-sm text-gray-500">{modal.card.provider}</p></div>
              </div>

              <div className="flex gap-1">{[1,2,3,4].map((_,i)=><div key={i} className={`flex-1 h-1 rounded ${i <= modal.step ? 'bg-green-600' : 'bg-gray-200'}`}/>)}</div>

              <div className="bg-gray-50 rounded-lg p-4 min-h-[120px]">
                <p className="text-sm font-medium text-gray-500 mb-2">Step {modal.step + 1} of 4</p>
                <p className="text-gray-700 whitespace-pre-line">{modal.card.setupSteps[modal.step]}</p>
              </div>

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

              <button onClick={closeModal} className="w-full text-sm text-gray-400 hover:text-gray-600">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
