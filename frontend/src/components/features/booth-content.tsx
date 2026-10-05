'use client';
import { CalendarBlank, MapPin, Toolbox, ShieldCheck } from '@phosphor-icons/react';
import { Badge } from '../ui/ui';
import { ThemedImage } from '../common/themed-image';
import type { Booth } from '@shared/types';

export function BoothDetails({ booth }: { booth: Booth }) {
  const date = booth.date
    ? new Date(`${booth.date}T12:00:00`).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Date to be announced';
  return (
    <div className="booth-details">
      <div>
        <CalendarBlank size={22} />
        <span>
          {date}
          <small>{booth.dateNote}</small>
        </span>
      </div>
      <div>
        <MapPin size={22} />
        <span>
          {booth.venue}
          <small>{booth.hours}</small>
        </span>
      </div>
    </div>
  );
}

export function BoothContent({ booth }: { booth: Booth }) {
  return (
    <article className="managed-booth">
      <div className="booth-page-hero">
        <ThemedImage image={booth.image} alt={booth.alt} />
        <div>
          <Badge tone="gold">{booth.label}</Badge>
          <h2>{booth.title}</h2>
          <p>{booth.description}</p>
          <BoothDetails booth={booth} />
        </div>
      </div>
      <section className="content-section">
        <h2>What to expect</h2>
        <div className="steps-grid">
          {booth.steps.map((step, index) => (
            <article key={index}>
              <span className="step-number">{index + 1}</span>
              <p>{step}</p>
            </article>
          ))}
        </div>
      </section>
      <div className="two-panels">
        {booth.preparation.length > 0 && (
          <section className="panel">
            <Toolbox size={28} />
            <h2>Before you visit</h2>
            <ul className="check-list">
              {booth.preparation.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </section>
        )}
        <section className="panel">
          <ShieldCheck size={28} />
          <h2>Safe support comes first</h2>
          <p className="content-preserve-lines">{booth.safety}</p>
        </section>
      </div>
      {booth.note && <p className="page-note content-preserve-lines">{booth.note}</p>}
    </article>
  );
}
