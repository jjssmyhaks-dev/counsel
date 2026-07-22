// Shared Logo component — single source of truth for the Counsel brand mark.
// All pages import from here.
export function Logo({ size = 26, variant = 'dark' }: { size?: number; variant?: 'dark' | 'light' }) {
  const mint = '#15b881';
  const darkGreen = '#0a8a5f';
  const light = '#7ce3b6';
  // Dark variant: used on white/light backgrounds (Navbar, auth pages)
  // Light variant: used on dark backgrounds (sidebar)
  const leftFill = variant === 'light' ? '#7ce3b6' : mint;
  const rightFill = variant === 'light' ? '#15b881' : darkGreen;
  const circleFill = variant === 'light' ? 'white' : '#0c0a09';

  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden role="img">
      <path d="M6 16C6 10 10 6 16 6c0 6-4 10-10 10z" fill={leftFill} />
      <path d="M26 16c0 6-4 10-10 10 0-6 4-10 10-10z" fill={rightFill} />
      <circle cx="16" cy="16" r="2.2" fill={circleFill} />
    </svg>
  );
}
