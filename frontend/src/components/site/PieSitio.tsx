import { getLocale, getTranslations } from 'next-intl/server';
import { siFacebook, siInstagram, siTiktok, type SimpleIcon } from 'simple-icons';
import { Link } from '@/i18n/navigation';
import type { DatosClinica } from '@/server/consultas';
import { LogoNgs } from './CabeceraSitio';

/** El logo oficial de la red (paquete simple-icons), en el color del texto. */
function LogoRed({ icono }: { icono: SimpleIcon }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d={icono.path} />
    </svg>
  );
}

/**
 * Pie de página de basico.html. `enLanding` decide si los anclajes son locales.
 * Las redes salen solo si están configuradas (Configuración → La clínica).
 */
export async function PieSitio({
  clinica,
  enLanding = true,
}: {
  clinica: Pick<DatosClinica, 'instagram' | 'facebook' | 'tiktok'>;
  enLanding?: boolean;
}) {
  const t = await getTranslations('sitio');
  const locale = await getLocale();
  const a = (ancla: string) => (enLanding ? `#${ancla}` : `/${locale}#${ancla}`);
  const redes = [
    clinica.instagram ? { nombre: 'Instagram', url: `https://www.instagram.com/${clinica.instagram}/`, icono: siInstagram } : null,
    clinica.tiktok ? { nombre: 'TikTok', url: clinica.tiktok, icono: siTiktok } : null,
    clinica.facebook ? { nombre: 'Facebook', url: clinica.facebook, icono: siFacebook } : null,
  ].filter((r) => r !== null);

  return (
    <footer>
      <div className="wrap">
        <div className="cols">
          <div>
            <LogoNgs href={enLanding ? '#inicio' : '/'} />
            <p>{t('pie.texto')}</p>
            {redes.length > 0 && (
              <div className="soc">
                {redes.map((r) => (
                  <a key={r.nombre} href={r.url} target="_blank" rel="noopener noreferrer" aria-label={r.nombre} title={r.nombre}>
                    <LogoRed icono={r.icono} />
                  </a>
                ))}
              </div>
            )}
          </div>
          <div>
            <h5>{t('pie.navegacion')}</h5>
            <a href={a('inicio')}>{t('nav.inicio')}</a>
            <a href={a('servicios')}>{t('nav.tratamientos')}</a>
            <a href={a('faq')}>{t('nav.preguntas')}</a>
            <Link href="/reservar">{t('pie.reservas')}</Link>
          </div>
          <div>
            <h5>{t('pie.legal')}</h5>
            <Link href="/legal/terminos">{t('pie.terminos')}</Link>
            <Link href="/legal/privacidad">{t('pie.privacidad')}</Link>
            <Link href="/legal/consentimientos">{t('pie.consentimientos')}</Link>
          </div>
        </div>
        <div className="bottom">
          <span>{t('pie.derechos')}</span>
          <Link href="/admin">{t('pie.panel')}</Link>
        </div>
      </div>
    </footer>
  );
}
