'use client';
import Link from 'next/link';
import { useState } from 'react';
import {
  ChatCircleDots,
  BookOpen,
  Toolbox,
  Users,
  WifiHigh,
  Desktop,
  Laptop,
  ShieldCheck,
  MapPin,
  SquaresFour,
  ArrowRight,
  CaretDown,
} from '@phosphor-icons/react';
import { useTechCare } from '@/context/techcare-context';
import { Announcements } from './announcements';
import { Avatar, Badge, Modal, date, Loading, ErrorState } from '../ui/ui';
import { useData } from '@/hooks/use-data';
import { BoothDetails } from './booth-content';
import type { Post, Guide, Booth } from '@shared/types';
export const GuideIcon = ({ kind, size = 26 }: { kind: string; size?: number }) =>
  kind === 'wifi' ? (
    <WifiHigh size={size} />
  ) : kind === 'laptop' ? (
    <Laptop size={size} />
  ) : kind === 'shield' ? (
    <ShieldCheck size={size} />
  ) : (
    <Desktop size={size} />
  );
export function GuideDetail({ guide, close }: { guide: Guide; close: () => void }) {
  return (
    <Modal title={guide.title} description={guide.summary} onClose={close}>
      <Badge>{guide.category}</Badge>
      <ol className="guide-steps">
        {guide.steps.map((step, index) => (
          <li key={index}>
            <p>{step}</p>
            {guide.images
              ?.filter((image) => image.step === index + 1)
              .map((image) => (
                <a href={image.url} key={image.url} target="_blank" rel="noopener noreferrer">
                  <img className="step-photo" src={image.url} alt={image.alt} />
                </a>
              ))}
          </li>
        ))}
      </ol>
      <div className="callout">
        <ShieldCheck size={22} />
        <p>Start with safe checks. Stop if you see damage, unusual heat, or a swollen battery.</p>
      </div>
      <Link
        href={`/discussion?category=${encodeURIComponent(guide.category)}`}
        className="button primary"
        onClick={close}
      >
        <ChatCircleDots size={18} aria-hidden="true" /> Discuss this topic
      </Link>
    </Modal>
  );
}
export function Home() {
  const { ask, version } = useTechCare(),
    [guide, setGuide] = useState<Guide | null>(null);

  const library = useData<{ guides: Guide[] }>('guides', version);
  const booths = useData<{ booths: Booth[] }>('booths', version);
  const feed = useData<{ posts: Post[] }>('posts', version);
  const actions = [
    {
      title: 'Browse questions',
      icon: ChatCircleDots,
      href: '/discussion',
    },
    {
      title: 'Explore guides',
      icon: BookOpen,
      href: '/guides',
    },
    {
      title: 'Visit the booth',
      icon: Toolbox,
      href: '/booth',
    },
    {
      title: 'Meet the community',
      icon: Users,
      href: '/members',
    },
  ];
  return (
    <div className="home-page community-home">
      <section className="community-welcome" aria-labelledby="welcome-title">
        <div>
          <span className="community-eyebrow">Your campus tech community</span>
          <h1 id="welcome-title">Find answers with your community.</h1>
          <p>Ask a tech question, compare solutions, and share what worked.</p>
        </div>
        <div className="welcome-actions">
          <button className="button primary" onClick={ask}>
            <ChatCircleDots size={19} aria-hidden="true" /> Ask a Question
          </button>
          <Link className="button secondary" href="/discussion">
            Browse discussions
          </Link>
          <details
            className="explore-menu"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.currentTarget.open = false;
                event.currentTarget.querySelector('summary')?.focus();
              }
            }}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget))
                event.currentTarget.open = false;
            }}
          >
            <summary>
              Explore TechCare <CaretDown size={17} aria-hidden="true" />
            </summary>
            <nav aria-label="Ways TechCare can help">
              {actions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  onClick={(event) =>
                    event.currentTarget.closest('details')?.removeAttribute('open')
                  }
                >
                  <action.icon size={20} aria-hidden="true" />
                  <span>{action.title}</span>
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              ))}
            </nav>
          </details>
        </div>
      </section>
      <div className="home-conversation-grid">
        <section className="recent-discussions discussion-home-feature">
          <div className="section-heading">
            <div>
              <span className="community-eyebrow">Community discussions</span>
              <h2>Questions people are working through</h2>
              <p>Read the latest questions or add your experience to the conversation.</p>
            </div>
            <Link href="/discussion" className="community-link">
              View all discussions <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
          {feed.loading ? (
            <Loading />
          ) : feed.error ? (
            <ErrorState message={feed.error} retry={feed.reload} />
          ) : feed.data?.posts.length ? (
            <div className="discussion-preview">
              {feed.data.posts.slice(0, 5).map((p) => (
                <Link className="discussion-preview-row" key={p.id} href={`/discussion/${p.id}`}>
                  <Avatar user={p} />
                  <div>
                    <Badge>{p.category}</Badge>
                    <h3>{p.title}</h3>
                    <p className="discussion-preview-excerpt">{p.body}</p>
                    <p className="discussion-preview-byline">
                      {p.name} <span>·</span> Last activity {date(p.lastActivity || p.created)}
                    </p>
                  </div>
                  <span className="reply-count action-link small">
                    <ChatCircleDots size={18} />
                    {p.replies} {p.replies === 1 ? 'reply' : 'replies'}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="first-discussion">
              <span className="action-icon blue">
                <ChatCircleDots size={27} weight="regular" />
              </span>
              <div>
                <h3>Be the first to ask.</h3>
                <p>Questions are reviewed before sharing.</p>
                <button className="action-link" onClick={ask}>
                  <ChatCircleDots size={18} aria-hidden="true" /> Start a discussion
                </button>
              </div>
            </div>
          )}
        </section>
        <aside className="landing-announcements" aria-label="Announcements">
          <Announcements />
        </aside>
      </div>

      <div className="home-support-grid">
        <section className="guides-section">
          <div className="section-heading">
            <div>
              <h2>Helpful guides</h2>
            </div>
            <Link href="/guides" className="community-link">
              <SquaresFour size={20} weight="regular" aria-hidden="true" />
              All guides
            </Link>
          </div>
          <div className="guide-grid">
            {library.loading ? (
              <Loading />
            ) : library.error ? (
              <ErrorState message={library.error} retry={library.reload} />
            ) : !library.data?.guides.length ? (
              <p>No guides published yet.</p>
            ) : null}
            {(library.data?.guides || []).slice(0, 4).map((g, i) => (
              <button className="guide-card" key={g.id} onClick={() => setGuide(g)}>
                <span className={`guide-icon tone-${i}`}>
                  <GuideIcon kind={g.icon} />
                </span>
                <h3>{g.title}</h3>
                <span className="guide-meta">
                  {g.time}
                  <span className="action-link small">
                    <BookOpen size={16} aria-hidden="true" /> Read guide
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
        <aside className="home-support-rail" aria-label="Campus news and support">
          <section className="booth-card">
            <span className="booth-icon">
              <Toolbox size={29} weight="regular" />
            </span>
            <h2>Help, in person.</h2>
            {booths.loading ? (
              <Loading />
            ) : booths.error ? (
              <ErrorState message={booths.error} retry={booths.reload} />
            ) : booths.data?.booths[0] ? (
              <>
                <p>{booths.data.booths[0].title}</p>
                <BoothDetails booth={booths.data.booths[0]} />
              </>
            ) : (
              <p>New booth details will appear here when published.</p>
            )}
            <Link href="/booth" className="button booth-button">
              <MapPin size={18} aria-hidden="true" /> Booth details
            </Link>
          </section>
          <section className="community-note">
            <span className="note-icon">
              <ShieldCheck size={25} weight="regular" />
            </span>
            <h3>Learn safely</h3>
            <p>Moderators review questions and replies. Your details stay private.</p>
            <Link href="/privacy" className="community-link">
              <ShieldCheck size={18} aria-hidden="true" /> Community guidelines
            </Link>
          </section>
        </aside>
      </div>
      {guide !== null && <GuideDetail guide={guide} close={() => setGuide(null)} />}
    </div>
  );
}
