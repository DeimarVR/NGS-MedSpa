import type { ReactNode } from 'react';
import { datosClinica } from '@/server/consultas';
import { CabeceraSitio } from './CabeceraSitio';
import { PieSitio } from './PieSitio';
import './landing.css';

/**
 * Marco de las páginas públicas que no son la landing (reserva, gestión de la
 * cita, seguimiento, legales): la misma cabecera y el mismo pie de basico.html,
 * con el contenido en el estilo del sitio.
 */
export async function MarcoPublico({ children }: { children: ReactNode }) {
  const clinica = await datosClinica();
  return (
    <>
      <div className="ngs sticky top-0 z-40">
        <CabeceraSitio enLanding={false} />
      </div>
      <main className="min-h-[60vh] bg-cream">{children}</main>
      <div className="ngs">
        <PieSitio clinica={clinica} enLanding={false} />
      </div>
    </>
  );
}
