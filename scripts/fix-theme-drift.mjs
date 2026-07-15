// Batch theme fixer — replaces stale Tailwind colors with Lovable green-serif design tokens
// Usage: node scripts/fix-theme-drift.mjs

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { resolve, basename } from 'path';

const DASHBOARD = 'C:/Users/Ashif/.openclaw-autoclaw/agents/counsel/workspace/counsel-platform/apps/web/src/app/dashboard';

const REPLACEMENTS = [
  // Blue → green (Lovable brand)
  ['hover:bg-blue-700', 'hover:bg-[#0a8a5f] transition-colors'],
  ['hover:bg-blue-800', 'hover:bg-[#0a8a5f] transition-colors'],
  ['bg-blue-700', 'bg-[#0a8a5f]'],
  ['bg-blue-600', 'bg-[#0a8a5f]'],
  ['bg-blue-500', 'bg-[#15b881]'],
  ['text-blue-700', 'text-[#0a8a5f]'],
  ['text-blue-600', 'text-[#15b881]'],
  ['text-blue-500', 'text-[#15b881]'],
  ['bg-blue-100', 'bg-[#eaf7f0]'],
  ['bg-blue-50', 'bg-[#eaf7f0]/40'],
  ['border-blue-500', 'border-[#15b881]/50'],
  ['border-blue-200', 'border-[#15b881]/20'],
  ['focus:ring-blue-500', 'focus:ring-[#15b881]/30'],
  ['focus:border-blue-500', 'focus:border-[#15b881]/40'],
  ['ring-blue-500', 'ring-[#15b881]/30'],
  ['file:bg-blue-100', 'file:bg-[#eaf7f0]'],
  ['file:text-blue-700', 'file:text-[#0a8a5f]'],
  ['hover:file:bg-blue-100', 'hover:file:bg-[#eaf7f0]'],

  // Slate → Lovable muted (light mode only — preserve dark: variants)
  ['slate-100', 'black/[0.04]'],
  ['slate-200', 'black/[0.06]'],
  ['slate-300', 'black/[0.08]'],
  ['slate-400', '[#969e9b]'],
  ['slate-500', '[#717d79]'],

  // text-slate-* → Lovable muted
  ['text-slate-400', 'text-[#969e9b]'],
  ['text-slate-500', 'text-[#717d79]'],
  ['text-slate-700', 'text-[#4b5551]'],
  ['text-slate-600', 'text-[#717d79]'],

  // bg-slate-* → Lovable warm bg
  ['bg-slate-50', 'bg-[#fefdfb]'],
  ['bg-slate-100', 'bg-[#faf8f5]'],

  // border-slate-* → Lovable subtle borders
  ['border-slate-100', 'border-black/[0.04]'],
  ['border-slate-200', 'border-black/[0.06]'],
  ['border-slate-300', 'border-black/[0.08]'],

  // Rounded → Lovable (xl)
  ['rounded-lg', 'rounded-xl'],
  ['rounded-md', 'rounded-lg'],

  // Clean up edge cases from slate replacement
  ['black/[0.04] black/[0.06]', 'black/[0.06]'],
  ['black/[0.06] black/[0.08]', 'black/[0.08]'],
  ['black/[0.08] black/[0.04]', 'black/[0.04]'],
  ['black/[0.04] black/[0.04]', 'black/[0.04]'],
  ['black/[0.06] black/[0.06]', 'black/[0.06]'],

  // Fix hover:bg-blue-700 that was already replaced with transition-colors but might have double
  ['transition-colors transition-colors', 'transition-colors'],
];

function walk(dir) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const full = resolve(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full);
    } else if (entry.endsWith('.tsx') || entry.endsWith('.css')) {
      fix(full);
    }
  }
}

function fix(filePath) {
  let content = readFileSync(filePath, 'utf8');
  let changed = false;

  for (const [old, replacement] of REPLACEMENTS) {
    if (content.includes(old)) {
      const before = content;
      content = content.split(old).join(replacement);
      changed = true;
    }
  }

  if (changed) {
    writeFileSync(filePath, content, 'utf8');
    console.log(`✓ ${basename(filePath)}`);
  }
}

console.log('Fixing theme drift in dashboard pages...');
walk(DASHBOARD);
// Also fix globals.css
const cssPath = 'C:/Users/Ashif/.openclaw-autoclaw/agents/counsel/workspace/counsel-platform/apps/web/src/app/globals.css';
fix(cssPath);
console.log('Done.');
