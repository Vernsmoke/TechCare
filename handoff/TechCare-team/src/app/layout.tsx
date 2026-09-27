import type { Metadata } from 'next';
import '@fontsource-variable/manrope';
import './globals.css';
import { Shell } from '@/components/shell';
import { connection } from 'next/server';
import { cookies } from 'next/headers';
import { one } from '@/lib/server/db.mjs';
export const metadata: Metadata = {
  title: { default: 'TechCare | Technology, together', template: '%s | TechCare' },
  description:
    'A campus and community technology support project. Find safe guides, ask reviewed questions, and connect with your community.',
};
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const cookieStore = await cookies();
  const theme = cookieStore.get('techcare-theme')?.value === 'dark' ? 'dark' : 'light';
  const logo = one("SELECT value FROM settings WHERE key='logo'")?.value || '';
  return (
    <html lang="en" data-theme={theme}>
      <body>
        <Shell
          initialCollapsed={cookieStore.get('techcare-sidebar')?.value !== 'expanded'}
          initialTheme={theme}
          initialLogo={logo}
        >
          {children}
        </Shell>
      </body>
    </html>
  );
}
