'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

/** Antes y después, uno sobre otro, con una barra para deslizar. */
export function Comparador({ antes, despues, etiquetaAntes, etiquetaDespues }: { antes: string; despues: string; etiquetaAntes: string; etiquetaDespues: string }) {
  const t = useTranslations('panel.fotos');
  const [corte, setCorte] = useState(50);
  return (
    <div className="space-y-2">
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-ink select-none" dir="ltr">
        <img src={despues} alt={etiquetaDespues} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - corte}% 0 0)` }}>
          <img src={antes} alt={etiquetaAntes} className="absolute inset-0 h-full w-full object-cover" />
        </div>
        <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${corte}%` }} />
        <span className="absolute left-3 top-3 rounded-full bg-ink/70 px-2.5 py-1 text-xs font-bold text-white">{etiquetaAntes}</span>
        <span className="absolute right-3 top-3 rounded-full bg-ink/70 px-2.5 py-1 text-xs font-bold text-white">{etiquetaDespues}</span>
      </div>
      <input type="range" min={0} max={100} value={corte} onChange={(e) => setCorte(Number(e.target.value))} className="w-full accent-brand-700" aria-label={t('deslizar')} dir="ltr" />
    </div>
  );
}
