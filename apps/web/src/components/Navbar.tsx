'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/Logo';

/* ── Design tokens ──
   brand: #15b881 / #0a8a5f / #7ce3b6
   dark: #0c0a09
   bg: #fefdfb
   muted: #717d79 / #969e9b
*/

const serif = "font-serif";

type MenuSection = {
  label: string;
  items: { label: string; desc?: string; href: string; icon?: string }[];
};

const productMenu: MenuSection[] = [
  {
    label: "Platform",
    items: [
      { label: "Overview", desc: "Everything Counsel can do", href: "/product" },
      { label: "Document Analysis", desc: "AI-powered contract review", href: "/product#documents" },
      { label: "Legal Research", desc: "RAG-powered knowledge search", href: "/product#research" },
      { label: "AI Drafting", desc: "Generate first-pass legal docs", href: "/product#drafting" },
    ],
  },
  {
    label: "Features",
    items: [
      { label: "Clause Extraction", desc: "23 clause types detected", href: "/product#clauses" },
      { label: "Playbook Engine", desc: "Custom rule evaluation", href: "/product#playbook" },
      { label: "Meeting Intelligence", desc: "Transcription + summaries", href: "/product#meetings" },
      { label: "Audit Trail", desc: "Immutable action logging", href: "/product#audit" },
    ],
  },
];

const solutionsMenu: MenuSection[] = [
  {
    label: "By Firm Size",
    items: [
      { label: "Solo Practitioners", desc: "Start free, scale as you grow", href: "/solutions#solo" },
      { label: "Boutique Firms", desc: "10-50 lawyers", href: "/solutions#boutique" },
      { label: "Mid-Size Firms", desc: "50-200 lawyers", href: "/solutions#midsize" },
      { label: "Big Law", desc: "Enterprise-grade AI", href: "/solutions#biglaw" },
    ],
  },
  {
    label: "By Practice Area",
    items: [
      { label: "Corporate / M&A", desc: "Due diligence automation", href: "/solutions#corporate" },
      { label: "Litigation", desc: "Brief generation & e-discovery", href: "/solutions#litigation" },
      { label: "Regulatory", desc: "Compliance research", href: "/solutions#regulatory" },
      { label: "IP / Patent", desc: "Prior art search & filing", href: "/solutions#ip" },
    ],
  },
];

const resourcesMenu = [
  { label: "Blog", desc: "Latest insights and updates", href: "/resources#blog" },
  { label: "Guides", desc: "In-depth how-to articles", href: "/resources#guides" },
  { label: "API Docs", desc: "Developer documentation", href: "/resources#api" },
  { label: "Changelog", desc: "Product updates and releases", href: "/resources#changelog" },
  { label: "Community", desc: "Join the Counsel community", href: "/resources#community" },
  { label: "Case Studies", desc: "Customer success stories", href: "/resources#cases" },
];

function DropdownMenu({ label, sections }: { label: string; sections: MenuSection[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const onEnter = () => {
    clearTimeout(timerRef.current);
    setOpen(true);
  };
  const onLeave = () => {
    timerRef.current = setTimeout(() => setOpen(false), 200);
  };

  return (
    <div ref={ref} className="relative" onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <button
        className={`text-[14px] tracking-[-0.01em] px-3 py-2 rounded-lg transition-colors flex items-center gap-1 ${open ? 'text-[#0c0a09]' : 'text-[#717d79] hover:text-[#0c0a09]'}`}
        onClick={() => setOpen(!open)}
      >
        {label}
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 pt-3 z-50">
          <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.2)] p-5 flex gap-8 min-w-[480px]">
            {sections.map((section, i) => (
              <div key={i} className="flex-1">
                <div className="text-[11px] tracking-[0.12em] uppercase text-[#969e9b] mb-4 font-medium">{section.label}</div>
                <div className="space-y-1">
                  {section.items.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="block px-3 py-2.5 rounded-lg hover:bg-[#eaf7f0] transition-colors group"
                    >
                      <div className="text-[14px] font-medium text-[#0c0a09] tracking-[-0.01em] group-hover:text-[#0a8a5f] transition-colors">{item.label}</div>
                      {item.desc && <div className="text-[12px] text-[#969e9b] mt-0.5">{item.desc}</div>}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SimpleDropdown({ label, items }: { label: string; items: { label: string; desc: string; href: string }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const onEnter = () => { clearTimeout(timerRef.current); setOpen(true); };
  const onLeave = () => { timerRef.current = setTimeout(() => setOpen(false), 200); };

  return (
    <div ref={ref} className="relative" onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <button
        className={`text-[14px] tracking-[-0.01em] px-3 py-2 rounded-lg transition-colors flex items-center gap-1 ${open ? 'text-[#0c0a09]' : 'text-[#717d79] hover:text-[#0c0a09]'}`}
        onClick={() => setOpen(!open)}
      >
        {label}
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 pt-3 z-50">
          <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.2)] p-5 w-[320px]">
            <div className="space-y-1">
              {items.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block px-3 py-2.5 rounded-lg hover:bg-[#eaf7f0] transition-colors group"
                >
                  <div className="text-[14px] font-medium text-[#0c0a09] tracking-[-0.01em] group-hover:text-[#0a8a5f] transition-colors">{item.label}</div>
                  <div className="text-[12px] text-[#969e9b] mt-0.5">{item.desc}</div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  return (
    <>
      <nav className={`sticky top-0 inset-x-0 z-50 h-16 transition-all duration-300 border-b ${scrolled ? 'bg-[#fefdfb]/85 backdrop-blur-xl border-black/[0.04]' : 'bg-[#fefdfb] border-transparent'}`}>
        <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-10">
            <Link href="/" className="flex items-center gap-2">
              <Logo variant="dark" size={26} />
              <span className="text-[#0c0a09] font-semibold tracking-[-0.02em] text-[18px]">Counsel</span>
            </Link>
            <div className="hidden md:flex items-center gap-7">
              <DropdownMenu label="Product" sections={productMenu} />
              <DropdownMenu label="Solutions" sections={solutionsMenu} />
              <SimpleDropdown label="Resources" items={resourcesMenu} />
              <Link href="/pricing" className={`text-[14px] tracking-[-0.01em] px-3 py-2 rounded-lg transition-colors ${pathname === '/pricing' ? 'text-[#0c0a09]' : 'text-[#717d79] hover:text-[#0c0a09]'}`}>
                Pricing
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login" className="text-[14px] text-[#717d79] hover:text-[#0c0a09] transition-colors px-3 py-2">Sign in</Link>
            <Link href="/register" className="text-[14px] font-medium text-white bg-[#0c0a09] hover:bg-[#0c0a09]/90 transition-colors rounded-full px-5 py-2 shadow-[0_4px_14px_-4px_rgba(12,10,9,0.4)]">
              Book a demo
            </Link>
            <button className="md:hidden ml-2 p-2 text-[#717d79]" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen
                ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 18L18 6M6 6l12 12" /></svg>
                : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
              }
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden bg-white border-t border-black/[0.04] px-6 py-4 space-y-1">
            <div className="text-[11px] tracking-[0.12em] uppercase text-[#969e9b] px-2 py-2 font-medium">Product</div>
            {productMenu.flatMap(s => s.items).map(item => (
              <Link key={item.label} href={item.href} onClick={() => setMobileOpen(false)} className="block px-3 py-2.5 rounded-lg text-[14px] text-[#717d79] hover:text-[#0c0a09] hover:bg-[#f7f7f7]">{item.label}</Link>
            ))}
            <div className="text-[11px] tracking-[0.12em] uppercase text-[#969e9b] px-2 py-2 mt-3 font-medium">Solutions</div>
            {solutionsMenu.flatMap(s => s.items).map(item => (
              <Link key={item.label} href={item.href} onClick={() => setMobileOpen(false)} className="block px-3 py-2.5 rounded-lg text-[14px] text-[#717d79] hover:text-[#0c0a09] hover:bg-[#f7f7f7]">{item.label}</Link>
            ))}
            <div className="text-[11px] tracking-[0.12em] uppercase text-[#969e9b] px-2 py-2 mt-3 font-medium">Resources</div>
            {resourcesMenu.map(item => (
              <Link key={item.label} href={item.href} onClick={() => setMobileOpen(false)} className="block px-3 py-2.5 rounded-lg text-[14px] text-[#717d79] hover:text-[#0c0a09] hover:bg-[#f7f7f7]">{item.label}</Link>
            ))}
            <Link href="/pricing" onClick={() => setMobileOpen(false)} className="block px-3 py-2.5 rounded-lg text-[14px] text-[#717d79] hover:text-[#0c0a09] hover:bg-[#f7f7f7]">Pricing</Link>
          </div>
        )}
      </nav>
    </>
  );
}
