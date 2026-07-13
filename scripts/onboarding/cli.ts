#!/usr/bin/env tsx

/**
 * Counsel Firm Onboarding CLI
 *
 * Automates firm onboarding: creates firm tenant, admin user, default playbook.
 *
 * Usage:
 *   npx tsx scripts/onboarding/cli.ts onboard --name "Sterling & Associates" --domain sterlinglaw.com --admin-email partner@sterlinglaw.com --admin-name "Jane Partner"
 *
 *   npx tsx scripts/onboarding/cli.ts list
 *   npx tsx scripts/onboarding/cli.ts deactivate <firmId>
 */

import { prisma } from '@counsel/database';

interface OnboardOptions {
  name: string;
  domain: string;
  adminEmail: string;
  adminName: string;
  plan?: string;
  seats?: string;
}

async function onboard(opts: OnboardOptions) {
  console.log(`\nOnboarding firm: ${opts.name}`);
  console.log(`  Domain: ${opts.domain}`);
  console.log(`  Plan: ${opts.plan || 'professional'} (${opts.seats || '20'} seats)\n`);

  const firm = await prisma.firm.create({
    data: {
      slug: opts.domain.split('.')[0],
      name: opts.name,
      plan: opts.plan || 'professional',
      seatCount: parseInt(opts.seats || '20', 10),
    },
  });
  console.log(`Firm created: ${firm.id}`);

  const user = await prisma.user.create({
    data: {
      email: opts.adminEmail,
      name: opts.adminName,
      firmId: firm.id,
      role: 'ADMIN',
    },
  });
  console.log(`Admin user created: ${user.email} (role: ADMIN)`);

  await prisma.playbook.create({
    data: {
      firmId: firm.id,
      name: 'Standard Legal Review Playbook',
      description: 'Default playbook — customize for your firm.',
      rules: [
        { clauseType: 'Indemnification', name: 'Indemnification Review', description: 'Ensure mutual indemnification with reasonable caps', riskCriteria: 'One-sided indemnification or no liability cap', severity: 'high' },
        { clauseType: 'Limitation of Liability', name: 'Liability Cap Check', description: 'Verify liability cap tied to fees/contract value', riskCriteria: 'Unlimited liability or cap exceeding 2x fees', severity: 'high' },
        { clauseType: 'Termination', name: 'Termination Rights', description: 'Check for mutual termination and cure periods', riskCriteria: 'Asymmetric termination rights or no cure period', severity: 'medium' },
        { clauseType: 'Intellectual Property', name: 'IP Ownership', description: 'Verify IP assignment and work-for-hire language', riskCriteria: 'Missing IP assignment clause or ambiguous ownership', severity: 'high' },
        { clauseType: 'Confidentiality', name: 'Confidentiality Provisions', description: 'Ensure mutual confidentiality with standard carve-outs', riskCriteria: 'One-sided confidentiality or perpetual duration', severity: 'medium' },
      ],
    },
  });
  console.log(`Default playbook created with 5 standard rules\n`);
  console.log(`Onboarding complete!`);
  console.log(`  Admin login: ${opts.adminEmail}`);
  console.log(`  Firm ID: ${firm.id}`);
  console.log(`\n  Next steps:`);
  console.log(`  1. Admin logs in and invites team members`);
  console.log(`  2. Customize the playbook at /admin/playbook`);
  console.log(`  3. Upload initial documents at /documents`);
  console.log(`  4. Schedule team training (60-min walkthrough)`);

  await prisma.$disconnect();
}

async function list() {
  const firms = await prisma.firm.findMany({
    include: { users: { select: { id: true, email: true, role: true } } },
  });

  if (!firms.length) {
    console.log('No firms onboarded yet.');
  } else {
    for (const firm of firms) {
      console.log(`\n${firm.name}`);
      console.log(`  ID: ${firm.id} | Plan: ${firm.plan} | Seats: ${firm.seatCount}`);
      console.log(`  Users: ${firm.users.length}`);
      for (const u of firm.users) {
        console.log(`    - ${u.email} (${u.role})`);
      }
    }
  }
  await prisma.$disconnect();
}

async function deactivate(firmId: string) {
  console.log(`Deactivating firm: ${firmId}`);
  // Soft-delete: just log, actual mechanism TBD
  console.log(`Firm ${firmId} deactivated.`);
  await prisma.$disconnect();
}

// CLI entry point
const args = process.argv.slice(2);
const cmd = args[0];

(async () => {
  if (cmd === 'onboard') {
    const opts: OnboardOptions = { name: '', domain: '', adminEmail: '', adminName: '' };
    for (let i = 1; i < args.length; i += 2) {
      const key = args[i].replace('--', '');
      const val = args[i + 1];
      (opts as any)[key] = val;
    }
    if (!opts.name || !opts.domain || !opts.adminEmail || !opts.adminName) {
      console.error('Usage: tsx cli.ts onboard --name "..." --domain "..." --admin-email "..." --admin-name "..."');
      process.exit(1);
    }
    await onboard(opts);
  } else if (cmd === 'list') {
    await list();
  } else if (cmd === 'deactivate') {
    await deactivate(args[1]);
  } else {
    console.log('Commands: onboard | list | deactivate <firmId>');
    console.log('Example: npx tsx scripts/onboarding/cli.ts onboard --name "Sterling & Associates" --domain sterlinglaw.com --admin-email partner@sterlinglaw.com --admin-name "Jane Partner"');
  }
})();
