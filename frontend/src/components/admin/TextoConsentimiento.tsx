/**
 * El texto del consentimiento con el mismo formato que el PDF: TÍTULOS y «- » viñetas.
 * En idiomas sin mayúsculas (árabe, japonés) el título se marca con «# ».
 */
export function TextoConsentimiento({ texto }: { texto: string }) {
  const bloques = texto.replace(/\r\n?/g, '\n').split('\n');
  return (
    <div className="space-y-2 text-[0.95rem] leading-relaxed text-ink">
      {bloques.map((crudo, i) => {
        const linea = crudo.trim();
        if (!linea) return <div key={i} className="h-1" />;
        if (/^[-*•]\s+/.test(linea)) {
          return (
            <p key={i} className="relative ps-5">
              <span className="absolute start-1 text-accent-500" aria-hidden>
                •
              </span>
              {linea.replace(/^[-*•]\s+/, '')}
            </p>
          );
        }
        const marcado = /^#+\s+/.test(linea);
        const letras = linea.replace(/[^\p{L}]/gu, '');
        // Solo cuenta como título en MAYÚSCULAS si todas sus letras tienen mayúscula y minúscula
        // (en japonés o árabe, una sigla como «HIPAA» dentro de la frase no la vuelve título).
        const todasConCaja = [...letras].every((c) => c.toLowerCase() !== c.toUpperCase());
        if (marcado || (letras.length >= 3 && todasConCaja && letras === letras.toUpperCase() && linea.length <= 90)) {
          return (
            <h3 key={i} className="pt-3 text-sm font-bold uppercase tracking-wide text-brand-800 rtl:tracking-normal">
              {linea.replace(/^#+\s+/, '')}
            </h3>
          );
        }
        return <p key={i}>{linea}</p>;
      })}
    </div>
  );
}
