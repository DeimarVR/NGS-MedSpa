'use client';

import { useState } from 'react';
import { aCentavos, centavosATexto } from '@/lib/format';

/** Campo de dinero: se escribe en dólares («12.50») y se entrega en centavos. */
export function CampoDinero({
  valor,
  onChange,
  className = 'field',
  ...resto
}: { valor: number | null; onChange: (centavos: number | null) => void; className?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [texto, setTexto] = useState(centavosATexto(valor));
  // Si el valor cambió desde fuera (no por lo que se escribe), se muestra ese.
  const coincide = texto.trim() === '' ? valor === null : aCentavos(texto) === valor;
  const mostrado = coincide ? texto : centavosATexto(valor);
  return (
    <div className="relative" dir="ltr">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
      <input
        {...resto}
        inputMode="decimal"
        value={mostrado}
        onChange={(e) => {
          setTexto(e.target.value);
          onChange(e.target.value.trim() ? aCentavos(e.target.value) : null);
        }}
        className={`${className} pl-7 text-right`}
      />
    </div>
  );
}
