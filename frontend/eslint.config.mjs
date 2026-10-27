import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Los textos del panel llevan comillas y apóstrofos en cinco idiomas.
      'react/no-unescaped-entities': 'off',
      // Las fotos clínicas se sirven con permiso desde /api/archivos: no pasan
      // por el optimizador de imágenes.
      '@next/next/no-img-element': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'src/generated/**']),
]);

export default eslintConfig;
