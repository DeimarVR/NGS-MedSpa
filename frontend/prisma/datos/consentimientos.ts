/**
 * Consentimientos de EJEMPLO (es, en, fr).
 *
 * Son un punto de partida, NO un documento legal: la clínica debe hacerlos
 * revisar por un abogado con licencia en Texas (y por su director médico)
 * antes de usarlos con clientas. Por eso cada texto empieza avisándolo.
 *
 * Formato del texto (ver `consentimientos/documento.ts`): una línea en
 * MAYÚSCULAS es un título y una que empieza con «- » es una viñeta.
 *
 * Árabe y japonés no van: el PDF solo dibuja el alfabeto latino. Con una
 * clienta que no lea es/en/fr, se usa el inglés con intérprete y se anota.
 */
export interface ConsentimientoInicial {
  kind: 'TOXINA' | 'RELLENO' | 'FOTOS' | 'GENERAL';
  locale: 'ES' | 'EN' | 'FR';
  name: string;
  description: string;
  /** Slugs de los tratamientos donde se sugiere. */
  servicios: string[];
  body: string;
}

const TOXINA = ['toxina-botulinica', 'lip-flip'];
const RELLENO = ['relleno-labios', 'relleno-ojeras', 'relleno-pomulos', 'rinomodelacion', 'menton-mandibula', 'armonizacion-facial', 'lifting-liquido', 'sculptra'];

export const CONSENTIMIENTOS: ConsentimientoInicial[] = [
  /* ------------------------------------------------------------------ ES */
  {
    kind: 'TOXINA',
    locale: 'ES',
    name: 'Consentimiento informado: toxina botulínica',
    description: 'Botox, Dysport y lip flip.',
    servicios: TOXINA,
    body: `MODELO DE EJEMPLO: debe revisarlo un abogado con licencia en Texas y el director médico antes de usarlo.

EL TRATAMIENTO
La toxina botulínica relaja de forma temporal los músculos que forman las líneas de expresión. El efecto empieza entre 3 y 14 días después de la aplicación y suele durar de 3 a 4 meses. Algunos usos estéticos pueden no estar aprobados por la FDA (uso «off-label»); me lo han explicado.

RIESGOS Y EFECTOS POSIBLES
- Enrojecimiento, hinchazón, moretones o dolor en el punto de aplicación.
- Dolor de cabeza leve durante uno o dos días.
- Asimetría o resultado distinto al esperado, que puede requerir un ajuste.
- Caída temporal del párpado o de la ceja.
- Muy rara vez, efectos a distancia (dificultad para tragar, hablar o respirar): debo buscar atención médica de inmediato si ocurren.

CONTRAINDICACIONES QUE HE DECLARADO
- No estoy embarazada ni en periodo de lactancia.
- No tengo enfermedades neuromusculares (como miastenia gravis) ni alergia conocida a los componentes del producto.
- He informado todos mis medicamentos, suplementos y tratamientos estéticos recientes.

CUIDADOS DESPUÉS DEL TRATAMIENTO
- No acostarme ni agachar la cabeza durante 4 horas.
- No masajear ni frotar la zona tratada ese día.
- Evitar ejercicio intenso, sauna y alcohol durante 24 horas.

DECLARACIÓN
He leído este documento, he podido hacer preguntas y me las han respondido. Entiendo que el resultado no se puede garantizar y autorizo el tratamiento de forma libre y voluntaria.`,
  },
  {
    kind: 'RELLENO',
    locale: 'ES',
    name: 'Consentimiento informado: rellenos y bioestimuladores',
    description: 'Ácido hialurónico, Sculptra y perfilado facial.',
    servicios: RELLENO,
    body: `MODELO DE EJEMPLO: debe revisarlo un abogado con licencia en Texas y el director médico antes de usarlo.

EL TRATAMIENTO
Los rellenos dérmicos (como el ácido hialurónico) devuelven volumen y definen zonas del rostro. Los bioestimuladores (como Sculptra) estimulan el colágeno propio y su efecto aparece de forma gradual. La duración varía según el producto, la zona y cada persona.

RIESGOS Y EFECTOS POSIBLES
- Hinchazón, enrojecimiento, moretones y sensibilidad durante varios días.
- Bultos, irregularidades o asimetría, que pueden requerir masaje o un ajuste.
- Infección, o reacción inflamatoria tardía.
- Oclusión vascular: si el producto bloquea un vaso sanguíneo puede dañar la piel. Muy rara vez puede afectar la visión. Es una urgencia y debo avisar de inmediato si noto dolor intenso, piel pálida o morada, o cambios en la vista.
- El ácido hialurónico puede disolverse con hialuronidasa si es necesario.

CONTRAINDICACIONES QUE HE DECLARADO
- No estoy embarazada ni en periodo de lactancia.
- No tengo infección activa, herpes ni lesiones en la zona a tratar.
- He informado alergias, enfermedades autoinmunes, anticoagulantes y tratamientos recientes.

CUIDADOS DESPUÉS DEL TRATAMIENTO
- Evitar maquillaje en la zona por 12 horas.
- Evitar ejercicio intenso, calor extremo y alcohol durante 24 a 48 horas.
- Con Sculptra, seguir las indicaciones de masaje que me den.

DECLARACIÓN
He leído este documento, he podido hacer preguntas y me las han respondido. Entiendo que el resultado no se puede garantizar y autorizo el tratamiento de forma libre y voluntaria.`,
  },
  {
    kind: 'FOTOS',
    locale: 'ES',
    name: 'Autorización de fotografías',
    description: 'Fotos clínicas y, si se marca, su uso en redes y en el sitio web.',
    servicios: [],
    body: `MODELO DE EJEMPLO: debe revisarlo un abogado con licencia en Texas antes de usarlo.

FOTOGRAFÍAS CLÍNICAS
Autorizo a la clínica a tomarme fotografías antes, durante y después de mis tratamientos. Estas fotos forman parte de mi historia clínica, se guardan de forma privada y solo las ve el equipo que me atiende.

USO PROMOCIONAL
Además, autorizo que mis fotos de antes y después se publiquen en el sitio web y en las redes sociales de la clínica, sin mi nombre. La clínica tratará de no mostrar rasgos que permitan identificarme, salvo que yo lo acepte.

MIS DERECHOS
- Esta autorización es voluntaria: firmarla o no, no cambia mi atención.
- Puedo revocarla en cualquier momento por escrito. La revocación no afecta lo que ya se haya publicado antes de recibirla.
- No recibiré pago por el uso de mis fotos.
- Esta autorización se otorga conforme a la ley HIPAA y vence a los cinco años desde la firma, salvo que la revoque antes.

DECLARACIÓN
He leído este documento y he podido hacer preguntas.`,
  },
  {
    kind: 'GENERAL',
    locale: 'ES',
    name: 'Consentimiento general y aviso de privacidad',
    description: 'Para la primera visita.',
    servicios: ['valoracion'],
    body: `MODELO DE EJEMPLO: debe revisarlo un abogado con licencia en Texas antes de usarlo.

ATENCIÓN Y VALORACIÓN
Autorizo al equipo de la clínica a valorarme y a proponerme un plan de tratamiento. Cada tratamiento tendrá su propio consentimiento informado.

MI INFORMACIÓN
- La información que entrego es verdadera y completa: salud, alergias, medicamentos, embarazo o lactancia.
- Avisaré cualquier cambio en mi salud antes de cada visita.

PRIVACIDAD (HIPAA)
He recibido o se me ha ofrecido el Aviso de Prácticas de Privacidad de la clínica, que explica cómo se usa y se protege mi información de salud. Puedo pedir una copia en cualquier momento.

CITAS Y PAGOS
- Si no puedo asistir, avisaré con al menos 24 horas.
- Los precios se confirman en la valoración. Los tratamientos ya realizados no son reembolsables.

DECLARACIÓN
He leído este documento, he podido hacer preguntas y estoy de acuerdo.`,
  },

  /* ------------------------------------------------------------------ EN */
  {
    kind: 'TOXINA',
    locale: 'EN',
    name: 'Informed consent: botulinum toxin',
    description: 'Botox, Dysport and lip flip.',
    servicios: TOXINA,
    body: `SAMPLE TEMPLATE: must be reviewed by a Texas-licensed attorney and the medical director before use.

THE TREATMENT
Botulinum toxin temporarily relaxes the muscles that cause expression lines. Results begin 3 to 14 days after treatment and usually last 3 to 4 months. Some aesthetic uses may not be FDA-approved ("off-label"); this has been explained to me.

POSSIBLE RISKS AND SIDE EFFECTS
- Redness, swelling, bruising or tenderness at the injection sites.
- Mild headache for one or two days.
- Asymmetry or a result different from what I expected, which may need a touch-up.
- Temporary drooping of the eyelid or eyebrow.
- Very rarely, distant spread of toxin effect (trouble swallowing, speaking or breathing): I must seek medical care immediately if this happens.

CONTRAINDICATIONS I HAVE DISCLOSED
- I am not pregnant or breastfeeding.
- I do not have a neuromuscular disorder (such as myasthenia gravis) or a known allergy to any ingredient of the product.
- I have disclosed all my medications, supplements and recent aesthetic treatments.

AFTERCARE
- Stay upright and avoid bending over for 4 hours.
- Do not massage or rub the treated area that day.
- Avoid strenuous exercise, saunas and alcohol for 24 hours.

STATEMENT
I have read this document, I have had the chance to ask questions and they were answered. I understand results cannot be guaranteed, and I freely and voluntarily consent to the treatment.`,
  },
  {
    kind: 'RELLENO',
    locale: 'EN',
    name: 'Informed consent: dermal fillers and biostimulators',
    description: 'Hyaluronic acid, Sculptra and facial contouring.',
    servicios: RELLENO,
    body: `SAMPLE TEMPLATE: must be reviewed by a Texas-licensed attorney and the medical director before use.

THE TREATMENT
Dermal fillers (such as hyaluronic acid) restore volume and define areas of the face. Biostimulators (such as Sculptra) stimulate your own collagen and results appear gradually. How long results last depends on the product, the area and each person.

POSSIBLE RISKS AND SIDE EFFECTS
- Swelling, redness, bruising and tenderness for several days.
- Lumps, irregularities or asymmetry, which may need massage or a touch-up.
- Infection or a delayed inflammatory reaction.
- Vascular occlusion: if product blocks a blood vessel it can damage the skin and, very rarely, affect vision. This is an emergency, and I must report right away any severe pain, pale or purple skin, or vision changes.
- Hyaluronic acid can be dissolved with hyaluronidase if needed.

CONTRAINDICATIONS I HAVE DISCLOSED
- I am not pregnant or breastfeeding.
- I have no active infection, cold sores or lesions in the treatment area.
- I have disclosed allergies, autoimmune conditions, blood thinners and recent treatments.

AFTERCARE
- No makeup on the area for 12 hours.
- Avoid strenuous exercise, extreme heat and alcohol for 24 to 48 hours.
- For Sculptra, follow the massage instructions I am given.

STATEMENT
I have read this document, I have had the chance to ask questions and they were answered. I understand results cannot be guaranteed, and I freely and voluntarily consent to the treatment.`,
  },
  {
    kind: 'FOTOS',
    locale: 'EN',
    name: 'Photography authorization',
    description: 'Clinical photos and, if agreed, their use online.',
    servicios: [],
    body: `SAMPLE TEMPLATE: must be reviewed by a Texas-licensed attorney before use.

CLINICAL PHOTOGRAPHS
I authorize the clinic to take photographs of me before, during and after my treatments. These photos are part of my medical record, are stored privately and are only seen by the team caring for me.

PROMOTIONAL USE
I also authorize the clinic to publish my before-and-after photos on its website and social media, without my name. The clinic will try not to show features that identify me unless I agree.

MY RIGHTS
- This authorization is voluntary: signing it or not does not affect my care.
- I may revoke it at any time in writing. Revocation does not affect anything published before it is received.
- I will not be paid for the use of my photos.
- This authorization is given under HIPAA and expires five years after signing unless I revoke it sooner.

STATEMENT
I have read this document and have had the chance to ask questions.`,
  },
  {
    kind: 'GENERAL',
    locale: 'EN',
    name: 'General consent and privacy notice',
    description: 'For the first visit.',
    servicios: ['valoracion'],
    body: `SAMPLE TEMPLATE: must be reviewed by a Texas-licensed attorney before use.

CARE AND CONSULTATION
I authorize the clinic team to assess me and propose a treatment plan. Each treatment will have its own informed consent.

MY INFORMATION
- The information I provide is true and complete: health, allergies, medications, pregnancy or breastfeeding.
- I will report any change in my health before each visit.

PRIVACY (HIPAA)
I have received, or been offered, the clinic's Notice of Privacy Practices, which explains how my health information is used and protected. I may request a copy at any time.

APPOINTMENTS AND PAYMENTS
- If I cannot attend, I will give at least 24 hours' notice.
- Prices are confirmed at the consultation. Treatments already performed are non-refundable.

STATEMENT
I have read this document, have had the chance to ask questions, and I agree.`,
  },

  /* ------------------------------------------------------------------ FR */
  {
    kind: 'TOXINA',
    locale: 'FR',
    name: 'Consentement éclairé : toxine botulique',
    description: 'Botox, Dysport et lip flip.',
    servicios: TOXINA,
    body: `MODÈLE D'EXEMPLE : doit être revu par un avocat autorisé au Texas et par le directeur médical avant utilisation.

LE TRAITEMENT
La toxine botulique détend temporairement les muscles responsables des rides d'expression. L'effet apparaît 3 à 14 jours après l'injection et dure en général de 3 à 4 mois. Certains usages esthétiques peuvent ne pas être approuvés par la FDA (usage « hors indication ») ; on me l'a expliqué.

RISQUES ET EFFETS POSSIBLES
- Rougeur, gonflement, ecchymoses ou sensibilité aux points d'injection.
- Léger mal de tête pendant un ou deux jours.
- Asymétrie ou résultat différent de celui attendu, pouvant nécessiter une retouche.
- Chute temporaire de la paupière ou du sourcil.
- Très rarement, diffusion à distance (difficulté à avaler, parler ou respirer) : je dois consulter immédiatement si cela se produit.

CONTRE-INDICATIONS DÉCLARÉES
- Je ne suis ni enceinte ni en période d'allaitement.
- Je n'ai pas de maladie neuromusculaire (comme la myasthénie) ni d'allergie connue aux composants du produit.
- J'ai déclaré tous mes médicaments, compléments et soins esthétiques récents.

APRÈS LE TRAITEMENT
- Rester en position verticale et ne pas me pencher pendant 4 heures.
- Ne pas masser ni frotter la zone traitée ce jour-là.
- Éviter le sport intense, le sauna et l'alcool pendant 24 heures.

DÉCLARATION
J'ai lu ce document, j'ai pu poser mes questions et on y a répondu. Je comprends que le résultat ne peut être garanti et je consens au traitement librement et volontairement.`,
  },
  {
    kind: 'RELLENO',
    locale: 'FR',
    name: 'Consentement éclairé : produits de comblement et biostimulateurs',
    description: 'Acide hyaluronique, Sculptra et profilage du visage.',
    servicios: RELLENO,
    body: `MODÈLE D'EXEMPLE : doit être revu par un avocat autorisé au Texas et par le directeur médical avant utilisation.

LE TRAITEMENT
Les produits de comblement (comme l'acide hyaluronique) redonnent du volume et définissent certaines zones du visage. Les biostimulateurs (comme Sculptra) stimulent votre propre collagène et l'effet apparaît progressivement. La durée dépend du produit, de la zone et de chaque personne.

RISQUES ET EFFETS POSSIBLES
- Gonflement, rougeur, ecchymoses et sensibilité pendant plusieurs jours.
- Petites bosses, irrégularités ou asymétrie, pouvant nécessiter un massage ou une retouche.
- Infection ou réaction inflammatoire tardive.
- Occlusion vasculaire : si le produit bloque un vaisseau, la peau peut être abîmée et, très rarement, la vue peut être touchée. C'est une urgence : je dois signaler immédiatement une douleur intense, une peau pâle ou violacée, ou un trouble de la vue.
- L'acide hyaluronique peut être dissous avec de la hyaluronidase si nécessaire.

CONTRE-INDICATIONS DÉCLARÉES
- Je ne suis ni enceinte ni en période d'allaitement.
- Je n'ai ni infection active, ni herpès, ni lésion dans la zone à traiter.
- J'ai déclaré mes allergies, maladies auto-immunes, anticoagulants et soins récents.

APRÈS LE TRAITEMENT
- Pas de maquillage sur la zone pendant 12 heures.
- Éviter le sport intense, la chaleur extrême et l'alcool pendant 24 à 48 heures.
- Avec Sculptra, suivre les consignes de massage données.

DÉCLARATION
J'ai lu ce document, j'ai pu poser mes questions et on y a répondu. Je comprends que le résultat ne peut être garanti et je consens au traitement librement et volontairement.`,
  },
  {
    kind: 'FOTOS',
    locale: 'FR',
    name: 'Autorisation de photographies',
    description: 'Photos cliniques et, si accepté, leur diffusion en ligne.',
    servicios: [],
    body: `MODÈLE D'EXEMPLE : doit être revu par un avocat autorisé au Texas avant utilisation.

PHOTOS CLINIQUES
J'autorise la clinique à me photographier avant, pendant et après mes soins. Ces photos font partie de mon dossier médical, sont conservées de façon privée et ne sont vues que par l'équipe qui me suit.

USAGE PROMOTIONNEL
J'autorise aussi la clinique à publier mes photos avant-après sur son site web et ses réseaux sociaux, sans mon nom. La clinique évitera de montrer des traits permettant de m'identifier, sauf si je l'accepte.

MES DROITS
- Cette autorisation est volontaire : la signer ou non ne change pas mes soins.
- Je peux la révoquer à tout moment par écrit. La révocation ne concerne pas ce qui a été publié avant sa réception.
- Je ne serai pas rémunérée pour l'utilisation de mes photos.
- Cette autorisation est donnée selon la loi HIPAA et expire cinq ans après la signature, sauf révocation antérieure.

DÉCLARATION
J'ai lu ce document et j'ai pu poser mes questions.`,
  },
  {
    kind: 'GENERAL',
    locale: 'FR',
    name: 'Consentement général et avis de confidentialité',
    description: 'Pour la première visite.',
    servicios: ['valoracion'],
    body: `MODÈLE D'EXEMPLE : doit être revu par un avocat autorisé au Texas avant utilisation.

SOINS ET CONSULTATION
J'autorise l'équipe de la clinique à m'évaluer et à me proposer un plan de traitement. Chaque traitement aura son propre consentement éclairé.

MES INFORMATIONS
- Les informations que je donne sont vraies et complètes : santé, allergies, médicaments, grossesse ou allaitement.
- Je signalerai tout changement de mon état de santé avant chaque visite.

CONFIDENTIALITÉ (HIPAA)
J'ai reçu, ou on m'a proposé, l'Avis sur les pratiques de confidentialité de la clinique, qui explique comment mes informations de santé sont utilisées et protégées. Je peux en demander une copie à tout moment.

RENDEZ-VOUS ET PAIEMENTS
- Si je ne peux pas venir, je préviendrai au moins 24 heures à l'avance.
- Les prix sont confirmés lors de la consultation. Les soins déjà réalisés ne sont pas remboursables.

DÉCLARATION
J'ai lu ce document, j'ai pu poser mes questions et je suis d'accord.`,
  },
];
