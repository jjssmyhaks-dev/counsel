import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-black/[0.04] bg-[#faf8f5]">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div>
            <h4 className="font-serif text-sm font-semibold text-[#0c0a09] mb-3">Product</h4>
            <ul className="space-y-2">
              <li><Link href="/product" className="text-[13px] text-[#717d79] hover:text-[#0c0a09] transition-colors">Overview</Link></li>
              <li><Link href="/solutions" className="text-[13px] text-[#717d79] hover:text-[#0c0a09] transition-colors">Solutions</Link></li>
              <li><Link href="/pricing" className="text-[13px] text-[#717d79] hover:text-[#0c0a09] transition-colors">Pricing</Link></li>
              <li><Link href="/resources" className="text-[13px] text-[#717d79] hover:text-[#0c0a09] transition-colors">Resources</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-serif text-sm font-semibold text-[#0c0a09] mb-3">Features</h4>
            <ul className="space-y-2">
              <li><Link href="/product#documents" className="text-[13px] text-[#717d79] hover:text-[#0c0a09] transition-colors">Document Analysis</Link></li>
              <li><Link href="/product#drafting" className="text-[13px] text-[#717d79] hover:text-[#0c0a09] transition-colors">AI Drafting</Link></li>
              <li><Link href="/product#research" className="text-[13px] text-[#717d79] hover:text-[#0c0a09] transition-colors">Legal Research</Link></li>
              <li><Link href="/dashboard/matters" className="text-[13px] text-[#717d79] hover:text-[#0c0a09] transition-colors">Matter Management</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-serif text-sm font-semibold text-[#0c0a09] mb-3">Company</h4>
            <ul className="space-y-2">
              <li><Link href="/solutions" className="text-[13px] text-[#717d79] hover:text-[#0c0a09] transition-colors">About</Link></li>
              <li><Link href="/resources#blog" className="text-[13px] text-[#717d79] hover:text-[#0c0a09] transition-colors">Blog</Link></li>
              <li><Link href="/resources#changelog" className="text-[13px] text-[#717d79] hover:text-[#0c0a09] transition-colors">Changelog</Link></li>
              <li><Link href="/product#audit" className="text-[13px] text-[#717d79] hover:text-[#0c0a09] transition-colors">Security</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-serif text-sm font-semibold text-[#0c0a09] mb-3">Legal</h4>
            <ul className="space-y-2">
              <li><Link href="/resources" className="text-[13px] text-[#717d79] hover:text-[#0c0a09] transition-colors">Privacy Policy</Link></li>
              <li><Link href="/resources" className="text-[13px] text-[#717d79] hover:text-[#0c0a09] transition-colors">Terms of Service</Link></li>
              <li><Link href="/product#audit" className="text-[13px] text-[#717d79] hover:text-[#0c0a09] transition-colors">Security</Link></li>
              <li><Link href="/solutions" className="text-[13px] text-[#717d79] hover:text-[#0c0a09] transition-colors">GDPR</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-black/[0.04] pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[13px] text-[#717d79]">
          <p>&copy; 2026 Counsel Technologies, Inc.</p>
          <div className="flex items-center gap-4">
            <Link href="/resources" className="hover:text-[#0c0a09] transition-colors">Privacy</Link>
            <Link href="/resources" className="hover:text-[#0c0a09] transition-colors">Terms</Link>
            <Link href="/product#audit" className="hover:text-[#0c0a09] transition-colors">Security</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
