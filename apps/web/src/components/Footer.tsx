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
              <li><span className="text-[13px] text-[#717d79] cursor-default">Document Analysis</span></li>
              <li><span className="text-[13px] text-[#717d79] cursor-default">AI Drafting</span></li>
              <li><span className="text-[13px] text-[#717d79] cursor-default">Legal Research</span></li>
              <li><span className="text-[13px] text-[#717d79] cursor-default">Matter Management</span></li>
            </ul>
          </div>
          <div>
            <h4 className="font-serif text-sm font-semibold text-[#0c0a09] mb-3">Company</h4>
            <ul className="space-y-2">
              <li><span className="text-[13px] text-[#717d79] cursor-default">About</span></li>
              <li><span className="text-[13px] text-[#717d79] cursor-default">Careers</span></li>
              <li><span className="text-[13px] text-[#717d79] cursor-default">Blog</span></li>
              <li><span className="text-[13px] text-[#717d79] cursor-default">Press</span></li>
            </ul>
          </div>
          <div>
            <h4 className="font-serif text-sm font-semibold text-[#0c0a09] mb-3">Legal</h4>
            <ul className="space-y-2">
              <li><span className="text-[13px] text-[#717d79] cursor-default">Privacy Policy</span></li>
              <li><span className="text-[13px] text-[#717d79] cursor-default">Terms of Service</span></li>
              <li><span className="text-[13px] text-[#717d79] cursor-default">Security</span></li>
              <li><span className="text-[13px] text-[#717d79] cursor-default">GDPR</span></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-black/[0.04] pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[13px] text-[#717d79]">
          <p>&copy; 2026 Counsel Technologies, Inc.</p>
          <div className="flex items-center gap-4">
            <span className="cursor-default hover:text-[#0c0a09] transition-colors">Privacy</span>
            <span className="cursor-default hover:text-[#0c0a09] transition-colors">Terms</span>
            <span className="cursor-default hover:text-[#0c0a09] transition-colors">Security</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
