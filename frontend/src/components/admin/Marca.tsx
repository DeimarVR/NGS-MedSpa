import { useId } from 'react';

/** La marca de NGS (la hoja en oro rosa) para el panel. */
export function MarcaNgs({ tamano = 36, className = '' }: { tamano?: number; className?: string }) {
  // Un id por dibujo: si dos logos comparten id y el primero está oculto, el
  // degradado del segundo no se pinta.
  const id = useId();
  return (
    <svg viewBox="0 0 64 64" width={tamano} height={tamano} className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="1">
          <stop offset="0" stopColor="#9C6B53" />
          <stop offset="1" stopColor="#D8A988" />
        </linearGradient>
      </defs>
      <path d="M20 2h40v42a18 18 0 0 1-18 18H4V20A18 18 0 0 1 20 2z" fill={`url(#${id})`} />
      <text x="32" y="40" textAnchor="middle" fontFamily="Georgia,serif" fontWeight="700" fontSize="20" fill="#fff">
        NGS
      </text>
    </svg>
  );
}

export function LogoPanel({ compacto = false }: { compacto?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <MarcaNgs tamano={compacto ? 34 : 40} />
      {!compacto && (
        <span className="leading-tight">
          <b className="block font-display text-[1.05rem] text-brand-900">NGS MedSpa</b>
          <small className="block text-[0.7rem] font-bold uppercase tracking-[0.12em] text-accent-700 rtl:tracking-normal">Advanced Aesthetics</small>
        </span>
      )}
    </span>
  );
}
