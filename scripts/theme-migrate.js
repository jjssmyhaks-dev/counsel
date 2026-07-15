const fs = require('fs');
const path = require('path');

const baseDir = 'C:/Users/Ashif/.openclaw-autoclaw/agents/counsel/workspace/counsel-platform/apps/web/src/app/(dashboard)';

const files = [
  'matters/page.tsx',
  'documents/page.tsx',
  'drafts/page.tsx',
  'kb/page.tsx',
  'research/page.tsx',
  'meetings/page.tsx',
  'admin/users/page.tsx',
  'settings/page.tsx',
];

const replacements = [
  // Backgrounds
  ['bg-slate-50', 'bg-[#fefdfb]'],
  ['bg-white ', 'bg-white dark:bg-slate-900 '],
  ['bg-white\n', 'bg-white dark:bg-slate-900\n'],
  ['bg-slate-100', 'bg-black/[0.03]'],
  ['bg-slate-200', 'bg-black/[0.04]'],
  // Text colors
  ['text-slate-900', 'text-[#0c0a09] dark:text-white'],
  ['text-slate-700', 'text-[#717d79] dark:text-slate-300'],
  ['text-slate-600', 'text-[#717d79] dark:text-slate-400'],
  ['text-slate-500', 'text-[#969e9b] dark:text-slate-500'],
  ['text-slate-400', 'text-[#969e9b] dark:text-slate-500'],
  // Blue → Green
  ['text-blue-600', 'text-[#0a8a5f]'],
  ['text-blue-700', 'text-[#0a8a5f]'],
  ['hover:text-blue-700', 'hover:text-[#15b881]'],
  ['bg-blue-600', 'bg-[#0c0a09]'],
  ['bg-blue-50', 'bg-[#eaf7f0]'],
  ['text-blue-500', 'text-[#15b881]'],
  // Green → Lovable palette  
  ['bg-green-100', 'bg-[#eaf7f0]'],
  ['text-green-700', 'text-[#0a8a5f]'],
  ['text-green-800', 'text-[#0a8a5f]'],
  ['bg-green-50', 'bg-[#eaf7f0]'],
  ['text-green-600', 'text-[#0a8a5f]'],
  // Amber/Red
  ['bg-amber-50', 'bg-[#fef8e6]'],
  ['text-amber-700', 'text-[#b45309]'],
  ['text-amber-800', 'text-[#b45309]'],
  ['bg-red-50', 'bg-[#fdf0ee]'],
  ['text-red-700', 'text-[#c2452e]'],
  ['text-red-800', 'text-[#c2452e]'],
  ['hover:text-red-600', 'hover:text-[#f0705b]'],
  // Borders
  ['border-slate-200', 'border-black/[0.04] dark:border-slate-800'],
  ['border-slate-300', 'border-black/[0.08] dark:border-slate-700'],
  ['border-slate-100', 'border-black/[0.04] dark:border-slate-800'],
  ['border-slate-50', 'border-black/[0.02] dark:border-slate-800'],
  ['border-slate-800', 'border-white/[0.06]'],
  // Shadows & rounded
  ['rounded-xl shadow-sm', 'rounded-2xl'],
  ['rounded-xl', 'rounded-xl'],
  ['shadow-sm', ''],
  // Gradients
  ['from-slate-800 to-slate-900', 'from-[#0c0a09] via-[#111c17] to-[#0a1a14]'],
  ['from-navy-800 to-navy-900', 'from-[#0c0a09] via-[#111c17] to-[#0a1a14]'],
  // Navy
  ['text-navy-900', 'text-[#0c0a09] dark:text-white'],
  ['bg-navy-900', 'bg-[#0c0a09]'],
  ['bg-navy-800', 'bg-[#111c17]'],
  // Accent
  ['bg-blue-100', 'bg-[#eaf7f0]'],
  ['text-blue-800', 'text-[#0a8a5f]'],
  ['bg-emerald-50', 'bg-[#eaf7f0]'],
  ['text-emerald-700', 'text-[#0a8a5f]'],
  ['bg-emerald-100', 'bg-[#15b881]/15'],
  // Focus rings
  ['focus:ring-blue-500', 'focus:ring-[#15b881]/30'],
  ['focus:border-blue-500', 'focus:border-[#15b881]/40'],
];

files.forEach(file => {
  const filePath = path.join(baseDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let changes = 0;

  replacements.forEach(([old, replacement]) => {
    // Only replace if old isn't already in content as part of the replacement
    if (content.includes(old) && !content.includes(replacement)) {
      const regex = new RegExp(old.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g');
      const before = content;
      content = content.replace(regex, replacement);
      if (content !== before) changes++;
    }
  });

  // Add serif declaration if not present
  if (!content.includes("const serif")) {
    content = content.replace(
      /(import.*\n.*\n)/,
      "$1\nconst serif = 'font-serif';\n"
    );
  }

  // Fix any double spacing issues
  content = content.replace(/  +/g, ' ');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ ${file} — ${changes} replacements`);
});

console.log('\n🎨 All dashboard pages themed with Lovable green-serif palette');
