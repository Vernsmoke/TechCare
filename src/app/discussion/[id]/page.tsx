import { notFound } from 'next/navigation';
import { DiscussionThread } from '@/components/discussion';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) < 1) notFound();
  return (
    <div className="inner-page">
      <DiscussionThread key={id} id={Number(id)} />
    </div>
  );
}
