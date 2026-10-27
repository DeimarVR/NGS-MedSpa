import { setRequestLocale } from 'next-intl/server';
import { Landing } from '@/components/site/Landing';
import { datosClinica } from '@/server/consultas';

/** La landing se regenera cada hora: horario y teléfono salen de la base. */
export const revalidate = 3600;

export default async function Inicio({ params }: { params: Promise<{ idioma: string }> }) {
  const { idioma } = await params;
  setRequestLocale(idioma as never);
  const clinica = await datosClinica();
  return <Landing clinica={clinica} />;
}
