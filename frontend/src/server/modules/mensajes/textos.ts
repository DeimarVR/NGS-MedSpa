import { env } from '../../config/env';
import { formatLong } from '../../lib/datetime';
import { idiomaDeEnum, intlDe, traductor } from '../../i18n';

/**
 * Textos para la clienta, EN SU IDIOMA, listos para mandar a mano por SMS o
 * WhatsApp desde el teléfono de la clínica (o por correo).
 *
 * No hay envío automático: el canal (WhatsApp con plantillas, SMS o correo)
 * está pendiente de decidir con la clínica. Cuando se decida, el envío se
 * engancha aquí y en el cron diario, sin cambiar las pantallas.
 */
export type TipoDeTexto = 'confirmacion' | 'recordatorio' | 'retoque';

export function primerNombre(nombreCompleto: string): string {
  return nombreCompleto.trim().split(/\s+/)[0] ?? nombreCompleto;
}

export function textoParaClienta(
  tipo: TipoDeTexto,
  datos: { nombre: string; servicio: string; cuando?: Date; enlace?: string; idioma: string | null | undefined },
): string {
  const locale = idiomaDeEnum(datos.idioma);
  const t = traductor(locale);
  return t(`mensajesClienta.${tipo}`, {
    nombre: primerNombre(datos.nombre),
    servicio: datos.servicio,
    cuando: datos.cuando ? formatLong(datos.cuando, env.CLINIC_TIMEZONE, intlDe(locale)) : '',
    enlace: datos.enlace ?? '',
    clinica: env.CLINIC_NAME,
  });
}
