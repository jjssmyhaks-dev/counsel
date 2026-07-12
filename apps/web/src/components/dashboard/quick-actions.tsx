'use client';

import { useRouter } from 'next/navigation';

interface QuickAction {
  label: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  variant: 'primary' | 'outline';
}

export function QuickActions() {
  const router = useRouter();

  const actions: QuickAction[] = [
    {
      label: 'Upload Document',
      description: 'Upload and analyze a document',
      icon: <DocIcon />,
      href: '/documents',
      variant: 'primary',
    },
    {
      label: 'New Matter',
      description: 'Create a new matter or case',
      icon: <MatterIcon />,
      href: '/matters',
      variant: 'outline',
    },
    {
      label: 'Ask the Firm',
      description: 'Query your knowledge base',
      icon: <KbIcon />,
      href: '/kb',
      variant: 'outline',
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-5 py-4 border-b border-slate-200">
        <h3 className="font-semibold text-slate-900">Quick Actions</h3>
      </div>
      <div className="p-5 flex flex-col sm:flex-row gap-4">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={() => router.push(action.href)}
            className={`flex-1 flex items-center gap-4 p-4 rounded-xl border text-left transition-all
              ${
                action.variant === 'primary'
                  ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700 hover:border-blue-700 hover:shadow-lg hover:shadow-blue-600/20'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:shadow-md'
              }`}
          >
            <div
              className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${
                action.variant === 'primary'
                  ? 'bg-white/20 text-white'
                  : 'bg-blue-50 text-blue-600'
              }`}
            >
              {action.icon}
            </div>
            <div className="min-w-0">
              <p className={`text-sm font-semibold ${action.variant === 'primary' ? 'text-white' : 'text-slate-900'}`}>
                {action.label}
              </p>
              <p className={`text-xs mt-1 ${action.variant === 'primary' ? 'text-blue-100' : 'text-slate-500'}`}>
                {action.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function DocIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}

function MatterIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );
}

function KbIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}
