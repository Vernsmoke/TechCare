'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Link as LinkIcon,
  Plus,
  CalendarBlank,
  Pause,
  Play,
} from '@phosphor-icons/react';
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
  const carousel = useRef<HTMLElement>(null);
  const [playing, setPlaying] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const items = result.data?.announcements || [];
  const index = Math.max(
    0,
    items.findIndex((item) => item.id === selected),
  );
  const item = items[index];
  const rotating =
    playing &&
    !hovered &&
    !focused &&
    !expanded &&
    visible &&
    pageVisible &&
    !result.loading &&
    !result.error &&
    items.length > 1;

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPlaying(!preference.matches);
    const updateVisibility = () => setPageVisible(!document.hidden);
    updatePreference();
    updateVisibility();
    preference.addEventListener('change', updatePreference);
    document.addEventListener('visibilitychange', updateVisibility);
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting && entry.intersectionRatio >= 0.1),
      { threshold: [0, 0.1] },
    );
    if (carousel.current) observer.observe(carousel.current);
    return () => {
      preference.removeEventListener('change', updatePreference);
      document.removeEventListener('visibilitychange', updateVisibility);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!rotating) return;
    const timer = window.setTimeout(() => {
      setSelected(items[(index + 1) % items.length].id);
    }, 7000);
    return () => window.clearTimeout(timer);
  }, [rotating, index, items]);

  return (
    <section
      ref={carousel}
      className="announcements"
      aria-label="Announcements"
      aria-roledescription="carousel"
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      <div className="announcements-heading">
        <h2>Announcements</h2>
        {items.length > 1 && (
          <div className="announcement-controls">
            <button
              className="icon-button"
              aria-label={
                playing ? 'Pause automatic announcements' : 'Start automatic announcements'
              }
              onClick={() => setPlaying((value) => !value)}
            >
              {playing ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <button
              className="icon-button"
              aria-label="Previous announcement"
              onClick={() => setSelected(items[(index - 1 + items.length) % items.length].id)}
            >
              <ArrowLeft size={20} />
            </button>
            <span aria-live={rotating ? 'off' : 'polite'} aria-atomic="true">
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
        <div
          className={`announcement-stack ${items.length > 1 ? 'has-layers' : ''}`}
          aria-live={rotating ? 'off' : 'polite'}
        >
          {items.length > 1 && <div className="announcement-back" aria-hidden="true" />}
          {items.map((slide, slideIndex) => (
            <article
              key={slide.id}
              className={`announcement-card announcement-slide ${slideIndex === index ? 'is-active' : ''}`}
              aria-hidden={slideIndex !== index}
              inert={slideIndex !== index}
              aria-label={`${slideIndex + 1} of ${items.length}: ${slide.title}`}
              aria-roledescription="slide"
            >
              <button
                className="announcement-image"
                onClick={() => setExpanded(true)}
                aria-label={`Enlarge image: ${slide.title}`}
              >
                <ThemedImage key={slide.image} image={slide.image} alt={slide.alt} />
              </button>
              <div className="announcement-copy">
                {slide.date && (
                  <time dateTime={slide.date}>
                    <CalendarBlank size={17} />
                    {announcementDate(slide.date)}
                  </time>
                )}
                <h3>{slide.title}</h3>
                {slide.description && <p>{slide.description}</p>}
                {slide.link && (
                  <a
                    className="action-link"
                    href={slide.link}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <LinkIcon size={18} aria-hidden="true" /> View details
                    <span className="sr-only"> (opens a new tab)</span>
                  </a>
                )}
              </div>
            </article>
          ))}
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
              <Link className="action-link" href="/admin">
                <Plus size={18} aria-hidden="true" /> Add an announcement
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
              <LinkIcon size={18} aria-hidden="true" /> View details
              <span className="sr-only"> (opens a new tab)</span>
            </a>
          )}
        </Modal>
      )}
    </section>
  );
}
