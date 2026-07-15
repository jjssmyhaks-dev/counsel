const fs = require('fs');
const path = require('path');

const bp = 'C:/Users/Ashif/.openclaw-autoclaw/agents/counsel/workspace/counsel-platform/apps/web/src/app/dashboard';

function walk(dir) {
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const full = path.join(dir, entry);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      walk(full);
    } else if (entry.endsWith('.tsx')) {
      fix(full);
    }
  }
}

function fix(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Fix light-mode slate text colors (not dark: variants)
  const fixes = [
    ['text-slate-900', 'text-[#0c0a09]'],
    ['text-slate-800', 'text-[#4b5551]'],
    ['text-slate-700', 'text-[#717d79]'],
    ['text-slate-600', 'text-[#717d79]'],
    ['border-slate-300', 'border-[#15b881]/30'],
    ['focus:ring-slate-300', 'focus:ring-[#15b881]/30'],
    ['focus:border-slate-300', 'focus:border-[#15b881]/30'],
  ];

  for (const [old, replacement] of fixes) {
    // Only replace if NOT preceded by "dark:" — use negative lookbehind via split on dark: prefix
    const regex = new RegExp(`(class[^=]*="[^"]*)${old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z-])`, 'g');
    const before = content;
    content = content.replace(regex, `$1${replacement}`);
    if (content !== before) {
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    const rel = filePath.split('dashboard\\').pop() || filePath;
    console.log('✓', rel);
  }
}

console.log('Fixing remaining light-mode slate colors...');
walk(bp);
console.log('Done.');
