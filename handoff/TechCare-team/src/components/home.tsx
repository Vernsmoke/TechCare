'use client';
import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  ChatCircleDots,
  BookOpen,
  Toolbox,
  Users,
  WifiHigh,
  Desktop,
  Laptop,
  ShieldCheck,
  CalendarBlank,
  MapPin,
  Heart,
  CheckCircle,
} from '@phosphor-icons/react';
import { useTechCare } from './shell';
import { Avatar, Badge, Modal, useData, date, Loading, ErrorState } from './ui';
import { guides } from '@/lib/content';
import type { Post } from '@/lib/types';
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
export function GuideDetail({ index, close }: { index: number; close: () => void }) {
  const guide = guides[index];
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
        Discuss this topic <ArrowRight size={18} />
      </Link>
    </Modal>
  );
}
export function Home() {
  const { ask, hero, version } = useTechCare(),
    [guide, setGuide] = useState<number | null>(null);
  const feed = useData<{ posts: Post[] }>('posts', version);
  const actions = [
    {
      title: 'Ask a question',
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
          <span className="eyebrow">
            <Heart size={16} weight="fill" /> YOUR CAMPUS COMMUNITY
          </span>
          <h1>
            A little help.
            <br />A lot of <span>care.</span>
          </h1>
          <p>Tech help starts here. Learn, ask, connect.</p>
          <div className="hero-actions">
            <button className="button primary" onClick={ask}>
              Ask a Question <ArrowUpRight size={19} />
            </button>
            <Link href="/guides" className="button secondary">
              Explore guides
            </Link>
          </div>
        </div>
        <div className="hero-picture">
          <img
            src={hero}
            alt="Illustration of student volunteers helping a community member with her laptop at a campus support booth"
            fetchPriority="high"
          />
        </div>
      </section>
      <section className="quick-links" aria-label="Ways TechCare can help">
        {actions.map((a) => (
          <Link key={a.href} href={a.href} className="quick-link">
            <span className={`action-icon ${a.className}`}>
              <a.icon size={25} weight="duotone" />
            </span>
            <span>
              <h2>{a.title}</h2>
            </span>
            <ArrowUpRight size={18} className="quick-arrow" />
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
              <Link href="/guides" className="text-link">
                All guides <ArrowRight size={17} />
              </Link>
            </div>
            <div className="guide-grid">
              {guides.map((g, i) => (
                <button className="guide-card" key={g.title} onClick={() => setGuide(i)}>
                  <span className={`guide-icon tone-${i}`}>
                    <GuideIcon kind={g.icon} />
                  </span>
                  <h3>{g.title}</h3>
                  <span className="guide-meta">
                    {g.time}
                    <ArrowUpRight size={18} />
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
              <Link href="/discussion" className="text-link">
                View all <ArrowRight size={17} />
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
                    href={`/discussion?thread=${p.id}`}
                  >
                    <Avatar user={p} />
                    <div>
                      <Badge>{p.category}</Badge>
                      <h3>{p.title}</h3>
                      <p>
                        {p.name} <span>·</span> {date(p.created)}
                      </p>
                    </div>
                    <span className="reply-count">
                      <ChatCircleDots size={18} />
                      {p.replies}
                    </span>
                    <ArrowUpRight size={18} />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="first-discussion">
                <span className="action-icon blue">
                  <ChatCircleDots size={27} weight="duotone" />
                </span>
                <div>
                  <h3>Be the first to ask.</h3>
                  <p>Questions are reviewed before sharing.</p>
                  <button className="text-link" onClick={ask}>
                    Start a discussion <ArrowRight size={17} />
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
        <aside className="home-secondary">
          <section className="booth-card">
            <span className="booth-icon">
              <Toolbox size={29} weight="duotone" />
            </span>
            <h2>Help, in person.</h2>
            <p>Bring your tech questions. We’re here to help.</p>
            <div className="booth-details">
              <div>
                <CalendarBlank size={20} />
                <span>
                  October 16, 2026<small>Planned · subject to approval</small>
                </span>
              </div>
              <div>
                <MapPin size={20} />
                <span>
                  On campus<small>Venue and hours to be confirmed</small>
                </span>
              </div>
            </div>
            <Link href="/booth" className="button booth-button">
              Booth details <ArrowUpRight size={18} />
            </Link>
          </section>
          <section className="community-note">
            <span className="note-icon">
              <ShieldCheck size={25} weight="duotone" />
            </span>
            <h3>Learn safely</h3>
            <p>
              Moderators review questions and replies. Your details stay private.
            </p>
            <Link href="/privacy" className="text-link">
              Community guidelines <ArrowUpRight size={15} />
            </Link>
          </section>
          <div className="care-note">
            <CheckCircle size={18} />
            <span>Student-led. Community-minded.</span>
          </div>
        </aside>
      </div>
      {guide !== null && <GuideDetail index={guide} close={() => setGuide(null)} />}
    </div>
  );
}
