const fs = require('fs');
const path = require('path');

const root = 'C:/Users/Ashif/.openclaw-autoclaw/agents/counsel/workspace/counsel-platform';

const edits = [
  // 1. Navbar: remove inline Logo, add import, add Book a Demo link
  {
    file: 'apps/web/src/components/Navbar.tsx',
    removes: /function Logo\(\) \{[\s\S]*?  \);\n\}\n\n/g,
    addImport: "import { Logo } from '@/components/Logo';\n",
    postFix: (src) => {
      // Change <Logo /> to <Logo variant="dark" size={26} />
      src = src.replace(/<Logo \/>/g, '<Logo variant="dark" size={26} />');
      // Add "Book a Demo" CTA in right nav
      if (!src.includes('/demo')) {
        src = src.replace(
          /<a href="\/login"[^>]*>([^<]*)<\/a>/,
          '<a href="/login" className="text-[13px] font-medium text-[#717d79] hover:text-[#0c0a09] transition-colors">$1</a>\n              <a href="/demo" className="text-[13px] font-semibold text-white bg-[#0c0a09] hover:bg-[#0a8a5f] transition-colors rounded-full px-4 py-2">Book a Demo</a>'
        );
      }
      return src;
    }
  },
  // 2. Login page: remove inline Logo
  {
    file: 'apps/web/src/app/(auth)/login/page.tsx',
    removes: /function Logo\(\) \{[\s\S]*?  \);\n\}\n\n/g,
    addImport: "import { Logo } from '@/components/Logo';\n\n",
  },
  // 3. Register page: remove inline Logo
  {
    file: 'apps/web/src/app/(auth)/register/page.tsx',
    removes: /function Logo\(\) \{[\s\S]*?  \);\n\}\n\n/g,
    addImport: "import { Logo } from '@/components/Logo';\n\n",
  },
  // 4. Forgot password: remove inline Logo
  {
    file: 'apps/web/src/app/(auth)/forgot-password/page.tsx',
    removes: /function Logo\(\) \{[\s\S]*?  \);\n\}\n\n/g,
    addImport: "import { Logo } from '@/components/Logo';\n\n",
  },
  // 5. Reset password: remove inline Logo
  {
    file: 'apps/web/src/app/(auth)/reset-password/page.tsx',
    removes: /function Logo\(\) \{[\s\S]*?  \);\n\}\n\n/g,
    addImport: "import { Logo } from '@/components/Logo';\n\n",
  },
  // 6. Landing page: remove inline Logo
  {
    file: 'apps/web/src/app/page.tsx',
    removes: /function Logo\(\) \{[\s\S]*?  \);\n\}\n\n/g,
    addImport: "import { Logo } from '@/components/Logo';\n\n",
  },
];

for (const e of edits) {
  const fp = path.join(root, e.file);
  if (!fs.existsSync(fp)) { console.log('SKIP (not found):', e.file); continue; }
  let src = fs.readFileSync(fp, 'utf-8');
  
  if (e.removes.test(src)) {
    src = src.replace(e.removes, '');
    if (e.addImport && !src.includes("from '@/components/Logo'")) {
      // Insert import after the first import or after 'use client'
      if (src.includes('@/lib/auth')) {
        src = src.replace(/(import .+ from '@\/lib\/auth';)/, "$1\n" + e.addImport.trim());
      } else if (src.includes('next/navigation')) {
        src = src.replace(/(import .+ from 'next\/navigation';)/, "$1\n" + e.addImport.trim());
      } else {
        src = src.replace(/(import .+;)\n/, "$1\n" + e.addImport.trim() + "\n");
      }
    }
    if (e.postFix) src = e.postFix(src);
    fs.writeFileSync(fp, src);
    console.log('FIXED:', e.file);
  } else {
    console.log('OK (clean):', e.file);
  }
}

console.log('\nDone.');
