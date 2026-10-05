import type { Metadata } from 'next';
import '@fontsource-variable/manrope';
import '../assets/styles/globals.css';
import '../assets/styles/claude-theme.css';
import '../assets/styles/announcements.css';
import '../assets/styles/campus-background.css';
import '../assets/styles/discussion.css';
import '../assets/styles/controls.css';
import '../assets/styles/content-editor.css';
import '../assets/styles/community-updates.css';
import '../assets/styles/community-layout.css';
import { ConsentGate } from '@/components/layout/consent-gate';
import { Shell } from '@/components/layout/shell';
import { connection } from 'next/server';
import { cookies } from 'next/headers';
import { one } from '@backend/config/db.mjs';

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
        <ConsentGate initialAccepted={false}>
          <Shell
            initialCollapsed={cookieStore.get('techcare-sidebar')?.value === 'compact'}
            initialTheme={theme}
            initialLogo={logo}
          >
            {children}
          </Shell>
        </ConsentGate>
      </body>
    </html>
  );
}
