import { notFound } from 'next/navigation';
import { View } from '@/components/views';
const pages = [
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
];
export function generateStaticParams() {
  return pages.map((page) => ({ page }));
}
export default async function Page({ params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  if (!pages.includes(page)) notFound();
  return <View page={page} />;
}
