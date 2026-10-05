'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EditorFrame, GuideSteps, MediaDisplay } from '../common/media-content';
import {
  Plus,
  PencilSimple,
  Eye,
  EyeSlash,
  Trash,
  BookOpen,
  PlayCircle,
  Toolbox,
  GearSix,
} from '@phosphor-icons/react';
import { useTechCare } from '@/context/techcare-context';
import {
  Form,
  Field,
  TextArea,
  Select,
  Upload,
  Modal,
  Badge,
  Loading,
  ErrorState,
  Empty,
} from '../ui/ui';
import { api } from '@/services/api';
import { useData } from '@/hooks/use-data';
import { categories } from '@/utils/content';
import { defaultBooth } from '@shared/content-defaults.mjs';
import { campusImages } from '@shared/campus-images.mjs';
import type { Guide, Booth, Resource, Result } from '@shared/types';

export type Kind = 'guides' | 'resources' | 'booths';
type Entry = Guide | Resource | Booth;
const sections = {
  guides: { title: 'Troubleshooting Guides', singular: 'guide', href: '/guides', icon: BookOpen },
  resources: {
    title: 'Video & Media',
    singular: 'media item',
    href: '/resources',
    icon: PlayCircle,
  },
  booths: { title: 'Support Booth', singular: 'booth', href: '/booth', icon: Toolbox },
};

export function ContentSettings({ children }: { children: ReactNode }) {
  const [kind, setKind] = useState<Kind | 'settings'>('guides');
  return (
    <section className="panel content-manager">
      <h2>Page content</h2>
      <p>Create and update what your community sees. Drafts stay private until you publish them.</p>
      <div className="filter-tabs" aria-label="Content sections">
        {(Object.keys(sections) as Kind[]).map((key) => {
          const Icon = sections[key].icon;
          return (
            <button
              key={key}
              aria-pressed={kind === key}
              className={kind === key ? 'active' : ''}
              onClick={() => setKind(key)}
            >
              <Icon size={18} /> {sections[key].title}
            </button>
          );
        })}
        <button
          aria-pressed={kind === 'settings'}
          className={kind === 'settings' ? 'active' : ''}
          onClick={() => setKind('settings')}
        >
          <GearSix size={18} /> App settings
        </button>
      </div>
      {kind === 'settings' ? (
        <div className="admin-app-settings">{children}</div>
      ) : (
        <ContentList key={kind} kind={kind} />
      )}
    </section>
  );
}

function ContentList({ kind }: { kind: Kind }) {
  const { version, refresh, notify } = useTechCare();
  const result = useData<Record<Kind, Entry[]>>(`admin/${kind}`, version);

  const [deleting, setDeleting] = useState<Entry | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const section = sections[kind];
  async function visibility(entry: Entry) {
    setBusy(true);
    setError('');
    try {
      const r = await api<Result>(`admin/${kind}`, {
        action: 'visibility',
        id: entry.id,
        revision: entry.revision,
        status: entry.status === 'published' ? 'draft' : 'published',
      });
      notify(r.message!);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="content-manager-toolbar">
        <h3>{section.title}</h3>
        <div className="content-manager-actions">
          <Link href={section.href} className="button secondary small">
            <Eye size={17} /> View page
          </Link>
          <Link className="button primary small" href={'/admin/content/' + kind + '/new'}>
            <Plus size={17} /> Add {section.singular}
          </Link>
        </div>
      </div>
      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}
      {result.loading ? (
        <Loading />
      ) : result.error ? (
        <ErrorState message={result.error} retry={result.reload} />
      ) : !result.data?.[kind].length ? (
        <Empty title="Ready for your first item">
          Add content, save a draft, and publish when it is ready.
        </Empty>
      ) : (
        <div className="managed-content-list">
          {result.data[kind].map((entry) => (
            <article className="managed-content-row" key={entry.id}>
              <div>
                <h4>{entry.title}</h4>
                <Badge>{entry.status === 'published' ? 'Published' : 'Draft'}</Badge>
              </div>
              <div className="content-manager-actions">
                <Link
                  className="button secondary small"
                  href={'/admin/content/' + kind + '/' + entry.id}
                  aria-label={`Edit ${entry.title}`}
                >
                  <PencilSimple size={17} /> Edit
                </Link>
                <button
                  className="button secondary small"
                  disabled={busy}
                  onClick={() => visibility(entry)}
                  aria-label={`${entry.status === 'published' ? 'Hide' : 'Publish'} ${entry.title}`}
                >
                  {entry.status === 'published' ? <EyeSlash size={17} /> : <Eye size={17} />}
                  {entry.status === 'published' ? 'Hide' : 'Publish'}
                </button>
                <button
                  className="icon-button"
                  disabled={busy}
                  onClick={() => setDeleting(entry)}
                  aria-label={`Delete ${entry.title}`}
                >
                  <Trash size={19} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {deleting && (
        <Modal
          title={`Delete ${section.singular}?`}
          description={`“${deleting.title}” will be permanently removed. You can hide it instead to keep a draft.`}
          onClose={() => setDeleting(null)}
        >
          <Form
            submit="Delete content"
            onSubmit={async () => {
              const r = await api<Result>(`admin/${kind}`, {
                action: 'delete',
                id: deleting.id,
                revision: deleting.revision,
              });
              setDeleting(null);
              notify(r.message!);
              refresh();
            }}
          >
            <button type="button" className="button secondary" onClick={() => setDeleting(null)}>
              Keep content
            </button>
          </Form>
        </Modal>
      )}
    </>
  );
}

function ContentEditor({ kind, entry, close }: { kind: Kind; entry?: Entry; close: () => void }) {
  const { refresh, notify, user } = useTechCare();
  const capabilities = useData<{ videoUploads: boolean }>('settings');
  const guide = entry as Guide | undefined,
    resource = entry as Resource | undefined,
    booth = entry as Booth | undefined;
  const [type, setType] = useState(resource?.type || 'external');
  const [imageChoice, setImageChoice] = useState('');
  const wrapper = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    if (preview)
      wrapper.current?.parentElement
        ?.querySelector('.editor-preview')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [preview]);
  return (
    <EditorFrame
      back={user?.role === 'moderator' ? '/moderate' : '/admin'}
      title={(entry ? 'Edit ' : 'Create ') + sections[kind].singular}
      description="Add your content, check the preview, then save a draft or publish when you’re ready."
    >
      <div ref={wrapper}>
        <div className="editor-toolbar">
          <span>{entry?.status === 'published' ? 'Published item' : 'Draft workspace'}</span>
          <button
            type="button"
            className="button secondary small"
            onClick={() => {
              const form = wrapper.current?.querySelector('form');
              if (form)
                setPreview(
                  Object.fromEntries(
                    [...new FormData(form)].filter(
                      (entry): entry is [string, string] => typeof entry[1] === 'string',
                    ),
                  ),
                );
            }}
          >
            <Eye size={18} /> Preview
          </button>
          <Link className="text-button" href={user?.role === 'moderator' ? '/moderate' : '/admin'}>
            Cancel
          </Link>
        </div>
        <Form
          publishing={user?.role === 'admin'}
          submit="Publish"
          onSubmit={async (values, progress) => {
            let images;
            if (kind === 'guides') {
              const steps = [];
              images = [];
              for (let i = 0; i < Number(values.stepCount); i++) {
                steps.push(values['step' + i]);
                if (
                  values['stepFile' + i] ||
                  (values['stepUrl' + i] && values['removeStepImage' + i] !== '1')
                )
                  images.push({
                    step: i + 1,
                    alt: values['stepAlt' + i],
                    url: values['stepUrl' + i],
                    file: values['stepFile' + i],
                  });
              }
              values.steps = steps.join('\n');
            }
            const payload: Record<string, unknown> = {
              ...values,
              action: 'save',
              ...(images ? { images } : {}),
              ...(entry ? { id: entry.id, revision: entry.revision } : {}),
            };
            for (const key of Object.keys(payload))
              if (/^(stepFile|stepUrl|stepAlt|removeStepImage|stepCount|step\d)/.test(key))
                delete payload[key];
            const r = await api<Result>(
              user?.role === 'moderator' ? 'resource' : 'admin/' + kind,
              payload,
              undefined,
              progress,
            );
            window.dispatchEvent(new Event('techcare-editor-saved'));
            close();
            notify(r.message!);
            refresh();
          }}
        >
          <Field label="Title" name="title" value={entry?.title} min={4} max={120} />
          {kind === 'guides' && (
            <>
              <TextArea label="Summary" name="summary" value={guide?.summary} min={4} max={500} />
              <Select
                label="Category"
                name="category"
                options={categories}
                value={guide?.category}
              />
              <Field
                label="Reading time"
                name="time"
                value={guide?.time || '5 min read'}
                min={2}
                max={40}
              />
              <label className="field">
                <span>Guide icon</span>
                <select aria-label="Guide icon" name="icon" defaultValue={guide?.icon || 'desktop'}>
                  <option value="desktop">Desktop computer</option>
                  <option value="wifi">Wi-Fi</option>
                  <option value="laptop">Laptop</option>
                  <option value="shield">Safety shield</option>
                </select>
              </label>
              <GuideSteps guide={guide} />
            </>
          )}
          {kind === 'resources' && (
            <>
              <TextArea
                label="Description"
                name="description"
                value={resource?.description}
                required={false}
                max={500}
              />
              <Select
                label="Category"
                name="category"
                options={categories}
                value={resource?.category}
              />
              <Field
                label="Source credit"
                name="author"
                value={resource?.author}
                min={2}
                max={80}
              />
              <label className="field">
                <span>Media type</span>
                <select
                  aria-label="Media type"
                  name="type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="external">Website or video link</option>
                  <option value="image">Image</option>
                  <option value="video">Video upload or direct video link</option>
                </select>
              </label>
              {type === 'external' ? (
                <Field
                  key="external"
                  label="HTTPS link"
                  name="url"
                  type="url"
                  value={resource?.type === 'external' ? resource.url : ''}
                  max={2000}
                />
              ) : (
                <>
                  {resource?.type === type && (
                    <p className="muted">
                      A file is already saved. Leave the replacement empty to keep it.
                    </p>
                  )}
                  {type === 'video' && (
                    <Field
                      key="video-url"
                      label="Direct HTTPS video link (optional)"
                      name="url"
                      type="url"
                      required={false}
                      value={
                        resource?.type === 'video' && resource.url.startsWith('https:')
                          ? resource.url
                          : ''
                      }
                      max={2000}
                    />
                  )}
                  {(type !== 'video' || capabilities.data?.videoUploads) && (
                    <Upload
                      key={type}
                      label={
                        type === 'video'
                          ? 'Video upload (optional if using a link)'
                          : 'Image upload'
                      }
                      video={type === 'video'}
                      initial={resource?.type === type ? resource.url : undefined}
                    />
                  )}
                  {type === 'video' && (
                    <p className="muted">
                      {capabilities.data?.videoUploads
                        ? 'Upload a video or paste a direct MP4/WebM link.'
                        : 'Video file uploads need FFprobe configured on the server. You can use a direct MP4/WebM link now.'}{' '}
                      For YouTube, Vimeo, or another video webpage, choose Website or video link.
                    </p>
                  )}
                </>
              )}
            </>
          )}
          {kind === 'resources' && (
            <>
              <Upload name="coverFile" label="Cover image (optional)" initial={resource?.cover} />
              {resource?.cover && (
                <label className="checkbox-field">
                  <input type="checkbox" name="removeCover" value="1" /> Remove saved cover
                </label>
              )}
            </>
          )}
          {kind === 'booths' && (
            <>
              <TextArea
                label="Description"
                name="description"
                value={booth?.description}
                min={4}
                max={1000}
              />
              <Field
                label="Activity status label"
                name="label"
                value={booth?.label || 'Planned campus activity'}
                min={2}
                max={80}
              />
              <Field
                label="Date (optional)"
                name="date"
                type="date"
                required={false}
                value={booth?.date}
              />
              <Field
                label="Date note (optional)"
                name="dateNote"
                required={false}
                value={booth?.dateNote}
                max={160}
              />
              <Field label="Venue" name="venue" value={booth?.venue} min={2} max={160} />
              <Field label="Hours" name="hours" value={booth?.hours} min={2} max={160} />
              <label className="field">
                <span>Booth image</span>
                <select
                  aria-label="Booth image"
                  name="campusImage"
                  value={imageChoice}
                  onChange={(e) => setImageChoice(e.target.value)}
                >
                  <option value="">
                    {booth
                      ? 'Keep current image / upload a replacement'
                      : 'Default illustration / upload an image'}
                  </option>
                  {campusImages.map((image) => (
                    <option key={image.key} value={image.key}>
                      {image.title}
                    </option>
                  ))}
                </select>
              </label>
              {!imageChoice && <Upload label="Replacement image (optional)" />}
              <Field
                label="Image description"
                name="alt"
                value={booth?.alt || defaultBooth.alt}
                min={3}
                max={200}
              />
              <TextArea
                label="What to expect (one step per line, up to 20)"
                name="steps"
                value={(booth?.steps || defaultBooth.steps).join('\n')}
                min={3}
                max={16020}
              />
              <TextArea
                label="Before you visit (one item per line, up to 20)"
                name="preparation"
                value={(booth?.preparation || defaultBooth.preparation).join('\n')}
                required={false}
                max={16020}
              />
              <TextArea
                label="Safety guidance"
                name="safety"
                value={booth?.safety || defaultBooth.safety}
                min={10}
                max={2000}
              />
              <TextArea
                label="Additional note (optional)"
                name="note"
                value={booth?.note ?? defaultBooth.note}
                required={false}
                max={1000}
              />
            </>
          )}
        </Form>
      </div>
      {preview && (
        <section className="editor-preview" aria-label="Content preview">
          <div className="section-heading">
            <h2>Preview</h2>
            <button type="button" className="text-button" onClick={() => setPreview(null)}>
              Close preview
            </button>
          </div>
          <h3>{preview.title || 'Untitled'}</h3>
          <p>{preview.summary || preview.description}</p>
          {kind === 'guides' && (
            <ol className="guide-steps">
              {Array.from({ length: Number(preview.stepCount || 0) }, (_, i) => (
                <li key={i}>
                  <p>{preview['step' + i]}</p>
                  {(() => {
                    const input = wrapper.current?.querySelector<HTMLInputElement>(
                      '[name="stepFile' + i + '"]',
                    );
                    return (
                      <FilePreview
                        file={input?.files?.[0]}
                        fallback={
                          preview['removeStepImage' + i] === '1' ? '' : preview['stepUrl' + i]
                        }
                        alt={preview['stepAlt' + i]}
                      />
                    );
                  })()}
                </li>
              ))}
            </ol>
          )}
          {kind === 'resources' && (
            <>
              <FilePreview
                file={wrapper.current?.querySelector<HTMLInputElement>('[name="file"]')?.files?.[0]}
                alt={preview.title}
              />
              {!wrapper.current?.querySelector<HTMLInputElement>('[name="file"]')?.files
                ?.length && (
                <MediaDisplay
                  type={preview.type}
                  url={preview.url || resource?.url || ''}
                  title={preview.title}
                  cover={resource?.cover}
                />
              )}
            </>
          )}
        </section>
      )}
    </EditorFrame>
  );
}

function FilePreview({ file, fallback, alt }: { file?: File; fallback?: string; alt: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!file) {
      setUrl('');
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  if (!url && !fallback) return null;
  return file?.type.startsWith('video/') ? (
    <video className="media-video" src={url} controls />
  ) : (
    <img className="step-photo" src={url || fallback} alt={alt || 'Step image'} />
  );
}
export function ContentEditorPage({ kind, id }: { kind: Kind; id: string }) {
  const { user, ready, auth } = useTechCare();
  if (!ready) return <Loading />;
  if (!user)
    return (
      <section className="panel">
        <h1>Sign in to manage content</h1>
        <button className="button primary" onClick={() => auth()}>
          Sign in
        </button>
      </section>
    );
  if (user.role === 'moderator' && kind === 'resources' && id === 'new')
    return <StaffResourceEditor />;
  if (user.role !== 'admin')
    return (
      <section className="panel">
        <h1>Administrator access required</h1>
        <Link href="/">Back to home</Link>
      </section>
    );
  return <LoadedEditor kind={kind} id={id} />;
}
function LoadedEditor({ kind, id }: { kind: Kind; id: string }) {
  const result = useData<Record<Kind, Entry[]>>('admin/' + kind);
  const router = useRouter();
  if (result.loading) return <Loading />;
  if (result.error) return <ErrorState message={result.error} retry={result.reload} />;
  const entry = result.data?.[kind].find((item) => item.id === Number(id));
  if (id !== 'new' && !entry)
    return (
      <Empty title="Content not found">
        <Link href="/admin">Back to content management</Link>
      </Empty>
    );
  return <ContentEditor key={id} kind={kind} entry={entry} close={() => router.push('/admin')} />;
}

function StaffResourceEditor() {
  const router = useRouter();
  return <ContentEditor kind="resources" close={() => router.push('/moderate')} />;
}
