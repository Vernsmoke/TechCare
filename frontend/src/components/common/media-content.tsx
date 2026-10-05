'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ImageSquare,
  Plus,
  Trash,
  PlayCircle,
  ArrowSquareOut,
} from '@phosphor-icons/react';
import { Field, TextArea, Upload } from '../ui/ui';
import type { Guide } from '@shared/types';

export function EditorFrame({
  title,
  description,
  back = '/admin',
  children,
}: {
  title: string;
  description: string;
  back?: string;
  children: ReactNode;
}) {
  const dirty = useRef(false);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (dirty.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    const click = (event: MouseEvent) => {
      const a = (event.target as HTMLElement).closest('a');
      if (
        dirty.current &&
        a &&
        a.target !== '_blank' &&
        a.href !== location.href &&
        !window.confirm('Leave this page? Your unsaved changes will be lost.')
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const saved = () => {
      dirty.current = false;
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', click, true);
    window.addEventListener('techcare-editor-saved', saved);
    return () => {
      window.removeEventListener('beforeunload', unload);
      document.removeEventListener('click', click, true);
      window.removeEventListener('techcare-editor-saved', saved);
    };
  }, []);
  return (
    <div
      className="editor-page"
      onChangeCapture={() => {
        dirty.current = true;
      }}
      onInputCapture={() => {
        dirty.current = true;
      }}
      onClickCapture={(event) => {
        if ((event.target as HTMLElement).closest('[data-edit]')) dirty.current = true;
      }}
    >
      <Link href={back} className="action-link editor-back">
        <ArrowLeft size={18} /> Back to{' '}
        {back === '/admin'
          ? 'content management'
          : back === '/moderate'
            ? 'moderation'
            : 'Lost & Found'}
      </Link>
      <header className="editor-heading">
        <span className="eyebrow">TECHCARE / CREATE & SHARE</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <div className="editor-layout">
        <section className="editor-canvas">{children}</section>
        <aside className="editor-notes">
          <ImageSquare size={32} />
          <h2>Make it easy to understand.</h2>
          <p>Use a clear title, helpful details, and photos that show what matters.</p>
          <hr />
          <h3>Before you share</h3>
          <p>
            Check your previews. Keep private details out of photos and text. Credit the source when
            sharing someone else’s work.
          </p>
          <p className="muted">
            Images: up to 3 MB each.
            <br />
            Videos: MP4 or WebM, up to 20 MB.
          </p>
        </aside>
      </div>
    </div>
  );
}

export function GuideSteps({ guide }: { guide?: Guide }) {
  const [steps, setSteps] = useState(() =>
    (guide?.steps || ['']).map((text, i) => ({
      key: i,
      text,
      image: guide?.images?.find((image) => image.step === i + 1),
    })),
  );
  const next = useRef(steps.length);
  return (
    <section className="step-builder">
      <div className="section-heading">
        <div>
          <h2>Step-by-step instructions</h2>
          <p>Keep each step focused. Add a photo where it helps.</p>
        </div>
        <span>{steps.length} / 20</span>
      </div>
      <input type="hidden" name="stepCount" value={steps.length} />
      {steps.map((step, i) => (
        <section className="step-editor" key={step.key}>
          <div className="step-editor-heading">
            <h3>
              <span>{i + 1}</span> Step {i + 1}
            </h3>
            <button
              data-edit
              type="button"
              className="icon-button"
              disabled={steps.length === 1}
              aria-label={'Remove step ' + (i + 1)}
              onClick={() => setSteps(steps.filter((_, index) => index !== i))}
            >
              <Trash size={18} />
            </button>
          </div>
          <TextArea
            label={'Instruction ' + (i + 1)}
            name={'step' + i}
            value={step.text}
            min={3}
            max={800}
          />
          <Upload
            name={'stepFile' + i}
            label={'Step ' + (i + 1) + ' image (optional)'}
            initial={step.image?.url}
          />
          <Field
            label={'Step ' + (i + 1) + ' image description'}
            name={'stepAlt' + i}
            required={false}
            value={step.image?.alt}
            max={200}
          />
          <input type="hidden" name={'stepUrl' + i} value={step.image?.url || ''} />
          {step.image && (
            <label className="checkbox-field">
              <input type="checkbox" name={'removeStepImage' + i} value="1" /> Remove saved image
            </label>
          )}
        </section>
      ))}
      <button
        data-edit
        type="button"
        className="button secondary"
        disabled={steps.length >= 20}
        onClick={() => setSteps([...steps, { key: next.current++, text: '', image: undefined }])}
      >
        <Plus size={18} /> Add a step
      </button>
    </section>
  );
}

export function mediaEmbed(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return '';
    if (['www.youtube.com', 'youtube.com', 'm.youtube.com', 'youtu.be'].includes(parsed.hostname)) {
      const id =
        parsed.hostname === 'youtu.be'
          ? parsed.pathname.slice(1)
          : parsed.searchParams.get('v') ||
            parsed.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1];
      if (id && /^[\w-]{11}$/.test(id)) return 'https://www.youtube-nocookie.com/embed/' + id;
    }
    if (['vimeo.com', 'www.vimeo.com'].includes(parsed.hostname) && /^\/\d+$/.test(parsed.pathname))
      return 'https://player.vimeo.com/video' + parsed.pathname;
  } catch {
    /* Invalid links are rejected by the form and API. */
  }
  return '';
}
export function MediaDisplay({
  type,
  url,
  title,
  cover,
}: {
  type: string;
  url: string;
  title: string;
  cover?: string;
}) {
  const [play, setPlay] = useState(false);
  const embed = mediaEmbed(url);
  if (type === 'image')
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="media-image">
        <img src={url} alt={title} loading="lazy" />
      </a>
    );
  if (embed)
    return play ? (
      <iframe
        className="media-video"
        src={embed}
        title={title}
        allow="fullscreen; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    ) : (
      <button type="button" className="media-link" onClick={() => setPlay(true)}>
        {cover && <img src={cover} alt="" />}
        <PlayCircle size={44} />
        <span>Play video</span>
      </button>
    );
  if (type === 'video')
    return (
      <video
        className="media-video"
        controls
        preload="metadata"
        src={url}
        poster={cover || undefined}
        aria-label={title}
      >
        <a href={url}>Open video</a>
      </video>
    );
  let host = 'Open resource';
  try {
    host = new URL(url).hostname;
  } catch {}
  return (
    <a className="media-link" href={url} target="_blank" rel="noopener noreferrer">
      {cover && <img src={cover} alt="" />}
      <ArrowSquareOut size={32} />
      <strong>{host}</strong>
      <span>Open resource ↗</span>
    </a>
  );
}

export function PhotoGallery({ photos, title }: { photos?: string[] | string; title: string }) {
  const list = typeof photos === 'string' ? (JSON.parse(photos) as string[]) : photos || [];
  return list.length ? (
    <div className="photo-gallery">
      {list.map((url, i) => (
        <a
          key={url}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={'Open photo ' + (i + 1) + ' of ' + title}
        >
          <img src={url} alt={title + ' — photo ' + (i + 1)} loading="lazy" />
        </a>
      ))}
    </div>
  ) : null;
}
