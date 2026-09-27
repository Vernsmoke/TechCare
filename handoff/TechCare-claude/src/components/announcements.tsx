'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, CalendarBlank } from '@phosphor-icons/react';
import { useTechCare } from './shell';
import { useData, Loading, ErrorState, Modal } from './ui';
import type { Announcement } from '@/lib/types';
import { ThemedImage } from './themed-image';

export function announcementDate(date: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}
export function Announcements() {
  const { version, hero, user } = useTechCare();
  const result = useData<{ announcements: Announcement[] }>('announcements', version);
  const [selected, setSelected] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const items = result.data?.announcements || [];
  const index = Math.max(
    0,
    items.findIndex((item) => item.id === selected),
  );
  const item = items[index];
  return (
    <section className="announcements" aria-label="Announcements" aria-roledescription="carousel">
      <div className="announcements-heading">
        <h2>Announcements</h2>
        {items.length > 1 && (
          <div className="announcement-controls">
            <button
              className="icon-button"
              aria-label="Previous announcement"
              onClick={() => setSelected(items[(index - 1 + items.length) % items.length].id)}
            >
              <ArrowLeft size={20} />
            </button>
            <span aria-live="polite" aria-atomic="true">
              {index + 1} / {items.length}
            </span>
            <button
              className="icon-button"
              aria-label="Next announcement"
              onClick={() => setSelected(items[(index + 1) % items.length].id)}
            >
              <ArrowRight size={20} />
            </button>
          </div>
        )}
      </div>
      {result.loading ? (
        <div className="announcement-placeholder">
          <Loading />
        </div>
      ) : result.error ? (
        <ErrorState message="Announcements could not load." retry={result.reload} />
      ) : item ? (
        <div className={`announcement-stack ${items.length > 1 ? 'has-layers' : ''}`}>
          {items.length > 1 && <div className="announcement-back" aria-hidden="true" />}
          <article
            className="announcement-card"
            aria-label={`${index + 1} of ${items.length}`}
            aria-roledescription="slide"
          >
            <button
              className="announcement-image"
              onClick={() => setExpanded(true)}
              aria-label={`Enlarge image: ${item.title}`}
            >
              <ThemedImage key={item.image} image={item.image} alt={item.alt} />
            </button>
            <div className="announcement-copy" aria-live="polite" aria-atomic="true">
              {item.date && (
                <time dateTime={item.date}>
                  <CalendarBlank size={17} />
                  {announcementDate(item.date)}
                </time>
              )}
              <h3>{item.title}</h3>
              {item.description && <p>{item.description}</p>}
              {item.link && (
                <a className="text-link" href={item.link} target="_blank" rel="noopener noreferrer">
                  View details <ArrowUpRight size={18} />
                  <span className="sr-only"> (opens a new tab)</span>
                </a>
              )}
            </div>
          </article>
        </div>
      ) : (
        <article className="announcement-card announcement-empty">
          <div className="announcement-image">
            <ThemedImage
              key={hero}
              image={hero}
              alt="TechCare volunteers helping at a campus support booth"
            />
          </div>
          <div className="announcement-copy">
            <h3>Campus updates</h3>
            <p>No announcements right now.</p>
            {user?.role === 'admin' && (
              <Link className="text-link" href="/admin">
                Add an announcement <ArrowRight size={18} />
              </Link>
            )}
          </div>
        </article>
      )}
      {expanded && item && (
        <Modal
          title={item.title}
          description={item.description || undefined}
          onClose={() => setExpanded(false)}
          wide
        >
          <div className="announcement-full-image">
            <ThemedImage key={item.image} image={item.image} alt={item.alt} />
          </div>
          {item.date && (
            <p>
              <time dateTime={item.date}>{announcementDate(item.date)}</time>
            </p>
          )}
          {item.link && (
            <a
              href={item.link}
              className="button primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              View details <ArrowUpRight size={18} />
              <span className="sr-only"> (opens a new tab)</span>
            </a>
          )}
        </Modal>
      )}
    </section>
  );
}
