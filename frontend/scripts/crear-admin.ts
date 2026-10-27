/**
 * Crea el SQL del primer usuario del panel (o de uno más).
 *
 *   npm run crear-admin
 *
 * Pregunta correo, nombre, rol, idioma y contraseña AQUÍ, en tu terminal (la
 * contraseña no se ve al escribirla), y muestra el INSERT con la contraseña ya
 * cifrada. Ese SQL lo corres tú en la base. El script no se conecta a ninguna
 * base ni guarda nada: la contraseña no sale de este computador.
 */
import { createInterface } from 'node:readline';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';

type Interfaz = ReturnType<typeof createInterface> & { _writeToOutput?: (s: string) => void };

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY }) as Interfaz;
let silencio = false;
const escribir = rl._writeToOutput?.bind(rl);
if (escribir) {
  // Con `silencio`, no se repite en pantalla lo que se escribe (la contraseña).
  rl._writeToOutput = (s: string) => {
    if (!silencio || s.includes('\n')) escribir(s);
  };
}
const lineas = rl[Symbol.asyncIterator]();

async function preguntar(texto: string, oculto = false): Promise<string> {
  process.stdout.write(texto);
  silencio = oculto;
  const { value } = await lineas.next();
  silencio = false;
  if (oculto && !process.stdin.isTTY) process.stdout.write('\n');
  return String(value ?? '').trim();
}

function salir(mensaje: string): never {
  console.error(mensaje);
  process.exit(1);
}

const sql = (s: string) => `'${s.replace(/'/g, "''")}'`;

async function main() {
  const correo = (await preguntar('Correo: ')).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) salir('Ese correo no parece válido.');

  const nombre = await preguntar('Nombre completo: ');
  if (nombre.length < 3) salir('El nombre debe tener al menos 3 letras.');

  const rol = ((await preguntar('Rol [ADMIN / PROFESIONAL / RECEPCION] (Enter = ADMIN): ')) || 'ADMIN').toUpperCase();
  if (!['ADMIN', 'PROFESIONAL', 'RECEPCION'].includes(rol)) salir('Rol no válido.');

  const idioma = ((await preguntar('Idioma del panel [es / en / fr / ar / ja] (Enter = en): ')) || 'en').toUpperCase();
  if (!['ES', 'EN', 'FR', 'AR', 'JA'].includes(idioma)) salir('Idioma no válido.');

  const clave = await preguntar('Contraseña (mínimo 10, no se ve al escribir): ', true);
  const otraVez = await preguntar('Repítela: ', true);
  if (clave.length < 10) salir('La contraseña debe tener al menos 10 caracteres.');
  if (clave !== otraVez) salir('Las contraseñas no coinciden.');
  rl.close();

  const hash = await bcrypt.hash(clave, 12);
  const id = `u${randomBytes(12).toString('hex')}`;

  console.log('\n-- Corre esto en la base (Railway → NGS-MedSpa → Data → Query):\n');
  console.log(
    `INSERT INTO users (id, email, "passwordHash", "fullName", role, locale, active, "createdAt", "updatedAt")\n` +
      `VALUES (${sql(id)}, ${sql(correo)}, ${sql(hash)}, ${sql(nombre)}, '${rol}', '${idioma}', true, now(), now())\n` +
      `ON CONFLICT (email) DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash", "fullName" = EXCLUDED."fullName", role = EXCLUDED.role, active = true, "updatedAt" = now();\n`,
  );
}

main().catch((error) => salir(String(error)));
