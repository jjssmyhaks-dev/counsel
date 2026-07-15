'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { Draft, Matter } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { ErrorState } from '@/components/ui/error-state';
import { Spinner } from '@/components/ui/spinner';

const SAMPLE_GENERATED_CONTENT: Record<Draft['type'], string> = {
  email: `Subject: Update on Brighton Commercial Lease Dispute – Force Majeure Analysis

Dear James,

I hope this email finds you well. I wanted to provide a brief update on our analysis of the force majeure clause in your lease agreement with Regent Properties LLC.

Summary of Findings

We have completed our review of Section 12 (Force Majeure) of the Lease Agreement dated March 15, 2024. Our analysis identifies two key issues:

1. Ambiguous Language on Rent Obligations
   The current force majeure clause does not explicitly address whether rent obligations continue during periods when the premises are rendered untenantable. New York courts have recently required explicit language for rent abatement. The leading case, 159 MP Corp. v. Redbridge Bedford (2025), held that generalized force majeure language is insufficient to relieve a tenant of rent obligations.

2. Notice Requirements
   The clause requires only 48 hours notice of a force majeure event, which may be impractical in situations like natural disasters or government-mandated closures.

Recommended Next Steps

We propose the following negotiation strategy:

• Request an amendment that explicitly states rent shall abate during any period the premises are untenantable due to a force majeure event continuing for more than 7 consecutive days.
• Extend the notice period to 14 days where reasonably possible.
• Add language covering business interruption and access restrictions specific to government mandates.

I am available to discuss this at your convenience. We have a strategy call scheduled for tomorrow at 3:00 PM.

Best regards,
Sarah Chen
Sterling & Associates LLP`,
  memo: `MEMORANDUM

TO: File
FROM: Sarah Chen, Partner
DATE: July 13, 2026
RE: Patent Invalidity Analysis – Evergreen Technologies IP Defense

I. EXECUTIVE SUMMARY

This memorandum summarizes our preliminary analysis of the five patents currently asserted against Evergreen Technologies in the matter Evergreen IP Portfolio Defense (Case No. 25-cv-08421). We have identified substantial prior art that raises significant questions regarding the validity of Patents #3, #4, and #5.

II. BACKGROUND

Evergreen Technologies, a semiconductor manufacturer, is defending against patent infringement claims brought by Titan Semiconductor Group. Titan asserts five U.S. patents related to chip fabrication processes:

1. U.S. Patent No. 9,876,543 ("Method for Substrate Layering")
2. U.S. Patent No. 10,234,567 ("Thermal Management in Semiconductor Fabrication")
3. U.S. Patent No. 10,456,789 ("Plasma Etching Process Improvement")
4. U.S. Patent No. 11,123,456 ("Dielectric Material Application")
5. U.S. Patent No. 11,789,012 ("Semiconductor Junction Optimization")

III. PRIOR ART ANALYSIS

Patent #3 (Plasma Etching Process Improvement)
We have identified three prior art references that appear to anticipate or render obvious the asserted claims:
• Krueger et al., "Advanced Plasma Etching Techniques," IEEE Transactions on Semiconductor Manufacturing (2018)
• Japanese Patent Application JP-2017-089234 (published 2019)
• The Defense Advanced Research Projects Agency (DARPA) Technical Report TR-2019-045

Patent #4 (Dielectric Material Application)
This patent is potentially invalid under 35 U.S.C. § 103 based on the combination of:
• The Chen reference (U.S. Patent No. 9,012,345)
• Industry-standard practices documented in the SEMI International Technology Roadmap

Patent #5 (Semiconductor Junction Optimization)
Our analysis indicates that the claims in Patent #5 may be broader than the enabling disclosure, raising § 112 issues. Additionally, a 2024 publication by the MIT Microsystems Technology Lab describes substantially similar technology.

IV. RECOMMENDATIONS

1. File inter partes review (IPR) petitions for Patents #3, #4, and #5
2. Meet with Dr. Robert Kim to finalize expert declaration
3. Prepare Markman briefing on claim construction for Patents #1 and #2
4. Consider early summary judgment motion on invalidity for Patent #5`,
  report: `STERLING & ASSOCIATES LLP
CONFIDENTIAL – ATTORNEY WORK PRODUCT

GDPR COMPLIANCE ASSESSMENT REPORT
NovaTech Solutions – Data Privacy Audit
July 13, 2026

1. EXECUTIVE SUMMARY

This report presents our comprehensive assessment of NovaTech Solutions' compliance with the General Data Protection Regulation (GDPR) for their SaaS platform. We identified 23 compliance gaps across 8 categories. Of these, 5 are classified as high-severity and require immediate remediation.

2. ASSESSMENT METHODOLOGY

Our review was conducted over a four-week period (June 15 – July 12, 2026) and included:
• Review of NovaTech's Data Processing Agreement (DPA)
• Analysis of data flows across 12 subprocessor relationships
• Audit of consent management mechanisms
• Assessment of data subject access request (DSAR) procedures
• Review of data breach notification protocols

3. KEY FINDINGS

3.1 Subprocessor Management (HIGH RISK)
NovaTech currently engages 12 subprocessors for its SaaS platform. The existing DPA does not require prior notification before engaging new subprocessors, and there is no mechanism for customers to object to subprocessor changes. This violates Article 28(2) of the GDPR.

3.2 Data Retention (HIGH RISK)
The platform currently retains user data for an indefinite period with no automated deletion mechanisms. Under the GDPR's storage limitation principle (Article 5(1)(e)), data must be kept no longer than necessary. We identified customer data dating back to 2018 that should have been purged.

3.3 Cross-Border Data Transfers (HIGH RISK)
NovaTech transfers data to subprocessors in five non-EEA countries. The current Standard Contractual Clauses (SCCs) reference the pre-2021 version and have not been updated to include the required Transfer Impact Assessments (TIAs) mandated by the Schrems II decision.

3.4 Consent Management (MEDIUM RISK)
The consent collection mechanism on NovaTech's platform uses pre-ticked boxes for marketing communications, which does not constitute valid consent under the GDPR. Consent must be a freely given, specific, informed, and unambiguous indication.

4. REMEDIATION ROADMAP

Priority 1 (30 days):
• Update DPA with subprocessor notification and objection provisions
• Implement automated data retention and deletion policies
• Remediate consent collection mechanisms

Priority 2 (60 days):
• Update SCCs and complete TIAs for all cross-border transfers
• Implement comprehensive DSAR workflow
• Conduct data protection impact assessment (DPIA)

Priority 3 (90 days):
• Deploy automated privacy notice generator
• Implement privacy-by-design review process
• Conduct staff training on GDPR compliance

5. CONCLUSION

NovaTech Solutions faces material GDPR compliance risk if the identified gaps are not addressed promptly. We recommend immediate action on the Priority 1 items, which carry the highest regulatory risk and potential for fines up to €20 million or 4% of annual global turnover.

This report is prepared for internal client use and is protected by attorney-client privilege.`,
  brief: `IN THE COURT OF CHANCERY OF THE STATE OF DELAWARE

IN RE QUANTUM DYNAMICS INC. SHAREHOLDER LITIGATION

Consolidated C.A. No. 2026-0451-KSJM

[PROPOSED]
BRIEF IN SUPPORT OF DEFENDANTS' MOTION TO DISMISS

TABLE OF CONTENTS
I. PRELIMINARY STATEMENT
II. BACKGROUND
III. LEGAL STANDARD
IV. ARGUMENT
V. CONCLUSION

I. PRELIMINARY STATEMENT

This action represents an attempt by plaintiff shareholders to derail a fully-disclosed, arms-length merger transaction that was approved by a fully informed board of directors and recommended by independent financial advisors. Plaintiffs' claims for breach of fiduciary duty fail as a matter of law because they have not pleaded facts sufficient to overcome the business judgment rule or establish that a majority of the board was interested or lacked independence.

II. BACKGROUND

Quantum Dynamics Inc. ("Quantum" or the "Company") is a Delaware corporation engaged in the development of quantum computing hardware and software...

[Content continues. This draft is in progress.]`,
  letter: `STERLING & ASSOCIATES LLP
350 Madison Avenue
New York, NY 10017

July 13, 2026

VIA EMAIL AND CERTIFIED MAIL

Omega Capital Partners LLC
Attn: General Counsel
200 Park Avenue, Suite 4500
New York, NY 10166

Re: Quantum Dynamics Merger Agreement – Indemnification Provisions

Dear Counsel:

We represent Quantum Dynamics Inc. ("Quantum") in connection with the Agreement and Plan of Merger dated June 1, 2026 (the "Merger Agreement") between Quantum and Omega Capital Partners LLC ("Omega").

This letter addresses certain provisions in the Merger Agreement that, in our client's view, require revision before closing can occur. Specifically, we focus on:

1. Indemnification Scope and Limitations (Section 7.3)

The current indemnification provision contains no liability cap, no survival period, and no materiality qualifiers. This is inconsistent with market practice for transactions of this size and nature. Our client requests:

a. A liability cap of 15% of the aggregate purchase price;
b. A 12-month survival period for general representations and warranties;
c. A materiality qualifier for non-fundamental representations;
d. A basket threshold of 1% of purchase price before indemnification obligations arise.

2. Change of Control Definition (Section 12.1)

The current 15% beneficial ownership threshold for triggering change-of-control provisions is well below market standard. Our client requests revision to a 50% threshold consistent with prevailing market practice, or alternatively, a definition based on majority board composition changes.

3. Non-Compete Covenant (Section 15.4)

The five-year non-compete period exceeds what is reasonable and likely enforceable. We propose a three-year term with geographic and scope limitations tied to the Company's existing markets.

We are available to discuss these items at your earliest convenience. Our client is prepared to move expeditiously toward closing once these open points are resolved.

Please direct all correspondence regarding this matter to the undersigned.

Very truly yours,

STERLING & ASSOCIATES LLP

By: ________________________
Sarah Chen, Partner`,
};

export default function DraftEditorPage() {
  const params = useParams();
  const router = useRouter();
  const draftId = params.id as string;
  const isNew = draftId === 'new';

  const [draft, setDraft] = useState<Draft | null>(null);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [type, setType] = useState<Draft['type']>('memo');
  const [matterId, setMatterId] = useState('');
  const [instructions, setInstructions] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<Draft['status']>('draft');

  useEffect(() => { loadData(); }, [draftId]);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const mattersResp = await api.get<{ data: Matter[] }>('/matters');
      setMatters(mattersResp.data);

      if (!isNew) {
        const d = await api.get<Draft>(`/drafts/${draftId}`);
        setDraft(d);
        setTitle(d.title);
        setType(d.type);
        setMatterId(d.matterId);
        setInstructions(d.instructions);
        setContent(d.content);
        setStatus(d.status);
      }
    } catch {
      setError('Failed to load draft.');
    } finally {
      setLoading(false);
    }
  }

  function handleGenerate() {
    setGenerating(true);
    // Simulate AI generation delay
    setTimeout(() => {
      const generatedContent =
        SAMPLE_GENERATED_CONTENT[type] ||
        'Generated content will appear here based on your instructions.';
      setContent(generatedContent);
      setGenerating(false);
    }, 1500);
  }

  function handleSave() {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setStatus('draft');
    }, 600);
  }

  function handleFinalize() {
    if (!content.trim()) return;
    setStatus('finalized');
  }

  async function handleCopy() {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = content;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" label="Loading draft..." />
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadData} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="page-header !mb-0">
          <h1>{isNew ? 'New Draft' : draft?.title || 'Draft Editor'}</h1>
          <p>{isNew ? 'Create an AI-assisted legal draft' : `${status.charAt(0).toUpperCase() + status.slice(1)} · ${type.charAt(0).toUpperCase() + type.slice(1)}`}</p>
        </div>
        <Button variant="secondary" onClick={() => router.push('/drafts')}>
          ← Back to Drafts
        </Button>
      </div>

      {/* Editor Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., Client Update on Merger Agreement"
          />
        </div>

        {/* Type selector */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Type</label>
          <div className="flex gap-2 flex-wrap">
            {(['email', 'memo', 'report', 'brief', 'letter'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  type === t
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Matter selector */}
        {matters.length > 0 && (
          <Select
            label="Matter"
            options={[
              { value: '', label: 'Select a matter (optional for new drafts)...' },
              ...matters.map((m) => ({ value: m.id, label: `${m.name} (${m.clientName})` })),
            ]}
            value={matterId}
            onChange={(e) => setMatterId(e.target.value)}
          />
        )}

        {/* Instructions */}
        <Textarea
          label="Instructions"
          placeholder="What should this draft cover? Include key points, tone, and any specific requirements..."
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={3}
        />

        {/* Generate button */}
        <div className="flex gap-3">
          <Button onClick={handleGenerate} loading={generating}>
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
            {generating ? 'Generating...' : 'Generate Draft'}
          </Button>
        </div>

        {/* Generated Content */}
        {content && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">
                {status === 'finalized' ? 'Finalized Content' : 'Draft Content'}
              </h3>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={handleCopy}>
                  {copied ? (
                    <span className="text-green-600 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Copied
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy
                    </span>
                  )}
                </Button>
                <Button size="sm" variant="ghost" onClick={handleGenerate} loading={generating}>
                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Regenerate
                </Button>
              </div>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="block w-full rounded-lg border border-amber-300 bg-amber-50/60 px-4 py-4 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 min-h-[400px] resize-y"
              style={{ whiteSpace: 'pre-wrap' }}
            />
          </div>
        )}

        {/* No content yet */}
        {!content && !generating && (
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-12 text-center">
            <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            <p className="text-sm text-slate-500 mb-1">No content generated yet</p>
            <p className="text-xs text-slate-400">Click &quot;Generate Draft&quot; to create AI-assisted content based on your instructions</p>
          </div>
        )}

        {/* Generating state */}
        {generating && !content && (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" label="AI is drafting your content..." />
          </div>
        )}

        {/* Action buttons */}
        {content && (
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <Button onClick={handleSave} loading={saving} variant="secondary">
              {saving ? 'Saving...' : 'Save Draft'}
            </Button>
            <Button onClick={handleFinalize} disabled={status === 'finalized'}>
              {status === 'finalized' ? (
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Finalized
                </span>
              ) : (
                'Finalize'
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-3">
        <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <p className="text-sm text-amber-800">
          <strong>AI-generated draft</strong> — review before sending or filing. The content above was generated by AI and should be carefully reviewed for accuracy, completeness, and compliance with applicable professional standards.
        </p>
      </div>
    </div>
  );
}
