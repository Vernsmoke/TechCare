import { notFound } from 'next/navigation';
import { AnnouncementEditorPage } from '@/components/features/announcement-settings';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id !== 'new' && !/^\d+$/.test(id)) notFound();
  return <AnnouncementEditorPage id={id} />;
}
