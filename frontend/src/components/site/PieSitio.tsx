import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { LogoNgs } from './CabeceraSitio';

/** Pie de página de basico.html. `enLanding` decide si los anclajes son locales. */
export async function PieSitio({ instagram, enLanding = true }: { instagram: string; enLanding?: boolean }) {
  const t = await getTranslations('sitio');
  const locale = await getLocale();
  const a = (ancla: string) => (enLanding ? `#${ancla}` : `/${locale}#${ancla}`);
  return (
    <footer>
      <div className="wrap">
        <div className="cols">
          <div>
            <LogoNgs href={enLanding ? '#inicio' : '/'} />
            <p>{t('pie.texto')}</p>
            <div className="soc">
              <a href={`https://www.instagram.com/${instagram}/`} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                IG
              </a>
              <span aria-label="TikTok">TT</span>
              <span aria-label="Facebook">FB</span>
            </div>
          </div>
          <div>
            <h5>{t('pie.navegacion')}</h5>
            <a href={a('inicio')}>{t('nav.inicio')}</a>
            <a href={a('servicios')}>{t('nav.tratamientos')}</a>
            <a href={a('club')}>{t('nav.club')}</a>
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
          <span>
            {t('pie.hecho')} · <Link href="/admin">{t('pie.panel')}</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
