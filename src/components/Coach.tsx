import type { ReactNode } from 'react';

/** Hindsight's coach: a knight with a monocle. */
export function CoachMascot({ size = 56 }: { size?: number }) {
  return (
    <svg className="coach-mascot" viewBox="0 0 64 64" width={size} height={size} aria-hidden>
      <rect x="2" y="2" width="60" height="60" rx="18" fill="var(--cta)" />
      <path
        d="M20 52c0-7 2.5-11.5 8-16.5-4 .7-7 2.8-9.6 5.8L13 37c2.6-9.6 9.8-19.3 21-22l1.8-4.4 3.5 4.9c6.3 4.4 8.7 12.2 8.7 21.3V52z"
        fill="#fff8e6"
        stroke="#3b2a08"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <circle cx="31" cy="25" r="4.6" fill="none" stroke="#3b2a08" strokeWidth="2.2" />
      <circle cx="31" cy="25" r="1.6" fill="#3b2a08" />
      <path d="M35.4 27.5 38 40" stroke="#3b2a08" strokeWidth="1.4" />
      <path d="M17 52h34" stroke="#3b2a08" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** The mascot with a speech bubble. */
export function CoachBubble({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  return (
    <div className={`coach-bubble ${compact ? 'compact' : ''}`}>
      <CoachMascot size={compact ? 44 : 60} />
      <div className="bubble">{children}</div>
    </div>
  );
}
