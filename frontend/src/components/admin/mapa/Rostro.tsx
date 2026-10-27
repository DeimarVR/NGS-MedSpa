'use client';

import type { FaceView, ProductKind } from '@/lib/types';
import { ALTO, ANCHO } from './zonas';

/**
 * Plantilla del rostro, dibujada a mano para NGS (línea fina, sin rasgos de
 * nadie). Frente, perfil izquierdo (nariz a la izquierda) y perfil derecho.
 */
function Frente() {
  return (
    <g>
      <path d="M150 42C98 42 74 88 74 148C74 196 82 236 98 266C112 292 130 314 150 318C170 314 188 292 202 266C218 236 226 196 226 148C226 88 202 42 150 42Z" />
      <path d="M84 118C96 74 128 58 150 58C172 58 204 74 216 118" className="opacity-50" />
      <path d="M74 148C62 146 59 176 76 192M226 148C238 146 241 176 224 192" />
      <path d="M98 140C110 130 128 129 139 136M202 140C190 130 172 129 161 136" strokeWidth={2.4} />
      <path d="M102 161C112 152 128 152 137 161C128 167 112 167 102 161ZM198 161C188 152 172 152 163 161C172 167 188 167 198 161Z" />
      <circle cx={119.5} cy={160} r={4} className="fill-current" />
      <circle cx={180.5} cy={160} r={4} className="fill-current" />
      <path d="M144 168C143 186 138 202 134 212C138 220 145 221 150 218C155 221 162 220 166 212C162 202 157 186 156 168" />
      <path d="M124 255C135 247 145 246 150 250C155 246 165 247 176 255C164 261 136 261 124 255ZM124 255C135 271 165 271 176 255" />
      <path d="M120 300L116 372M180 300L184 372" />
    </g>
  );
}

function Perfil() {
  return (
    <g>
      <path d="M196 40C150 38 112 62 104 106C100 128 102 142 98 152C95 158 96 166 94 172C88 188 80 200 74 212C72 218 76 223 84 224C88 225 92 226 93 230C92 238 90 242 92 246C88 250 90 255 94 257C90 264 93 271 98 274C94 284 97 296 106 304C122 318 158 316 182 302C196 292 202 276 206 262C238 254 254 214 254 160C254 90 236 42 196 40Z" />
      <path d="M186 164C200 150 216 164 211 185C208 200 196 205 189 198" />
      <path d="M104 150C112 145 122 145 131 150" strokeWidth={2.4} />
      <path d="M110 168C116 164 122 164 127 168C122 171 116 171 110 168Z" />
      <path d="M128 310L132 372M206 262C210 300 214 336 218 372" />
      <path d="M150 52C185 48 222 70 236 112" className="opacity-50" />
    </g>
  );
}

export interface PuntoDibujo {
  clave: string;
  x: number;
  y: number;
  numero: number;
  kind?: ProductKind | null;
  activo?: boolean;
}

export const COLOR_PRODUCTO: Record<string, string> = {
  TOXINA: '#3E5A8C',
  RELLENO: '#B4535E',
  BIOESTIMULADOR: '#C08A12',
  SKIN_BOOSTER: '#3E7B5B',
  OTRO: '#5E6676',
};

export function Rostro({
  vista,
  foto,
  puntos,
  onTocar,
  onPunto,
  etiqueta,
}: {
  vista: FaceView;
  foto?: string | null;
  puntos: PuntoDibujo[];
  onTocar?: (x: number, y: number) => void;
  onPunto?: (clave: string) => void;
  etiqueta: string;
}) {
  function tocar(e: React.MouseEvent<SVGSVGElement>) {
    if (!onTocar) return;
    const caja = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - caja.left) / caja.width) * ANCHO;
    const y = ((e.clientY - caja.top) / caja.height) * ALTO;
    onTocar(x, y);
  }

  return (
    <svg
      viewBox={`0 0 ${ANCHO} ${ALTO}`}
      role="img"
      aria-label={etiqueta}
      onClick={tocar}
      className={`block h-auto w-full select-none rounded-3xl bg-gradient-to-b from-white to-accent-100/50 ${onTocar ? 'cursor-crosshair' : ''}`}
    >
      {foto && vista === 'FRENTE' ? (
        <image href={foto} x={0} y={0} width={ANCHO} height={ALTO} preserveAspectRatio="xMidYMid slice" opacity={0.9} />
      ) : (
        <g fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="text-brand-300">
          {vista === 'FRENTE' ? <Frente /> : <g transform={vista === 'PERFIL_DER' ? `translate(${ANCHO} 0) scale(-1 1)` : undefined}><Perfil /></g>}
        </g>
      )}
      {puntos.map((p) => {
        const color = COLOR_PRODUCTO[p.kind ?? 'OTRO'] ?? COLOR_PRODUCTO.OTRO;
        return (
          <g
            key={p.clave}
            transform={`translate(${(p.x / 100) * ANCHO} ${(p.y / 100) * ALTO})`}
            onClick={(e) => {
              e.stopPropagation();
              onPunto?.(p.clave);
            }}
            className={onPunto ? 'cursor-pointer' : ''}
          >
            {p.activo && <circle r={13} fill={color} opacity={0.22} />}
            <circle r={8.5} fill={color} stroke="#fff" strokeWidth={2} />
            <text textAnchor="middle" dy="3.4" fontSize="9.5" fontWeight={700} fill="#fff" fontFamily="system-ui, sans-serif">
              {p.numero}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
