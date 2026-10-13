import { useState } from 'react';

/** A player's picture, or their initial on a white/black tile when there's no picture. */
export function Avatar({ name, src, side, size = 40, className = '' }: { name: string; src?: string; side: 'white' | 'black'; size?: number; className?: string }) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size, fontSize: size * 0.45 };
  if (src && !broken) return <img className={`avatar-img ${className}`} src={src} alt="" style={style} onError={() => setBroken(true)} />;
  return (
    <span className={`avatar-chip ${side} ${className}`} style={style} aria-hidden>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function TitleBadge({ title }: { title?: string }) {
  return title ? <span className="title-badge">{title}</span> : null;
}
