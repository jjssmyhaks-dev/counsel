import { Resend } from 'resend';

let _resend: Resend | null = null;
let _resendAvailable = false;

export function initResend() {
  const apiKey = process.env.RESEND_API_KEY || '';
  if (!apiKey || apiKey.startsWith('re_') === false || apiKey.length < 20) {
    console.warn('Resend: No valid API key found. Email features disabled.');
    _resendAvailable = false;
    return;
  }
  _resend = new Resend(apiKey);
  _resendAvailable = true;
  console.log('Resend: Email service initialized');
}

export function isResendAvailable(): boolean {
  return _resendAvailable;
}

export async function sendEmail(params: {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
}) {
  if (!_resend || !_resendAvailable) {
    console.log(`[Email Mock] To: ${params.to} | Subject: ${params.subject}`);
    return { id: 'mock-email-id', mock: true };
  }

  try {
    const result = await _resend.emails.send({
      from: params.from || 'Counsel AI Suite <noreply@counsel.ai>',
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    return result;
  } catch (err) {
    console.error('Resend send failed:', (err as Error).message);
    // Fall back to mock so the app doesn't break
    console.log(`[Email Mock] To: ${params.to} | Subject: ${params.subject}`);
    return { id: 'mock-email-id', mock: true, error: (err as Error).message };
  }
}

// Pre-built templates
export function welcomeEmail(name: string, loginUrl: string) {
  return {
    subject: 'Welcome to Counsel AI Suite',
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;padding:24px;">
      <h1 style="color:#1a1a2e;">Welcome, ${name}!</h1>
      <p>Your Counsel AI Suite account is ready. Get started with AI-powered legal document drafting, research, and knowledge management.</p>
      <a href="${loginUrl}" style="display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;margin:16px 0;">Go to Dashboard</a>
      <p style="color:#666;font-size:12px;">If you didn't create this account, please ignore this email.</p>
    </div>`,
  };
}

export function matterCreatedEmail(matterName: string, matterUrl: string) {
  return {
    subject: `New Matter: ${matterName}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;padding:24px;">
      <h2>📋 New Matter Created</h2>
      <p><strong>${matterName}</strong> has been added to your case management system.</p>
      <a href="${matterUrl}" style="display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;">View Matter</a>
    </div>`,
  };
}

export function documentSharedEmail(sharerName: string, docName: string, docUrl: string) {
  return {
    subject: `${sharerName} shared "${docName}" with you`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;padding:24px;">
      <h2>📄 Document Shared</h2>
      <p><strong>${sharerName}</strong> shared a document with you.</p>
      <p style="font-size:18px;color:#1a1a2e;padding:12px;background:#f0f0ff;border-radius:6px;">${docName}</p>
      <a href="${docUrl}" style="display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;">Open Document</a>
    </div>`,
  };
}
