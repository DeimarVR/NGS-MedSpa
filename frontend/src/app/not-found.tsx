import Link from 'next/link';
import './globals.css';

/** Página no encontrada FUERA de un idioma (por ejemplo, /xyz.php). */
export default function NotFound() {
  return (
    <html lang="en">
      <body>
        <main style={{ display: 'grid', minHeight: '100vh', placeItems: 'center', textAlign: 'center', padding: 24 }}>
          <div>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: 64, color: '#9c6b53', margin: 0 }}>404</p>
            <p>Page not found · Página no encontrada</p>
            <Link href="/" style={{ color: '#1b2a47', fontWeight: 700 }}>
              NGS MedSpa →
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
