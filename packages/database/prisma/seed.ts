import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['info', 'warn', 'error'],
});

async function main() {
  console.log('🌱 Seeding Counsel database...');

  // ── 1. Create Demo Firm ─────────────────────────────────────────────────
  const firm = await prisma.firm.upsert({
    where: { slug: 'demo-firm' },
    update: {},
    create: {
      name: 'Sterling & Associates',
      slug: 'demo-firm',
      plan: 'pro',
      seatCount: 10,
    },
  });
  console.log(`  ✅ Firm: ${firm.name} (${firm.id})`);

  // ── 2. Create Admin User ────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: 'admin@sterling.law' },
    update: {},
    create: {
      firmId: firm.id,
      email: 'admin@sterling.law',
      name: 'James Sterling',
      role: 'ADMIN',
      avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=JS',
    },
  });
  console.log(`  ✅ Admin: ${admin.name} (${admin.email})`);

  const associate = await prisma.user.upsert({
    where: { email: 'emma@sterling.law' },
    update: {},
    create: {
      firmId: firm.id,
      email: 'emma@sterling.law',
      name: 'Emma Park',
      role: 'ASSOCIATE',
      avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=EP',
    },
  });
  console.log(`  ✅ User: ${associate.name} (${associate.email})`);

  const partner = await prisma.user.upsert({
    where: { email: 'robert@sterling.law' },
    update: {},
    create: {
      firmId: firm.id,
      email: 'robert@sterling.law',
      name: 'Robert Chen',
      role: 'PARTNER',
      avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=RC',
    },
  });
  console.log(`  ✅ User: ${partner.name} (${partner.email})`);

  // ── 3. Create Matters ────────────────────────────────────────────────────
  const merger = await prisma.matter.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      firmId: firm.id,
      name: 'NovaTech / Helios Merger',
      description:
        'Cross-border merger between NovaTech Inc. and Helios Ltd. — due diligence and regulatory filings.',
      type: 'LEGAL',
      status: 'ACTIVE',
      clientName: 'NovaTech Inc.',
      createdById: admin.id,
    },
  });
  console.log(`  ✅ Matter: ${merger.name}`);

  const consulting = await prisma.matter.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      firmId: firm.id,
      name: 'Greenfield ESG Advisory',
      description:
        'Advisory engagement to build ESG compliance framework and board-ready sustainability reporting.',
      type: 'CONSULTING',
      status: 'ACTIVE',
      clientName: 'Greenfield Capital',
      createdById: partner.id,
    },
  });
  console.log(`  ✅ Matter: ${consulting.name}`);

  const litigation = await prisma.matter.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      firmId: firm.id,
      name: 'Peterson v. Arcadian Corp',
      description:
        'Class-action product liability — discovery phase, document review, and motion practice.',
      type: 'LEGAL',
      status: 'ACTIVE',
      clientName: 'Peterson Class Representatives',
      createdById: admin.id,
    },
  });
  console.log(`  ✅ Matter: ${litigation.name}`);

  // ── 4. Seed Playbook ────────────────────────────────────────────────────
  const playbook = await prisma.playbook.upsert({
    where: { id: '00000000-0000-0000-0000-000000000010' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000010',
      firmId: firm.id,
      name: 'Standard M&A Contract Playbook',
      description:
        'Fallback positions for common M&A contract clauses used across engagements.',
      rules: [
        {
          clause: 'Indemnification',
          order: 1,
          preferred:
            'Indemnification for third-party claims arising from breach of representations, with a basket of 0.5% of purchase price and a cap at the escrow amount.',
          fallback:
            'May accept a basket of 1.0% and a cap of 25% of purchase price. Carve-outs for fundamental reps capped at purchase price.',
          nonNegotiable:
            'Fraud claims uncapped. Seller must indemnify for pre-closing tax liabilities.',
        },
        {
          clause: 'Liability Cap',
          order: 2,
          preferred:
            'Aggregate liability cap at 1x fees paid over the preceding 12 months. Excludes death, personal injury, fraud, and IP infringement.',
          fallback:
            'May accept 2x fees. Super-cap of 3x fees for data breach claims only.',
          nonNegotiable:
            'No liability cap for willful misconduct, gross negligence, or breach of confidentiality.',
        },
        {
          clause: 'Termination',
          order: 3,
          preferred:
            'Either party may terminate on 60 days written notice without cause. Immediate termination for material breach uncured after 30 days.',
          fallback:
            'May accept 90-day notice period. Cure period extendable to 45 days.',
          nonNegotiable:
            'Immediate termination rights for insolvency events and change of control without consent.',
        },
        {
          clause: 'IP Assignment',
          order: 4,
          preferred:
            'All work product created during engagement is work-made-for-hire. Full assignment of rights upon payment in full.',
          fallback:
            'May accept a broad exclusive, perpetual, irrevocable, royalty-free worldwide license with right to sublicense.',
          nonNegotiable:
            'Firm retains ownership of pre-existing materials and general know-how. Open-source components governed by their respective licenses.',
        },
        {
          clause: 'Confidentiality',
          order: 5,
          preferred:
            'Mutual NDA with 5-year term post-engagement. Covers all non-public information marked as confidential.',
          fallback:
            'May accept 3-year term. Oral disclosures must be confirmed in writing within 30 days.',
          nonNegotiable:
            'Exceptions for information already public, independently developed, or required by law/regulatory order.',
        },
        {
          clause: 'Governing Law',
          order: 6,
          preferred:
            'Delaware law, exclusive jurisdiction in Delaware state/federal courts.',
          fallback:
            'May accept New York law if counterparty insists. Arbitration in NYC under AAA rules as compromise.',
          nonNegotiable:
            'No foreign governing law for domestic engagements. Following the ABA Model Rules of Professional Conduct.',
        },
        {
          clause: 'Non-Solicitation',
          order: 7,
          preferred:
            'Mutual non-solicitation of employees for 12 months post-engagement.',
          fallback:
            'May accept 6-month term or employee-only (no contractor coverage). General solicitation/public job postings excluded.',
          nonNegotiable:
            'No non-compete restrictions on firm personnel. Must carve out employees who initiate contact independently.',
        },
        {
          clause: 'Data Protection',
          order: 8,
          preferred:
            'DPA compliant with GDPR and CCPA. Sub-processors list attached as schedule. Breach notification within 48 hours.',
          fallback:
            'May accept 72-hour breach notification window. Pre-approved sub-processor additions with 14-day notice.',
          nonNegotiable:
            'Data processing only on documented instructions. No onward transfers without adequate protections. Assist with DSARs.',
        },
      ],
    },
  });
  console.log(
    `  ✅ Playbook: ${playbook.name} (${(playbook.rules as unknown[]).length} rules)`,
  );

  // ── 5. Sample Audit Log Entries ─────────────────────────────────────────
  await prisma.auditLog.createMany({
    data: [
      {
        firmId: firm.id,
        userId: admin.id,
        action: 'FIRM_CREATED',
        resourceType: 'Firm',
        resourceId: firm.id,
        details: { plan: 'pro', seatCount: 10 },
        ipAddress: '192.168.1.100',
      },
      {
        firmId: firm.id,
        userId: admin.id,
        action: 'USER_INVITED',
        resourceType: 'User',
        resourceId: associate.id,
        details: { role: 'ASSOCIATE', email: 'emma@sterling.law' },
        ipAddress: '192.168.1.100',
      },
      {
        firmId: firm.id,
        userId: admin.id,
        action: 'USER_INVITED',
        resourceType: 'User',
        resourceId: partner.id,
        details: { role: 'PARTNER', email: 'robert@sterling.law' },
        ipAddress: '192.168.1.100',
      },
      {
        firmId: firm.id,
        userId: admin.id,
        action: 'MATTER_CREATED',
        resourceType: 'Matter',
        resourceId: merger.id,
        details: { name: merger.name, clientName: merger.clientName },
        ipAddress: '192.168.1.100',
      },
      {
        firmId: firm.id,
        userId: partner.id,
        action: 'MATTER_CREATED',
        resourceType: 'Matter',
        resourceId: consulting.id,
        details: {
          name: consulting.name,
          clientName: consulting.clientName,
        },
        ipAddress: '192.168.1.101',
      },
      {
        firmId: firm.id,
        userId: admin.id,
        action: 'PLAYBOOK_CREATED',
        resourceType: 'Playbook',
        resourceId: playbook.id,
        details: { name: playbook.name, ruleCount: 8 },
        ipAddress: '192.168.1.100',
      },
    ],
  });
  console.log('  ✅ Audit log entries created');

  // ── 6. Sample KB Query ──────────────────────────────────────────────────
  await prisma.kbQuery.create({
    data: {
      firmId: firm.id,
      question: 'What is the standard liability cap in our M&A playbook?',
      matterId: merger.id,
      answer:
        'The preferred liability cap is 1x fees paid over the preceding 12 months, excluding death, personal injury, fraud, and IP infringement. The fallback position allows up to 2x fees with a super-cap of 3x for data breach claims only.',
      confidence: 0.94,
      sourceChunks: [
        {
          chunkIndex: 2,
          sectionTitle: 'Liability Cap',
          documentName: 'Standard M&A Contract Playbook',
          relevance: 0.97,
        },
      ],
      modelUsed: 'gpt-4o',
      createdById: admin.id,
    },
  });
  console.log('  ✅ Sample KB query created');

  console.log('\n🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
