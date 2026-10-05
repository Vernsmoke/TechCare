import { notFound } from 'next/navigation';
import { AuthPage } from '@/components/features/auth-page';
import { authPaths, type AuthMode } from '@/utils/auth-pages';
import { View } from '@/components/features/views';
const pages = [
  ...Object.values(authPaths).map((path) => path.slice(1)),
  'guides',
  'resources',
  'discussion',
  'members',
  'booth',
  'lostfound',
  'feedback',
  'profile',
  'moderate',
  'admin',
  'privacy',
  'terms',
];
export function generateStaticParams() {
  return pages.map((page) => ({ page }));
}
export default async function Page({ params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  if (!pages.includes(page)) notFound();
  const authMode = (Object.keys(authPaths) as AuthMode[]).find(
    (mode) => authPaths[mode] === `/${page}`,
  );
  if (authMode) return <AuthPage mode={authMode} />;
  return <View page={page} />;
}
