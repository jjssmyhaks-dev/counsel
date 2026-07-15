import Navbar from '@/components/Navbar';

const serif = "font-serif";

const blogPosts = [
  { tag: "Research", date: "Jul 9, 2026", title: "How AI Is Reshaping Legal Due Diligence in 2026", desc: "A deep dive into how AI-powered tools are transforming the due diligence process — from data room review to exception reporting.", href: "#" },
  { tag: "Product", date: "Jun 28, 2026", title: "Introducing Counsel Playbook Engine v2: 8× Faster Clause Matching", desc: "Our new playbook engine processes clauses 8× faster than v1, with support for custom firm-specific rules and multi-jurisdictional playbooks.", href: "#" },
  { tag: "Guides", date: "Jun 15, 2026", title: "From Brief to Bench: AI-Assisted Legal Drafting Best Practices", desc: "A practical guide for integrating AI drafting into your firm's workflow — what to automate, what to review, and how to maintain quality.", href: "#" },
  { tag: "Research", date: "May 22, 2026", title: "The State of Legal AI: 2026 Benchmark Report", desc: "We tested 12 legal AI platforms across 5 key metrics. Here's how Counsel compares — and where the industry is headed.", href: "#" },
  { tag: "Product", date: "May 10, 2026", title: "Gmail Extension: Draft Legal Documents Without Leaving Your Inbox", desc: "Our new Chrome extension lets you analyze contracts and draft responses directly within Gmail — no tab switching required.", href: "#" },
  { tag: "Guides", date: "Apr 28, 2026", title: "Building a Firm Playbook: A Step-by-Step Guide", desc: "Learn how to codify your firm's negotiation positions into a playbook that Counsel can enforce automatically.", href: "#" },
];

const guides = [
  { title: "Getting Started with Counsel", desc: "Set up your account, invite your team, and run your first document analysis in under 5 minutes.", icon: "🚀", href: "#" },
  { title: "Custom Playbooks 101", desc: "How to define your firm's negotiation positions and create enforceable playbook rules.", icon: "📋", href: "#" },
  { title: "API Reference", desc: "Complete REST API documentation with code examples in TypeScript, Python, and Go.", icon: "⌨️", href: "#" },
  { title: "Security Whitepaper", desc: "How Counsel handles encryption, access control, data residency, and compliance.", icon: "🔐", href: "#" },
  { title: "Migration Guide", desc: "Moving from another platform? Step-by-step instructions for importing your data.", icon: "📦", href: "#" },
  { title: "Best Practices for AI Drafting", desc: "Tips for getting the best results from Counsel's drafting engine.", icon: "✨", href: "#" },
];

const resourcesNav = [
  { label: "Blog", desc: "Product updates, research insights, and industry analysis from the Counsel team." },
  { label: "Guides", desc: "In-depth tutorials and how-to articles for getting the most out of Counsel." },
  { label: "API Docs", desc: "Reference documentation for Counsel's REST API and SDKs." },
  { label: "Changelog", desc: "Detailed release notes for every product update and new feature." },
  { label: "Community", desc: "Join our Slack community of 2,000+ legal professionals using AI." },
  { label: "Case Studies", desc: "Real stories from firms that transformed their practice with Counsel." },
];

export default function ResourcesPage() {
  return (
    <div className="min-h-screen bg-[#fefdfb] text-[#0c0a09] antialiased selection:bg-[#15b881]/20" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <Navbar />

      {/* Hero */}
      <section className="border-b border-black/[0.04]">
        <div className="max-w-7xl mx-auto px-6 pt-20 pb-16 md:pt-28 md:pb-24">
          <div className="text-[12px] tracking-[0.12em] uppercase text-[#0a8a5f] mb-4">Resources</div>
          <h1 className={`${serif} text-[3.25rem] md:text-[5rem] font-normal tracking-[-0.02em] leading-[1.02] text-[#0c0a09] max-w-3xl`}>
            Everything you need to succeed with Counsel
          </h1>
          <p className="mt-6 text-[17px] text-[#4b5551] max-w-xl leading-relaxed">
            Product updates, technical guides, research papers, and real-world case studies from firms using Counsel.
          </p>
        </div>
      </section>

      {/* Resource Navigation */}
      <section className="border-b border-black/[0.04] bg-[#faf8f5]">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {resourcesNav.map((r) => (
              <a key={r.label} href="#" className="p-5 rounded-2xl border border-black/[0.04] bg-white hover:border-[#15b881]/30 transition-colors text-center group">
                <div className="text-[15px] font-semibold text-[#0c0a09] group-hover:text-[#0a8a5f] transition-colors tracking-[-0.01em]">{r.label}</div>
                <div className="text-[12px] text-[#717d79] mt-2 leading-relaxed">{r.desc}</div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Blog Posts */}
      <section id="blog" className="border-b border-black/[0.04]">
        <div className="max-w-7xl mx-auto px-6 py-20 md:py-28">
          <div className="flex items-end justify-between flex-wrap gap-4 mb-12">
            <div>
              <div className="text-[12px] tracking-[0.12em] uppercase text-[#0a8a5f] mb-3">Latest posts</div>
              <h2 className={`${serif} text-[2.5rem] md:text-[3.5rem] font-normal tracking-[-0.02em] leading-[1.02] text-[#0c0a09]`}>From the blog</h2>
            </div>
            <a href="#" className="text-[14px] font-medium text-[#0c0a09] hover:text-[#0a8a5f] transition-colors">All posts →</a>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {blogPosts.map((p) => (
              <a key={p.title} href={p.href} className="group p-7 rounded-2xl border border-black/[0.04] bg-white hover:border-[#15b881]/30 transition-colors flex flex-col">
                <div className="flex items-center gap-3 text-[12px] text-[#969e9b] mb-5">
                  <span className="rounded-full bg-[#eaf7f0] text-[#0a8a5f] px-2.5 py-1 font-medium">{p.tag}</span>
                  <span>·</span>
                  <span>{p.date}</span>
                </div>
                <h3 className="text-[18px] font-semibold tracking-[-0.02em] text-[#0c0a09] group-hover:text-[#0a8a5f] transition-colors leading-snug mb-3">{p.title}</h3>
                <p className="text-[14px] text-[#717d79] leading-relaxed flex-1">{p.desc}</p>
                <span className="mt-4 text-[13px] font-medium text-[#0a8a5f] group-hover:text-[#15b881] transition-colors">Read more →</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Guides */}
      <section id="guides" className="border-b border-black/[0.04] bg-[#faf8f5]">
        <div className="max-w-7xl mx-auto px-6 py-20 md:py-28">
          <div className="flex items-end justify-between flex-wrap gap-4 mb-12">
            <div>
              <div className="text-[12px] tracking-[0.12em] uppercase text-[#0a8a5f] mb-3">Guides</div>
              <h2 className={`${serif} text-[2.5rem] md:text-[3.5rem] font-normal tracking-[-0.02em] leading-[1.02] text-[#0c0a09]`}>In-depth guides</h2>
            </div>
            <a href="#" className="text-[14px] font-medium text-[#0c0a09] hover:text-[#0a8a5f] transition-colors">All guides →</a>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {guides.map((g) => (
              <a key={g.title} href={g.href} className="group p-7 rounded-2xl border border-black/[0.04] bg-white hover:border-[#15b881]/30 transition-colors flex flex-col">
                <div className="text-2xl mb-4">{g.icon}</div>
                <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-[#0c0a09] group-hover:text-[#0a8a5f] transition-colors mb-2">{g.title}</h3>
                <p className="text-[14px] text-[#717d79] leading-relaxed flex-1">{g.desc}</p>
                <span className="mt-4 text-[13px] font-medium text-[#0a8a5f] group-hover:text-[#15b881] transition-colors">Read guide →</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="border-b border-black/[0.04]">
        <div className="max-w-3xl mx-auto px-6 py-20 md:py-28 text-center">
          <h2 className={`${serif} text-[2.5rem] md:text-[3.5rem] font-normal tracking-[-0.02em] leading-[1.02] text-[#0c0a09]`}>Stay in the loop</h2>
          <p className="mt-4 text-[16px] text-[#717d79]">
            Get product updates, legal AI research, and best practices — delivered to your inbox.
          </p>
          <div className="mt-8 max-w-md mx-auto flex flex-col sm:flex-row items-stretch gap-2 p-1.5 sm:rounded-full bg-white border border-black/[0.08] shadow-[0_10px_30px_-10px_rgba(0,0,0,0.05)]">
            <input type="email" placeholder="you@yourfirm.com" className="flex-1 bg-transparent px-4 py-2.5 text-[14px] text-[#0c0a09] placeholder-[#969e9b] focus:outline-none" />
            <a href="/register" className="text-[14px] font-medium text-white bg-[#0c0a09] hover:bg-[#0a8a5f] transition-colors rounded-full px-6 py-2.5 whitespace-nowrap text-center">Subscribe →</a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-black/[0.04] bg-[#faf8f5]">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid md:grid-cols-4 gap-10">
            <div className="md:col-span-1">
              <div className="flex items-center gap-2">
                <svg width="26" height="26" viewBox="0 0 32 32" fill="none"><path d="M6 16C6 10 10 6 16 6c0 6-4 10-10 10z" fill="#15b881" /><path d="M26 16c0 6-4 10-10 10 0-6 4-10 10-10z" fill="#0a8a5f" /><circle cx="16" cy="16" r="2.2" fill="#0c0a09" /></svg>
                <span className="text-[#0c0a09] font-semibold tracking-[-0.02em] text-[18px]">Counsel</span>
              </div>
              <p className="mt-4 text-[14px] text-[#717d79] leading-relaxed max-w-xs">AI-powered legal platform for contract analysis, research, drafting, and knowledge management.</p>
            </div>
            {[
              { title: "Explore", items: ["Product", "Solutions", "Pricing", "Security"] },
              { title: "Resources", items: ["Blog", "Guides", "API Docs", "Changelog"] },
              { title: "Company", items: ["About", "Careers", "Contact", "Partners"] },
            ].map(col => (
              <div key={col.title}>
                <div className="text-[12px] tracking-[0.12em] uppercase text-[#969e9b] mb-5">{col.title}</div>
                <ul className="space-y-3">
                  {col.items.map(i => (<li key={i}><a href="#" className="text-[14px] text-[#0c0a09] hover:text-[#0a8a5f] transition-colors">{i}</a></li>))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-16 pt-8 border-t border-black/[0.04] flex flex-wrap items-center justify-between gap-4 text-[13px] text-[#717d79]">
            <div>&copy; 2026 Counsel Technologies, Inc.</div>
            <div className="flex items-center gap-4">
              <a href="#" className="hover:text-[#0c0a09] transition-colors">Privacy</a><span>·</span>
              <a href="#" className="hover:text-[#0c0a09] transition-colors">Terms</a><span>·</span>
              <a href="#" className="hover:text-[#0c0a09] transition-colors">Security</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
