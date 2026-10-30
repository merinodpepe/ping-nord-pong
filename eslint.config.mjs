import next from 'eslint-config-next';

const config = [
  ...next,
  { ignores: ['design/**', 'supabase/**', '.next/**', 'node_modules/**', 'next-env.d.ts', 'playwright-report/**', 'test-results/**'] },
];

export default config;
