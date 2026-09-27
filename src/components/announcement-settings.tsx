'use client';
import { useEffect, useId, useState } from 'react';
import { ArrowUp, ArrowDown, ArrowClockwise, Plus } from '@phosphor-icons/react';
import { api, useData, Loading, ErrorState, Modal, Form, Field, TextArea, Upload } from './ui';
import { useTechCare } from './shell';
import type { Announcement, Result } from '@/lib/types';
import { campusImages } from '@/lib/campus-images.mjs';
import { ThemedImage } from './themed-image';

function AnnouncementEditor({
  item,
  close,
  saved,
}: {
  item: Announcement | null;
  close: () => void;
  saved: () => void;
}) {
  const { notify } = useTechCare();
  const visibilityId = useId();
  const sourceId = useId();
  const existingCampusImage = campusImages.find((photo) => photo.image === item?.image);
  const [campusImage, setCampusImage] = useState(existingCampusImage?.key || '');
  const selectedPhoto = campusImages.find((photo) => photo.key === campusImage);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  useEffect(() => {
    if (
      !file ||
      file.size > 3000000 ||
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
    ) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <Modal title={item ? 'Edit announcement' : 'New announcement'} onClose={close}>
      <Form
        submit="Save announcement"
        onSubmit={async (values) => {
          const result = await api<Result>('admin/announcements', {
            ...values,
            action: 'save',
            ...(item ? { id: item.id, revision: item.revision } : {}),
          });
          saved();
          close();
          notify(result.message!);
        }}
      >
        <label className="field">
          <span id={sourceId}>Image source</span>
          <select
            name="campusImage"
            aria-labelledby={sourceId}
            value={campusImage}
            onChange={(event) => {
              setCampusImage(event.target.value);
              setFile(null);
            }}
          >
            <option value="">Upload an image</option>
            {campusImages.map((photo) => (
              <option key={photo.key} value={photo.key}>
                {photo.title}
              </option>
            ))}
          </select>
          <small>Campus photos match light and dark mode.</small>
        </label>
        {!campusImage && (
          <Upload
            label={item && !existingCampusImage ? 'Replace image (optional)' : 'Announcement image'}
            required={!item || !!existingCampusImage}
            onChange={setFile}
          />
        )}
        {(selectedPhoto || preview || (item && !existingCampusImage)) && (
          <div className="announcement-upload-preview">
            <ThemedImage
              image={selectedPhoto?.image || preview || item!.image}
              alt="Announcement image preview"
            />
          </div>
        )}
        <Field label="Title" name="title" min={3} max={100} value={item?.title} />
        <TextArea
          label="Short description (optional)"
          name="description"
          max={280}
          required={false}
          value={item?.description}
        />
        <Field
          key={campusImage}
          label="Image description"
          name="alt"
          min={3}
          max={160}
          value={
            campusImage === existingCampusImage?.key ? item?.alt : selectedPhoto?.alt || item?.alt
          }
          placeholder="Describe what the image shows"
        />
        <Field
          label="Event date (optional)"
          name="date"
          type="date"
          required={false}
          value={item?.date}
        />
        <Field
          label="Details link (optional)"
          name="link"
          type="url"
          max={1000}
          required={false}
          value={item?.link}
          placeholder="https://…"
        />
        <label className="field">
          <span id={visibilityId}>Visibility</span>
          <select
            aria-labelledby={visibilityId}
            name="status"
            defaultValue={item?.status || 'draft'}
          >
            <option value="draft">Draft (hidden)</option>
            <option value="published">Published</option>
          </select>
        </label>
      </Form>
    </Modal>
  );
}
export function AnnouncementSettings() {
  const { version, refresh, notify } = useTechCare();
  const result = useData<{ announcements: Announcement[] }>('admin/announcements', version);
  const [editor, setEditor] = useState<Announcement | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Announcement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const items = result.data?.announcements || [];
  async function change(item: Announcement, action: string, extra: Record<string, string> = {}) {
    setBusy(true);
    setError('');
    try {
      const response = await api<Result>('admin/announcements', {
        action,
        id: item.id,
        revision: item.revision,
        ...extra,
      });
      setDeleting(null);
      refresh();
      notify(response.message!);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel announcement-settings" aria-label="Manage announcements">
      <div className="announcement-settings-heading">
        <div>
          <h2>Announcements</h2>
          <p>Image updates for the homepage. Drafts stay hidden.</p>
        </div>
        <button
          className="button primary"
          disabled={result.loading || !!result.error || items.length >= 12}
          onClick={() => setEditor(null)}
        >
          <Plus size={18} />
          Add announcement
        </button>
      </div>
      {result.loading ? (
        <Loading />
      ) : result.error ? (
        <ErrorState message={result.error} retry={result.reload} />
      ) : !items.length ? (
        <p>No announcements yet. Add your first image update.</p>
      ) : (
        <div className="announcement-admin-list">
          {items.map((item, index) => (
            <article key={item.id} className="announcement-admin-item" aria-label={item.title}>
              <ThemedImage image={item.image} alt={item.alt} />
              <div className="announcement-admin-info">
                <h3>{item.title}</h3>
                <span className="badge">{item.status === 'published' ? 'Published' : 'Draft'}</span>
              </div>
              <div className="announcement-admin-actions">
                <button
                  className="icon-button"
                  disabled={busy || index === 0}
                  aria-label={`Move up: ${item.title}`}
                  onClick={() => change(item, 'move', { direction: 'up' })}
                >
                  <ArrowUp size={19} />
                </button>
                <button
                  className="icon-button"
                  disabled={busy || index === items.length - 1}
                  aria-label={`Move down: ${item.title}`}
                  onClick={() => change(item, 'move', { direction: 'down' })}
                >
                  <ArrowDown size={19} />
                </button>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => setEditor(item)}
                >
                  Edit
                </button>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() =>
                    change(item, 'visibility', {
                      status: item.status === 'published' ? 'draft' : 'published',
                    })
                  }
                >
                  {item.status === 'published' ? 'Hide' : 'Publish'}
                </button>
                <button
                  className="text-button danger"
                  disabled={busy}
                  onClick={() => {
                    setError('');
                    setDeleting(item);
                  }}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {items.length >= 12 && <p>12 announcements saved. Delete an old one to add another.</p>}
      {error && !deleting && (
        <div role="alert" className="error-message">
          {error}
          <button
            className="action-link"
            onClick={() => {
              setError('');
              result.reload();
            }}
          >
            <ArrowClockwise size={18} aria-hidden="true" /> Refresh list
          </button>
        </div>
      )}
      {editor !== undefined && (
        <AnnouncementEditor item={editor} close={() => setEditor(undefined)} saved={refresh} />
      )}
      {deleting && (
        <Modal
          title="Delete announcement?"
          description={deleting.title}
          onClose={() => {
            if (!busy) setDeleting(null);
          }}
        >
          <p>This removes the announcement. Uploaded images are also deleted.</p>
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          <div className="button-row">
            <button className="button secondary" disabled={busy} onClick={() => setDeleting(null)}>
              Cancel
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={() => change(deleting, 'delete')}
            >
              {busy ? 'Deleting…' : 'Delete announcement'}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
