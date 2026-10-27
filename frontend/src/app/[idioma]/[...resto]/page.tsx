import { notFound } from 'next/navigation';

/** Cualquier ruta que no exista dentro de un idioma cae aquí y da el 404 traducido. */
export default function RestoDeRutas() {
  notFound();
}
