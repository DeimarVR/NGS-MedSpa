import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/**
 * Enlaces y navegación que conservan el idioma. Usar SIEMPRE estos en vez de
 * los de `next/link` y `next/navigation`: un `<Link href="/admin">` normal
 * mandaría al idioma por defecto y la persona perdería el suyo.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
