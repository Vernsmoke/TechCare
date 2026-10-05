import { notFound } from 'next/navigation';
import { ContentEditorPage, type Kind } from '@/components/features/content-settings';

export default async function Page({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  if (!['guides', 'resources', 'booths'].includes(kind) || (id !== 'new' && !/^\d+$/.test(id)))
    notFound();
  return <ContentEditorPage kind={kind as Kind} id={id} />;
}
