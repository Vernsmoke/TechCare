'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, MapPin } from '@phosphor-icons/react';
import { useTechCare } from '@/context/techcare-context';
import {
  PageHeading,
  Loading,
  ErrorState,
  Empty,
  Badge,
  Pagination,
  Form,
  Field,
  TextArea,
  Select,
  Upload,
  date,
} from '../ui/ui';
import { api } from '@/services/api';
import { useData } from '@/hooks/use-data';
import { EditorFrame, PhotoGallery } from '../common/media-content';
import { ItemInquiries } from './community-extras';
import type { Notice, Result } from '@shared/types';

export function LostFoundPage() {
  const { user, auth, version } = useTechCare();
  const [page, setPage] = useState(1),
    [filter, setFilter] = useState('');
  const result = useData<{ reports: Notice[]; hasMore: boolean }>(
    'lost-found?page=' + page + '&kind=' + filter,
    version + (user?.id || 0),
  );
  return (
    <>
      <PageHeading
        title="Let’s help it find its way back"
        description="A photo can make all the difference. Browse reviewed notices or tell the community what’s missing."
        action={
          user ? (
            <Link className="button primary" href="/lostfound/new">
              <Plus size={18} /> Report an item
            </Link>
          ) : (
            <button className="button primary" onClick={() => auth()}>
              Sign in to report an item
            </button>
          )
        }
      />
      <div className="callout">
        <p>
          Contact the reporter privately through a notice, or quote the report number to the campus
          project team. Establish ownership before handing over an item.
        </p>
      </div>
      {user && <ItemInquiries />}
      <div className="filter-tabs" aria-label="Filter item notices">
        {[
          ['', 'All notices'],
          ['lost', 'Lost'],
          ['found', 'Found'],
          ['returned', 'Returned'],
        ].map(([key, label]) => (
          <button
            key={key}
            aria-pressed={filter === key}
            className={filter === key ? 'active' : ''}
            onClick={() => {
              setFilter(key);
              setPage(1);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {result.loading ? (
        <Loading />
      ) : result.error ? (
        <ErrorState message={result.error} retry={result.reload} />
      ) : result.data?.reports.length ? (
        <div className="notice-grid">
          {result.data.reports.map((report) => (
            <NoticeCard key={report.id} report={report} />
          ))}
        </div>
      ) : (
        <Empty title="No notices here yet">
          Reviewed reports will appear here. Try another filter or report an item.
        </Empty>
      )}
      <Pagination page={page} hasMore={result.data?.hasMore || false} onPage={setPage} />
    </>
  );
}
function NoticeCard({ report: r }: { report: Notice }) {
  const { user, auth, notify, refresh } = useTechCare();
  const [contact, setContact] = useState(false),
    [returning, setReturning] = useState(false);
  return (
    <article className="panel notice-card">
      <PhotoGallery photos={r.photos} title={r.item} />
      <div className="post-top">
        <Badge tone={r.returned ? 'green' : r.kind === 'found' ? 'green' : 'gold'}>
          {r.returned ? 'Returned' : r.kind === 'found' ? 'Found' : 'Lost'}
        </Badge>
        <span>Report #{r.id}</span>
      </div>
      <h2>{r.item}</h2>
      <p>{r.details}</p>
      <div className="notice-location">
        <MapPin size={18} />
        {r.location}
      </div>
      <small>
        {r.event_date ? 'Date lost or found: ' + r.event_date : 'Posted ' + date(r.created)}
      </small>
      {!r.returned && (
        <div className="notice-actions">
          <button
            className="button secondary small"
            onClick={() => (user ? setContact(!contact) : auth())}
          >
            Contact privately
          </button>
          {(r.own || (user && user.role !== 'member')) && (
            <button className="text-button" onClick={() => setReturning(!returning)}>
              Mark returned
            </button>
          )}
        </div>
      )}
      {returning && (
        <Form
          submit="Confirm item returned"
          onSubmit={async () => {
            const response = await api<Result>('lost-found/returned', { id: r.id });
            notify(response.message!);
            refresh();
          }}
        >
          <p>Confirm that this item has been returned to its owner.</p>
          <button type="button" className="text-button" onClick={() => setReturning(false)}>
            Cancel
          </button>
        </Form>
      )}
      {contact && (
        <Form
          submit="Send private message"
          onSubmit={async (values) => {
            const response = await api<Result>('item-inquiries', { ...values, id: r.id });
            notify(response.message!);
            setContact(false);
            refresh();
          }}
        >
          <TextArea label="Message to the reporter" name="body" min={10} max={1000} />
          <p className="form-hint">
            Only you, the reporter, and the project team can see this message.
          </p>
          <button type="button" className="text-button" onClick={() => setContact(false)}>
            Cancel
          </button>
        </Form>
      )}
    </article>
  );
}
export function LostFoundEditor() {
  const { user, ready, auth, notify, refresh } = useTechCare();
  const router = useRouter();
  const [photos, setPhotos] = useState(1);
  if (!ready) return <Loading />;
  if (!user)
    return (
      <section className="panel">
        <h1>Report an item</h1>
        <button className="button primary" onClick={() => auth()}>
          Sign in to continue
        </button>
      </section>
    );
  return (
    <EditorFrame
      back="/lostfound"
      title="Report a lost or found item"
      description="Add the details and a few clear photos. Your notice will appear after review, without your contact details."
    >
      <Form
        submit="Send for review"
        onSubmit={async (values, progress) => {
          const response = await api<Result>('lost-found', values, undefined, progress);
          window.dispatchEvent(new Event('techcare-editor-saved'));
          notify(response.message!);
          refresh();
          router.push('/lostfound');
        }}
      >
        <Select label="Report type" name="kind" options={['lost', 'found']} />
        <Field label="Item name" name="item" min={3} max={100} />
        <div className="editor-field-pair">
          <Field label="Location last seen or found" name="location" min={3} max={100} />
          <Field
            label="Date lost or found (optional)"
            name="event_date"
            type="date"
            required={false}
          />
        </div>
        <TextArea
          label="Public description"
          name="details"
          min={10}
          max={500}
          placeholder="Describe the item’s appearance and where it was last seen."
        />
        <section className="step-builder">
          <h2>Item photos</h2>
          <p>Up to four photos. Avoid showing IDs, contact details, or serial numbers.</p>
          {Array.from({ length: photos }, (_, i) => (
            <Upload key={i} name={'photo' + i} label={'Photo ' + (i + 1) + ' (optional)'} />
          ))}
          {photos < 4 && (
            <button
              type="button"
              className="button secondary"
              onClick={() => setPhotos(photos + 1)}
            >
              <Plus size={18} /> Add another photo
            </button>
          )}
        </section>
        <Link href="/lostfound" className="text-button">
          Cancel
        </Link>
      </Form>
    </EditorFrame>
  );
}
