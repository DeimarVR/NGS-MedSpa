import type { ReactNode } from 'react';

/**
 * La raíz solo pasa a sus hijos: el `<html>` lo pone `[idioma]/layout.tsx`,
 * que es quien sabe el idioma y si se escribe de derecha a izquierda.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
