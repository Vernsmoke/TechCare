import type { Metadata } from 'next';
import { AskQuestionPage } from '@/components/features/ask-question';

export const metadata: Metadata = {
  title: 'Ask a Question',
  description: 'Ask the TechCare community for help with a technology problem.',
};

export default function Page() {
  return <AskQuestionPage />;
}
