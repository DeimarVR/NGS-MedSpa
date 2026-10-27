type Nivel = 'info' | 'warn' | 'error' | 'debug';

function emitir(nivel: Nivel, ambito: string, mensaje: string, meta?: unknown) {
  const linea = `[${new Date().toISOString()}] ${nivel.toUpperCase()} (${ambito}) ${mensaje}`;
  const args = meta === undefined ? [linea] : [linea, meta];
  if (nivel === 'error') console.error(...args);
  else if (nivel === 'warn') console.warn(...args);
  else console.log(...args);
}

export function createLogger(ambito: string) {
  return {
    info: (mensaje: string, meta?: unknown) => emitir('info', ambito, mensaje, meta),
    warn: (mensaje: string, meta?: unknown) => emitir('warn', ambito, mensaje, meta),
    error: (mensaje: string, meta?: unknown) => emitir('error', ambito, mensaje, meta),
    debug: (mensaje: string, meta?: unknown) => {
      if (process.env.NODE_ENV !== 'production') emitir('debug', ambito, mensaje, meta);
    },
  };
}
