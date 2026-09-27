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
} from '@phosphor-icons/react';
import { useTechCare } from './shell';
import { Announcements } from './announcements';
import { Avatar, Badge, Modal, useData, date, Loading, ErrorState } from './ui';
import { BoothDetails } from './booth-content';
import type { Post, Guide, Booth } from '@/lib/types';
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
        {guide.steps.map((step) => (
          <li key={step}>{step}</li>
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
      className: 'blue',
    },
    {
      title: 'Explore guides',
      icon: BookOpen,
      href: '/guides',
      className: 'lavender',
    },
    {
      title: 'Visit the booth',
      icon: Toolbox,
      href: '/booth',
      className: 'gold',
    },
    {
      title: 'Meet the community',
      icon: Users,
      href: '/members',
      className: 'green',
    },
  ];
  return (
    <div className="home-page">
      <section className="welcome-hero">
        <div className="hero-copy">
          <h1>
            A little help.
            <br />A lot of <span>care.</span>
          </h1>
          <p>Ask the community, follow a guide, or get help on campus.</p>
          <div className="hero-actions">
            <button className="button primary" onClick={ask}>
              <ChatCircleDots size={19} aria-hidden="true" /> Ask a Question
            </button>
            <Link href="/guides" className="button secondary">
              <BookOpen size={18} aria-hidden="true" /> Explore guides
            </Link>
          </div>
        </div>
        <Announcements />
      </section>
      <section className="quick-links" aria-label="Ways TechCare can help">
        {actions.map((a) => (
          <Link key={a.href} href={a.href} className="quick-link">
            <span className={`action-icon ${a.className}`}>
              <a.icon size={22} weight="regular" aria-hidden="true" />
            </span>
            <span>
              <h2>{a.title}</h2>
            </span>
          </Link>
        ))}
      </section>
      <div className="home-columns">
        <div className="home-primary">
          <section className="guides-section">
            <div className="section-heading">
              <div>
                <h2>Helpful guides</h2>
              </div>
              <Link href="/guides" className="action-link">
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
          <section className="recent-discussions">
            <div className="section-heading">
              <div>
                <h2>Community questions</h2>
              </div>
              <Link href="/discussion" className="action-link">
                <ChatCircleDots size={18} aria-hidden="true" /> View all
              </Link>
            </div>
            {feed.loading ? (
              <Loading />
            ) : feed.error ? (
              <ErrorState message={feed.error} retry={feed.reload} />
            ) : feed.data?.posts.length ? (
              <div className="discussion-preview">
                {feed.data.posts.slice(0, 3).map((p) => (
                  <Link
                    className="discussion-preview-row"
                    key={p.id}
                    href={`/discussion/${p.id}`}
                  >
                    <Avatar user={p} />
                    <div>
                      <Badge>{p.category}</Badge>
                      <h3>{p.title}</h3>
                      <p>
                        {p.name} <span>·</span> {date(p.created)}
                      </p>
                    </div>
                    <span className="reply-count action-link small">
                      <ChatCircleDots size={18} />
                      {p.replies}
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
        </div>
        <aside className="home-secondary">
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
            <Link href="/privacy" className="action-link">
              <ShieldCheck size={18} aria-hidden="true" /> Community guidelines
            </Link>
          </section>
        </aside>
      </div>
      {guide !== null && <GuideDetail guide={guide} close={() => setGuide(null)} />}
    </div>
  );
}
