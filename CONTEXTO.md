# Contexto del proyecto · NGS MedSpa (panel + landing)

Pega este archivo al inicio del chat nuevo, o conecta la carpeta `D:\Proyectos\NGS-MedSpa` y pide que lo lean.
 
## 1. Qué es

- **Dueño del proyecto:** Solventra. Quien trabaja contigo es **Deimar**. Las respuestas van siempre **en español**.
- **Cliente:** NGS MedSpa DFW (Instagram `@ngsmedspa`), en Dallas – Fort Worth, Texas, EE. UU. Hacen tratamientos estéticos avanzados:
  - Toxina botulínica (Botox, Dysport).
  - Rellenos: labios, pómulos, ojeras, mentón y mandíbula.
  - Rinomodelación sin cirugía y armonización facial.
  - Skin boosters, PRF/PRP, micropunción, peelings y faciales.
- **Formación de la inyectora:** Manchester y Londres (Reino Unido), París (Francia), AAFE (EE. UU.), Canadá, México, Dubái (Emiratos Árabes) y Japón.
- **Qué se construye:**
  1. Un **panel de administración igual al de Dermocapilar** (otro proyecto de Solventra), adaptado a una med spa de EE. UU. **Sin bot de WhatsApp ni asistente con IA:** el cliente no los quiere por ahora.
  2. Una **landing** que parte de `D:\Proyectos\NGS-MedSpa\basico.html`.

## 2. Reglas de trabajo con Deimar (obligatorias)

- **Nada de commit ni push automáticos.** Deimar sube los cambios él mismo. Los archivos se dejan en su carpeta y se verifican con md5 después de copiarlos.
- **Secretos:**
  - Nunca pasar llaves, contraseñas ni valores del `.env` por el chat, ni copiarlos a archivos.
  - Deimar los pone directo en Vercel o en el `.env`.
  - **Nunca** crear archivos tipo `.env.respaldo`.
- **SQL:** se le pasa **en el chat**; él lo corre en producción. No escribir en producción sin él.
- **Cambios de diseño:** mostrar antes una imagen o captura y esperar su visto bueno.
- **Explicar antes de arreglar:** si él lo pide, decir primero qué se entendió.
- **Carpetas limpias:** no dejar archivos temporales en sus carpetas.
- **Varios agentes en paralelo:** solo cuando él pida una prueba o una auditoría.
- **Usuarios de la clínica:** no deben ver funciones de soporte ni de depuración.
- **No correr `npx prettier`.**
- **Comunicación:** respuestas cortas, claras y en español. Suele escribir desde el celular.
- **Cómo entregar:**
  1. Tomar una foto del antes de los archivos de Deimar que se van a tocar.
  2. Comprobar que su versión no cambió.
  3. Hacer los cambios.
  4. Dejar `typecheck` y lint en verde.
  5. Copiar a su carpeta y verificar el md5.

## 3. Tecnología del proyecto nuevo

**Usar las últimas versiones estables.** A la fecha de este documento (27/10/2026):

- **Next.js 16.4.x** (App Router) con **React 19.3**. Revisar con `npm view next version` al crear el proyecto.
- **TypeScript** y **Tailwind CSS** en su última estable.
- **Prisma 7.10.x**, la última estable: la etiqueta `latest` de npm hoy apunta a una 8.0 en RC, así que no se usa. Base PostgreSQL en Railway.
- **Despliegue en Vercel**, con un cron diario para los avisos del día.
- **Archivos:** bucket S3 de Railway. Las fotos clínicas se sirven por una ruta con permisos (`/api/archivos/[...clave]`) y nunca son públicas.
- **Autenticación propia:** JWT + bcrypt, con roles `ADMIN`, `PROFESIONAL` y `RECEPCION`.
- **Otras librerías:**
  - `pdf-lib` para consentimientos, recibos y cotizaciones.
  - `write-excel-file` para exportar a Excel.
  - `zod` para validar.
  - `lucide-react` para los iconos.

### Variables de entorno (solo estas)

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | Postgres |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Sesión del panel |
| `PUBLIC_WEB_URL` | Enlaces en mensajes y PDF |
| `CLINIC_NAME`, `CLINIC_ADDRESS`, `CLINIC_TIMEZONE` (`America/Chicago`) | Datos de la clínica |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Fotos y documentos |
| `CRON_SECRET` | Proteger el cron diario |

Si más adelante se decide enviar recordatorios por WhatsApp, SMS o correo, o cobrar depósitos en línea, se agregan las variables de ese servicio en ese momento, no antes.

## 4. Idiomas

- **Panel y landing en 5 idiomas:**
  - Español y English.
  - Français (París y Canadá).
  - العربية / árabe (Dubái).
  - 日本語 / japonés (Japón).
- **Árabe:** se escribe de derecha a izquierda. Hay que poner `dir="rtl"` y usar estilos con propiedades lógicas (`margin-inline-start` y similares, no `left`/`right` fijos).
- **Textos en un solo sitio:** archivos de traducción por idioma, por ejemplo `messages/es.json`, `en.json`, `fr.json`, `ar.json` y `ja.json`, con la ruta por idioma (`/es`, `/en`…).
- **Fechas, horas y moneda:** se formatean con `Intl` según el idioma; la moneda siempre es USD.
- **Idioma de la clienta:** se guarda en su ficha, para los documentos y avisos que reciba.
- La landing actual solo tiene ES/EN; hay que añadir los otros tres.

## 5. Estructura del proyecto nuevo

```
src/app/[idioma]/(sitio)/   landing (desde basico.html), reservar, cita/[token] (gestionar la cita)
src/app/[idioma]/admin/     panel (sección 6)
src/app/api/                rutas API (sección 7)
src/components/admin/       componentes del panel
src/components/booking/     reserva en línea y gestión de la cita por enlace
src/server/modules/         appointments, patients, clinical (mapa facial), consentimientos,
                            invoices, caja, inventario, retoques
src/server/services/        availability (horario y huecos), avisos (campana del panel)
src/server/lib/             datetime, phone (+1 EE. UU.), prisma, tokens, logger, httpError
src/server/config/env.ts    variables de la sección 3, validadas con zod
src/server/storage.ts       bucket S3
messages/                   traducciones (es, en, fr, ar, ja)
prisma/schema.prisma        modelos (sección 6)
public/media/               video y fotos de la landing
```

## 6. El panel (copiado de Dermocapilar y adaptado)

El código base está en `D:\Proyectos\Dermo Capilar\frontend`. Se copian **solo** las piezas de esta sección; el resto de Dermo no se trae.

**Día a día**

- **Tablero:** la jornada, citas del día, recordatorios de mañana y **retoques pendientes** (nuevo, ver la sección 8).
- **Citas:** agenda por semana y en lista, nueva cita, reagendar, estados (`PENDIENTE`, `CONFIRMADA`, `CANCELADA`, `COMPLETADA`, `NO_ASISTIO`), completar huecos, bloquear días (`Blackout`) y horario (`BusinessHour`).
- **Clientas:** ficha, historial y enlace de seguimiento con token.
- **Mapa facial / control de tratamientos:** reemplaza el control capilar de Dermo (sección 8).
- **Consentimientos:** firma en tablet (`FirmaPad`), PDF y archivo en la ficha.
- **Fotos antes/después:** con comparador. Solo se publican con autorización firmada.

**Dinero**

- **Recibos y cotizaciones** (en Dermo, «Facturación»): estados `BORRADOR`, `EMITIDA`, `PAGADA` y `ANULADA`, pagos y abonos, PDF y exportar a Excel. En USD.
- **Por cobrar:** lo emitido que no se ha pagado.
- **Caja y cierre:** ingresos del día por método de pago y cierre.
- **Inventario por lote** (sección 8).

**Fuera del menú:** Configuración (horario y textos de consentimientos), Mi cuenta (contraseña y firma guardada), Tratamientos (catálogo y precios), Usuarios y roles (solo `ADMIN`) y la bandeja de mensajes del formulario de contacto de la landing.

**Modelos Prisma que se traen:** `User`, `Service`, `Patient`, `TreatmentPlan`, `TreatmentSession`, `SessionPhoto`, `Appointment`, `BusinessHour`, `Blackout`, `PhotoRecord`, `PhotoRecordItem`, `ContactMessage`, `Setting`, `Invoice`, `InvoiceItem`, `Payment`, `CashClose`, `FacialRecord`, `FacialEntry`, `ConsentTemplate`, `SignedConsent`, `Product`, `StockMove`, `ClinicalRecord` y `ClinicalEntry`. Los cambios se describen en la sección 8.

**Roles y menú:** en Dermo están en `src/app/admin/layout.tsx` (`NAV` y `SECCIONES`). Una ruta que no esté en `SECCIONES` queda abierta a todos, así que toda sección tiene que tener dueño.

## 7. Rutas API

- **Autenticación:** `auth/login`, `auth/logout`, `auth/me`, `auth/change-password`.
- **Citas:** `appointments` (+ `[id]`, `reschedule`, `status`, `summary`), `availability`.
- **Clientas:** `patients` (+ `[id]`, `historial`, `regenerate-token`, `eliminar`).
- **Fichas y fotos:** `clinical-records`, `facial`, `sessions` (+ `photos`, `plans`), `photo-records`.
- **Consentimientos:** `consentimientos` (+ `firmas`).
- **Dinero:** `invoices` (+ `estado`, `pagos`, `eliminar`, `exportar`), `por-cobrar` (+ `exportar`), `caja` (+ `dia`, `cierre`).
- **Inventario:** `inventario` (+ `movimientos`, `exportar`).
- **Catálogo y contacto:** `treatments`, `contact-messages`.
- **Archivos:** `uploads` (subida firmada) y `archivos/[...clave]` (servir con permiso).
- **Avisos y cron:** `avisos` y `cron/diario`.
- **Públicas:** `public/services`, `public/availability`, `public/bookings` (+ `[manageToken]`, `cancel`, `confirm`), `public/contact`.

## 8. Adaptación a una med spa de EE. UU.

- **Teléfonos +1 de 10 dígitos:** reescribir `phone.ts`, que en Dermo normaliza números colombianos con 57.
- **Clienta:** no lleva cédula ni EPS. Lleva fecha de nacimiento, alergias, medicamentos, embarazo/lactancia, idioma preferido, cómo nos conoció e Instagram.
- **Recibos en USD:** no aplica la DIAN de Colombia. **Los impuestos se confirman con la clínica.**
- **Mapa facial de aplicación:**
  - Reemplaza `CareType` (`TERAPIAS_CAPILARES` / `TRASPLANTE`) y el `DiagramaCabeza` de Dermo.
  - Son puntos sobre una foto o plantilla del rostro, cada uno con producto (toxina o relleno), unidades o mL, zona, **lote y vencimiento**, y quién lo aplicó.
  - La ficha facial (`FacialRecord`, con Fitzpatrick) se mantiene para piel.
- **Inventario por lote:**
  - Toxina en unidades (viales de 100u o 300u), rellenos por jeringa, con lote y vencimiento.
  - Cada aplicación registrada descuenta del inventario y guarda el lote, para rastrearlo si retiran un producto.
  - Alertas por mínimo y por vencimiento.
- **Retoques:** lista en el tablero de quién ya debe volver (toxina cada ~90 días, rellenos cada ~9 meses, boosters cada 4 semanas), con acción para contactarla. Cómo se le avisa depende de la decisión de la sección 10.
- **Consentimientos:** toxina, rellenos y uso de fotos en redes.
- **Privacidad (HIPAA):** en EE. UU. una med spa maneja información de salud protegida. Revisarlo con el cliente antes de producción, porque puede requerir acuerdos (BAA) con el hosting, la base y el almacenamiento. Es un punto a validar, no asesoría legal.

## 9. La landing

- **Base:** `D:\Proyectos\NGS-MedSpa\basico.html`, un solo archivo. Se pasa a componentes de Next con el sistema de idiomas.
- **Estilo:**
  - Colores: navy `#0F1A2E`, degradado oro rosa `#9C6B53` → `#D8A988` y dorado `#E3B54B` para el Club VIP.
  - Fuentes: Playfair Display (títulos), Montserrat (subtítulos y botones) y Lato (texto).
  - **Iconos de línea en SVG, sin emojis.**
- **Secciones:**
  1. Menú con «Club VIP» resaltado y el botón «Reservas online».
  2. Portada con **video de fondo**: vertical y sin sonido. Hoy va en base64 dentro del HTML; en el proyecto va como archivo en `public/media/` con un póster `.jpg`.
  3. Seis tarjetas de tratamientos.
  4. La guía «Encuentra tu tratamiento ideal», de 2 pasos.
  5. «Nuestra esencia».
  6. Club VIP.
  7. Preguntas frecuentes.
  8. Visítanos.
  9. Pie de página.
  10. Botones flotantes de regalo (promoción) y subir.
  - **Sin botón flotante de WhatsApp:** Deimar lo quitó.
- **Datos y fotos:** dirección, teléfono `(214) 555-0100`, precios, mapa y fotos son **de ejemplo**. No se copian fotos de su Instagram, porque tienen derechos de autor y muchas son caras de pacientes. Se usan las que entregue la clínica.

## 10. Pendiente de decidir con el cliente

- **Recordatorios, confirmaciones y avisos de retoque:** por WhatsApp (solo plantillas de salida, sin bot), por SMS o por correo.
- **Depósito de $50 al reservar:** si se cobra en línea (por ejemplo, con Stripe).
- **Impuestos** en los recibos.
- **Privacidad de datos de salud (HIPAA).**

## 11. Lecciones de Dermocapilar

- **Bucket de Railway:**
  - Si fallan a la vez las fotos viejas y las subidas nuevas con «SignatureDoesNotMatch», son las credenciales `S3_*` de Vercel, no el código.
  - No meter `content-length` en la firma de subida.
  - Al servir un archivo guardado con tipo genérico, usar el tipo según la extensión.
- **Fechas:** todo se calcula en la zona horaria de la clínica («mañana» es el día siguiente en el calendario de la clínica, no «dentro de 24 h»).

## 12. Por dónde empezar

1. Crear el proyecto nuevo con todo propio: repositorio, Vercel, base Postgres, bucket y dominio. No copiar el `.env` de Dermo.
2. Arrancar en Next 16 y traer de Dermo solo lo de las secciones 6 y 7.
3. Montar los 5 idiomas (incluido el árabe de derecha a izquierda).
4. Adaptar a EE. UU.: teléfono, USD, zona horaria, clienta y recibos.
5. Hacer el mapa facial con lote, conectado al inventario.
6. Agregar los retoques al tablero.
7. Pasar la landing a componentes, con el video en `public/media/`.
