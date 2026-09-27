'use client';
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
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
import { useTechCare } from './shell';
import {
  api,
  useData,
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
} from './ui';
import { categories } from '@/lib/content';
import { defaultBooth } from '@/lib/content-defaults.mjs';
import { campusImages } from '@/lib/campus-images.mjs';
import type { Guide, Booth, Resource, Result } from '@/lib/types';

type Kind = 'guides' | 'resources' | 'booths';
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
  const [editing, setEditing] = useState<Entry | 'new' | null>(null);
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
          <button className="button primary small" onClick={() => setEditing('new')}>
            <Plus size={17} /> Add {section.singular}
          </button>
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
                <button
                  className="button secondary small"
                  disabled={busy}
                  onClick={() => setEditing(entry)}
                  aria-label={`Edit ${entry.title}`}
                >
                  <PencilSimple size={17} /> Edit
                </button>
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
      {editing && (
        <ContentEditor
          kind={kind}
          entry={editing === 'new' ? undefined : editing}
          close={() => setEditing(null)}
        />
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
  const { refresh, notify } = useTechCare();
  const guide = entry as Guide | undefined,
    resource = entry as Resource | undefined,
    booth = entry as Booth | undefined;
  const [type, setType] = useState(resource?.type || 'external');
  const [imageChoice, setImageChoice] = useState('');
  return (
    <Modal
      wide
      title={`${entry ? 'Edit' : 'Add'} ${sections[kind].singular}`}
      description="Published changes appear on the public page. Choose Draft to keep this item hidden."
      onClose={close}
    >
      <Form
        submit="Save content"
        onSubmit={async (values) => {
          const r = await api<Result>(`admin/${kind}`, {
            ...values,
            action: 'save',
            ...(entry ? { id: entry.id, revision: entry.revision } : {}),
          });
          close();
          notify(r.message!);
          refresh();
        }}
      >
        <Field label="Title" name="title" value={entry?.title} min={4} max={120} />
        <label className="field">
          <span>Visibility</span>
          <select aria-label="Visibility" name="status" defaultValue={entry?.status || 'draft'}>
            <option value="draft">Draft — only admins can see this</option>
            <option value="published">Published — visible to everyone</option>
          </select>
        </label>
        {kind === 'guides' && (
          <>
            <TextArea label="Summary" name="summary" value={guide?.summary} min={4} max={500} />
            <Select label="Category" name="category" options={categories} value={guide?.category} />
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
            <TextArea
              label="Steps (one per line, up to 20)"
              name="steps"
              value={guide?.steps.join('\n')}
              min={3}
              max={16020}
            />
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
            <Field label="Source credit" name="author" value={resource?.author} min={2} max={80} />
            <label className="field">
              <span>Media type</span>
              <select
                aria-label="Media type"
                name="type"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="external">External link (including YouTube)</option>
                <option value="image">Image</option>
                <option value="video">Video file</option>
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
                    key="video"
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
                <Upload
                  key={type}
                  label={
                    type === 'video' ? 'Video upload (optional if using a link)' : 'Image upload'
                  }
                  video={type === 'video'}
                />
                {type === 'video' && (
                  <p className="muted">
                    Use a direct MP4/WebM link or upload a video. For YouTube or a video webpage,
                    choose External link.
                  </p>
                )}
              </>
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
    </Modal>
  );
}
