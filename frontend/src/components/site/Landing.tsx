import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { IDIOMAS } from '@/lib/idiomas';
import { agruparHorario, capitalizar, horaLocal, nombreDia } from '@/lib/horario';
import type { DatosClinica } from '@/server/consultas';
import { CabeceraSitio } from './CabeceraSitio';
import { Flotantes } from './Flotantes';
import { FormularioContacto } from './FormularioContacto';
import { GuiaTratamiento } from './GuiaTratamiento';
import { Icono, type NombreIcono } from './iconos';
import { PieSitio } from './PieSitio';
import { VideoPortada } from './VideoPortada';
import './landing.css';

/** Las seis tarjetas de tratamientos de basico.html, con sus colores. */
const TARJETAS: Array<{
  id: 'toxina' | 'rellenos' | 'perfilado' | 'piel' | 'planes' | 'signature';
  icono: NombreIcono;
  fondo: string;
  color: string;
  conPrecio?: boolean;
  oscura?: boolean;
}> = [
  { id: 'toxina', icono: 'jeringa', fondo: '#F6EDE7', color: '#9C6B53', conPrecio: true },
  { id: 'rellenos', icono: 'labios', fondo: '#FBEAEA', color: '#B4535E', conPrecio: true },
  { id: 'perfilado', icono: 'destello', fondo: '#EEF1F8', color: '#3E5A8C', conPrecio: true },
  { id: 'piel', icono: 'hoja', fondo: '#EAF5EF', color: '#3E7B5B' },
  { id: 'planes', icono: 'regalo', fondo: '#FCEFF6', color: '#B0517F' },
  { id: 'signature', icono: 'estrella', fondo: 'var(--grad)', color: '#fff', oscura: true },
];

export async function Landing({ clinica }: { clinica: DatosClinica }) {
  const locale = await getLocale();
  const intl = IDIOMAS[locale].intl;
  const t = await getTranslations('sitio');
  const tramos = agruparHorario(clinica.horario);
  const preguntas = t.raw('faq.items') as Array<{ p: string; r: string }>;

  return (
    <div className="ngs">
      {clinica.avisoDemo && (
        <div className="demo">
          <b>{t('demo.titulo')}</b> · <span>{t('demo.texto')}</span>
        </div>
      )}

      <CabeceraSitio />

      <main>
        {/* 2. Portada con video de fondo */}
        <section className="hero" id="inicio">
          <div className="hero-bg">
            <VideoPortada />
          </div>
          <div className="in">
            <span className="badge">{t('hero.insignia')}</span>
            <h1>
              {t('hero.titulo1')}
              <br />
              <span>{t('hero.titulo2')}</span>
            </h1>
            <p>{t('hero.texto')}</p>
            <div className="ctas">
              <a className="btn btn-grad" href="#servicios">
                {t('hero.descubrir')}
              </a>
              <a className="btn btn-glass" href="#contacto">
                {t('hero.contactar')}
              </a>
            </div>
          </div>
          <span className="explore">{t('hero.explorar')}</span>
        </section>

        {/* 3. Seis tarjetas de tratamientos */}
        <section className="s bgsoft" id="servicios">
          <div className="wrap">
            <div className="head">
              <div>
                <div className="kicker">{t('servicios.kicker')}</div>
                <h2>{t('servicios.titulo')}</h2>
                <p className="lead">{t('servicios.texto')}</p>
              </div>
              <div className="stats">
                <div className="stat">
                  <b>6</b>
                  <span>{t('servicios.especialidades')}</span>
                </div>
                <div className="stat dark">
                  <b>{t('servicios.idiomas')}</b>
                  <span>{t('servicios.bilingue')}</span>
                </div>
              </div>
            </div>
            <div className="cards">
              {TARJETAS.map((tarjeta, i) => {
                const items = t.raw(`servicios.${tarjeta.id}.items`) as string[];
                return (
                  <div key={tarjeta.id} className={`card${tarjeta.oscura ? ' dark' : ''}`}>
                    {tarjeta.oscura && <span className="new">{t('servicios.nuevo')}</span>}
                    <span className="num">{String(i + 1).padStart(2, '0')}</span>
                    <div className="icon" style={{ background: tarjeta.fondo, color: tarjeta.color }}>
                      <Icono nombre={tarjeta.icono} tamano={30} />
                    </div>
                    <h3>{t(`servicios.${tarjeta.id}.titulo`)}</h3>
                    <ul>
                      {tarjeta.conPrecio && (
                        <li>
                          <span>
                            {t(`servicios.${tarjeta.id as 'toxina' | 'rellenos' | 'perfilado'}.principal`)}
                            <small>{t(`servicios.${tarjeta.id as 'toxina' | 'rellenos' | 'perfilado'}.precio`)}</small>
                          </span>
                        </li>
                      )}
                      {items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
            <div className="help">
              <div>
                <h4>{t('servicios.ayudaTitulo')}</h4>
                <p>{t('servicios.ayudaTexto')}</p>
              </div>
              <div className="acciones">
                <a className="btn btn-line" href="#guia">
                  {t('servicios.verGuia')}
                </a>
                <Link className="btn btn-dark" href="/reservar">
                  {t('servicios.reservar')}
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Guía de 2 pasos */}
        <section className="s" id="guia">
          <div className="wrap quiz">
            <div>
              <div className="kicker">{t('guia.kicker')}</div>
              <h2>{t('guia.titulo')}</h2>
              <p className="lead">{t('guia.texto')}</p>
              <div className="note">{t('guia.nota')}</div>
            </div>
            <GuiaTratamiento />
          </div>
        </section>

        {/* 5. Nuestra esencia */}
        <section className="s bgsoft" id="esencia">
          <div className="wrap ess">
            <div className="photo">
              {clinica.fotoEsencia ? (
                <img src={clinica.fotoEsencia} alt={t('esencia.fotoDetalle')} />
              ) : (
                <div>
                  {t('esencia.fotoPrueba')}
                  <span>{t('esencia.fotoDetalle')}</span>
                </div>
              )}
            </div>
            <div>
              <div className="kicker">{t('esencia.kicker')}</div>
              <h2>{t('esencia.titulo')}</h2>
              <p>{t('esencia.texto')}</p>
              <div className="quote">{t('esencia.cita')}</div>
            </div>
          </div>
        </section>

        {/* 6. Club VIP */}
        <section className="s club" id="club">
          <div className="wrap grid">
            <div>
              <span className="pill-gold">{t('club.pastilla')}</span>
              <h2>
                {t('club.titulo1')}
                <br />
                <span>{t('club.titulo2')}</span>
              </h2>
              <p>{t('club.texto')}</p>
              {(
                [
                  ['b1', 'etiqueta'],
                  ['b2', 'estrella'],
                  ['b3', 'ciclo'],
                ] as const
              ).map(([clave, icono]) => (
                <div className="ben" key={clave}>
                  <i>
                    <Icono nombre={icono} tamano={24} />
                  </i>
                  <div>
                    <b>{t(`club.${clave}.titulo`)}</b>
                    <span>{t(`club.${clave}.texto`)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="vip" aria-hidden="true">
              <div className="top-row">
                <div>
                  <small>NGS MEDSPA</small>
                  <div className="serif" style={{ color: '#fff', fontSize: 28 }}>
                    {t('club.titulo2')}
                  </div>
                </div>
                <span style={{ color: 'var(--gold)' }}>
                  <Icono nombre="corona" tamano={32} />
                </span>
              </div>
              <div className="chip" />
              <div className="row">
                <div>
                  <span>{t('club.tarjetaMiembro')}</span>
                  <b>{t('club.tarjetaNombre')}</b>
                </div>
                <div className="fin">
                  <span>{t('club.tarjetaNivel')}</span>
                  <b style={{ color: 'var(--gold)' }}>VIP</b>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 7. Preguntas frecuentes */}
        <section className="s" id="faq">
          <div className="wrap">
            <div style={{ textAlign: 'center' }}>
              <div className="kicker">{t('faq.kicker')}</div>
              <h2>{t('faq.titulo')}</h2>
            </div>
            <div className="faq">
              {preguntas.map((p) => (
                <details key={p.p}>
                  <summary>{p.p}</summary>
                  <p>{p.r}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* 8. Visítanos */}
        <section id="contacto">
          <div className="wrap">
            <div style={{ textAlign: 'center', marginBottom: 46 }}>
              <div className="kicker">{t('visita.kicker')}</div>
              <h2>{t('visita.titulo')}</h2>
            </div>
            <div className="visit">
              <div className="vinfo">
                <h3>{t('visita.infoTitulo')}</h3>
                <div className="vi">
                  <i>
                    <Icono nombre="ubicacion" />
                  </i>
                  <div>
                    <small>{t('visita.direccion')}</small>
                    <p>{clinica.direccion || t('visita.direccionEjemplo')}</p>
                    <a href={clinica.mapaUrl} target="_blank" rel="noopener noreferrer">
                      {t('visita.verMapa')}
                    </a>
                  </div>
                </div>
                <div className="vi">
                  <i>
                    <Icono nombre="telefono" />
                  </i>
                  <div>
                    <small>{t('visita.telefono')}</small>
                    <p dir="ltr">
                      <a href={clinica.telefonoEnlace} style={{ color: 'inherit', fontSize: 'inherit' }}>
                        {clinica.telefono}
                      </a>
                    </p>
                    <a href="#escribenos">{t('visita.enviarMensaje')}</a>
                  </div>
                </div>
                <div className="vi">
                  <i>
                    <Icono nombre="instagram" />
                  </i>
                  <div>
                    <small>{t('visita.instagram')}</small>
                    <p dir="ltr">
                      <a
                        href={`https://www.instagram.com/${clinica.instagram}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'inherit', fontSize: 'inherit' }}
                      >
                        @{clinica.instagram}
                      </a>
                    </p>
                  </div>
                </div>
                <div className="hours">
                  {tramos.map((tramo) => (
                    <div key={`${tramo.desde}-${tramo.hasta}`}>
                      <span>
                        {capitalizar(
                          tramo.desde === tramo.hasta
                            ? nombreDia(tramo.desde, intl)
                            : t('visita.rango', { desde: nombreDia(tramo.desde, intl), hasta: nombreDia(tramo.hasta, intl) }),
                          intl,
                        )}
                      </span>
                      <b>
                        <bdi>{horaLocal(tramo.abre, intl)}</bdi> – <bdi>{horaLocal(tramo.cierra, intl)}</bdi>
                      </b>
                    </div>
                  ))}
                </div>
              </div>
              <div className="map">
                {clinica.mapaEmbed ? (
                  <iframe src={clinica.mapaEmbed} title={t('visita.mapaTitulo')} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                ) : (
                  <div>
                    {t('visita.mapaPrueba')}
                    <span>{t('visita.mapaDetalle')}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="escribenos" id="escribenos">
              <div>
                <div className="kicker">{t('contacto.kicker')}</div>
                <h3>{t('contacto.titulo')}</h3>
                <p>{t('contacto.texto')}</p>
              </div>
              <FormularioContacto />
            </div>
          </div>
        </section>
      </main>

      <PieSitio instagram={clinica.instagram} />
      <Flotantes />
    </div>
  );
}

