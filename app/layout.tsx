import type { ReactNode } from 'react';

// El <html> vive en app/[locale]/layout.tsx para poder fijar lang por idioma.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
