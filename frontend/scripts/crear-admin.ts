/**
 * Crea el primer usuario del panel (o uno más).
 *
 *   npm run crear-admin
 *
 * Pregunta correo, nombre, rol, idioma y contraseña AQUÍ, en tu terminal (la
 * contraseña no se ve al escribirla) y la guarda ya cifrada. Si el `.env` tiene
 * DATABASE_URL, ofrece crearlo directo en esa base; si no, muestra el INSERT
 * para correrlo a mano. La contraseña nunca sale de este computador.
 */
import 'dotenv/config';
import { createInterface } from 'node:readline';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';

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

  const url = process.env.DATABASE_URL?.trim();
  const directo = url ? !/^n/i.test(await preguntar(`¿Lo creo directo en la base del .env (${new URL(url).host})? [S/n]: `)) : false;
  rl.close();

  const hash = await bcrypt.hash(clave, 12);
  const id = `u${randomBytes(12).toString('hex')}`;
  const insert =
    `INSERT INTO users (id, email, "passwordHash", "fullName", role, locale, active, "createdAt", "updatedAt")\n` +
    `VALUES ($1, $2, $3, $4, $5, $6, true, now(), now())\n` +
    `ON CONFLICT (email) DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash", "fullName" = EXCLUDED."fullName", role = EXCLUDED.role, active = true, "updatedAt" = now()`;
  const valores = [id, correo, hash, nombre, rol, idioma];

  if (directo && url) {
    const cliente = new Client({ connectionString: url });
    await cliente.connect();
    try {
      await cliente.query(insert, valores);
    } finally {
      await cliente.end();
    }
    console.log(`\nListo: ${correo} ya puede entrar al panel (/admin).`);
    return;
  }

  console.log('\n-- Corre esto en la base (Railway → NGS-MedSpa → Database → Data → Query):\n');
  console.log(`${valores.reduce((texto, v, i) => texto.replace(`$${i + 1}`, () => sql(v)), insert)};\n`);
}

main().catch((error) => salir(String(error)));
