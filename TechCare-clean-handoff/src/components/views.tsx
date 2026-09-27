'use client';
import { QuestionImage } from './question-photo';
import { LogoSettings } from './logo-settings';
import { ContentSettings } from './content-settings';
import { BoothContent } from './booth-content';
import { AnnouncementSettings } from './announcement-settings';
import Link from 'next/link';
import { Suspense, useState, type ReactNode } from 'react';
import {
  ChatCircleDots,
  BookOpen,
  MapPin,
  ShieldCheck,
  Toolbox,
  CheckCircle,
  LockKey,
  Star,
  Plus,
  PlayCircle,
  Image as ImageIcon,
  Link as LinkIcon,
  Users,
} from '@phosphor-icons/react';
import { useTechCare } from './shell';
import {
  api,
  useData,
  Avatar,
  Badge,
  Empty,
  ErrorState,
  Field,
  Form,
  Loading,
  Modal,
  PageHeading,
  Pagination,
  Search,
  Select,
  Success,
  TextArea,
  Upload,
  date,
} from './ui';
import { GuideDetail, GuideIcon } from './home';
import { Discussion, Members } from './community';
import { categories } from '@/lib/content';
import type {
  Guide,
  Booth as BoothEntry,
  Dashboard,
  Notice,
  Post,
  Queue,
  Resource,
  Result,
  User,
} from '@/lib/types';

export function View({ page }: { page: string }) {
  const views: Record<string, ReactNode> = {
    guides: <Guides />,
    resources: <Resources />,
    discussion: (
      <Suspense fallback={<Loading />}>
        <Discussion />
      </Suspense>
    ),
    members: <Members />,
    booth: <Booth />,
    lostfound: <LostFound />,
    feedback: (
      <Protected>
        <Feedback />
      </Protected>
    ),
    profile: (
      <Protected>
        <Profile />
      </Protected>
    ),
    moderate: (
      <Protected roles={['moderator', 'admin']}>
        <Moderation />
      </Protected>
    ),
    admin: (
      <Protected roles={['admin']}>
        <Admin />
      </Protected>
    ),
    privacy: <Privacy />,
  };
  return <div className="inner-page">{views[page]}</div>;
}
function Protected({ children, roles }: { children: ReactNode; roles?: string[] }) {
  const { user, ready, auth } = useTechCare();
  if (!ready) return <Loading />;
  if (!user)
    return (
      <Empty
        title="Your community is one sign-in away"
        action={
          <button className="button primary" onClick={() => auth()}>
            Sign In
          </button>
        }
      >
        Sign in to access this part of TechCare.
      </Empty>
    );
  if (roles && !roles.includes(user.role))
    return (
      <Empty title="This space is for the project team">
        Your account does not have permission to access this page.
      </Empty>
    );
  return <>{children}</>;
}

function Guides() {
  const { version } = useTechCare();
  const result = useData<{ guides: Guide[] }>('guides', version);
  const guides = result.data?.guides || [];
  const [selected, setSelected] = useState<Guide | null>(null),
    [query, setQuery] = useState(''),
    [category, setCategory] = useState('');
  return (
    <>
      <PageHeading
        title="A little know-how goes a long way"
        description="Safe, practical guides to help you get comfortable with everyday technology."
      />
      <Search placeholder="Find a troubleshooting guide…" value={query} onSearch={setQuery} />
      <div className="filter-tabs">
        {['All guides', ...categories].map((c) => (
          <button
            aria-pressed={(category || 'All guides') === c}
            className={(category || 'All guides') === c ? 'active' : ''}
            key={c}
            onClick={() => setCategory(c === 'All guides' ? '' : c)}
          >
            {c}
          </button>
        ))}
      </div>
      {result.loading ? (
        <Loading />
      ) : result.error ? (
        <ErrorState message={result.error} retry={result.reload} />
      ) : null}
      <div className="guide-library">
        {guides
          .map((g, i) => ({ g, i }))
          .filter(
            ({ g }) =>
              (!category || g.category === category) &&
              `${g.title} ${g.summary} ${g.category}`.toLowerCase().includes(query.toLowerCase()),
          )
          .map(({ g, i }) => (
            <button className="guide-card library-card" key={g.id} onClick={() => setSelected(g)}>
              <span className={`guide-icon tone-${i % 4}`}>
                <GuideIcon kind={g.icon} size={32} />
              </span>
              <span className="guide-category">{g.category}</span>
              <h2>{g.title}</h2>
              <p>{g.summary}</p>
              <span className="guide-meta">
                {g.time}
                <span className="action-link small">
                  <BookOpen size={16} aria-hidden="true" /> Read guide
                </span>
              </span>
            </button>
          ))}
      </div>
      {!result.loading &&
        !result.error &&
        !guides.some(
          (g) =>
            (!category || g.category === category) &&
            `${g.title} ${g.summary} ${g.category}`.toLowerCase().includes(query.toLowerCase()),
        ) && (
          <Empty title="No guides found">Try another keyword or choose a different category.</Empty>
        )}
      <div className="wide-callout">
        <BookOpen size={35} weight="regular" />
        <div>
          <h3>Still figuring it out?</h3>
          <p>Share what you’ve tried. The community can help with your next step.</p>
        </div>
        <Link href="/discussion" className="button secondary">
          <ChatCircleDots size={18} aria-hidden="true" /> Go to Discussion
        </Link>
      </div>
      {selected !== null && <GuideDetail guide={selected} close={() => setSelected(null)} />}
    </>
  );
}

function Resources() {
  const { version } = useTechCare(),
    [page, setPage] = useState(1),
    [filter, setFilter] = useState('All media'),
    [image, setImage] = useState<Resource | null>(null);
  const result = useData<{ resources: Resource[]; hasMore: boolean }>(
    `resources?page=${page}&type=${filter === 'Images' ? 'image' : filter === 'Videos' ? 'video' : filter === 'Links' ? 'external' : ''}`,
    version,
  );
  const list = result.data?.resources || [];
  return (
    <>
      <PageHeading
        title="See it. Learn it. Try it."
        description="Watch helpful tutorials and explore practical resources, with credit to their creators."
      />
      <div className="filter-tabs">
        {['All media', 'Images', 'Videos', 'Links'].map((f) => (
          <button
            className={filter === f ? 'active' : ''}
            aria-pressed={filter === f}
            onClick={() => {
              setFilter(f);
              setPage(1);
            }}
            key={f}
          >
            {f}
          </button>
        ))}
      </div>
      {result.loading ? (
        <Loading />
      ) : result.error ? (
        <ErrorState message={result.error} retry={result.reload} />
      ) : list.length ? (
        <div className="resource-grid">
          {list.map((r) => (
            <article className="resource-card" key={r.id}>
              {r.type === 'image' ? (
                <button
                  className="resource-image"
                  aria-label={`View ${r.title}`}
                  onClick={() => setImage(r)}
                >
                  <img src={r.url} alt={r.title} />
                </button>
              ) : r.type === 'video' ? (
                <video controls preload="metadata" src={r.url} aria-label={r.title} />
              ) : (
                <a
                  className="resource-link-preview"
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <PlayCircle size={58} weight="regular" />
                  <span className="action-link">
                    <LinkIcon size={18} aria-hidden="true" /> Watch & learn
                  </span>
                </a>
              )}
              <div className="resource-body">
                <Badge>{r.category}</Badge>
                <h2>{r.title}</h2>
                <p>{r.description}</p>
                <div className="resource-credit">
                  <span>By {r.author}</span>
                  {r.type === 'external' ? (
                    <LinkIcon size={18} />
                  ) : r.type === 'image' ? (
                    <ImageIcon size={18} />
                  ) : (
                    <PlayCircle size={18} />
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty title="No resources in this category">
          Approved learning materials will appear here.
        </Empty>
      )}
      <Pagination page={page} hasMore={result.data?.hasMore || false} onPage={setPage} />
      <p className="page-note">
        Sample materials are provided for review. Source credits do not imply institutional
        endorsement.
      </p>
      {image && (
        <Modal title={image.title} onClose={() => setImage(null)} wide>
          <img className="full-resource" src={image.url} alt={image.title} />
          <p>By {image.author}</p>
        </Modal>
      )}
    </>
  );
}

function Booth() {
  const { version } = useTechCare();
  const result = useData<{ booths: BoothEntry[] }>('booths', version);
  return (
    <>
      <PageHeading
        title="A helping hand, in person"
        description="Bring your questions. Our student support team will work through them with you."
      />
      {result.loading ? (
        <Loading />
      ) : result.error ? (
        <ErrorState message={result.error} retry={result.reload} />
      ) : result.data?.booths.length ? (
        result.data.booths.map((booth) => <BoothContent key={booth.id} booth={booth} />)
      ) : (
        <Empty title="No booth details published yet">
          Check back for the next campus support activity.
        </Empty>
      )}
    </>
  );
}

function LostFound() {
  const { user, auth, version, refresh, notify } = useTechCare(),
    [open, setOpen] = useState(false),
    [page, setPage] = useState(1),
    [filter, setFilter] = useState('All notices');
  const result = useData<{ reports: Notice[]; hasMore: boolean }>(
    `lost-found?page=${page}`,
    version,
  );
  const reports = (result.data?.reports || []).filter(
    (r) => filter === 'All notices' || r.kind === filter.toLowerCase(),
  );
  return (
    <>
      <PageHeading
        title="Let’s help it find its way back"
        description="Browse reviewed campus notices or report something you have lost or found."
        action={
          <button className="button primary" onClick={() => (user ? setOpen(true) : auth())}>
            <Plus size={18} />
            Report an item
          </button>
        }
      />
      <div className="callout">
        <ShieldCheck size={23} />
        <p>
          To claim an item, quote its report number to the campus project team and establish
          ownership in person. Keep identifying details private.
        </p>
      </div>
      <div className="filter-tabs">
        {['All notices', 'Lost', 'Found'].map((f) => (
          <button
            key={f}
            aria-pressed={filter === f}
            className={filter === f ? 'active' : ''}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>
      {result.loading ? (
        <Loading />
      ) : result.error ? (
        <ErrorState message={result.error} retry={result.reload} />
      ) : reports.length ? (
        <div className="notice-grid">
          {reports.map((r) => (
            <article className="panel notice-card" key={r.id}>
              <div className="post-top">
                <Badge tone={r.kind === 'found' ? 'green' : 'gold'}>
                  {r.kind === 'found' ? 'Found' : 'Lost'}
                </Badge>
                <span>Report #{r.id}</span>
              </div>
              <h2>{r.item}</h2>
              <p>{r.details}</p>
              <div className="notice-location">
                <MapPin size={18} />
                {r.location}
              </div>
              <small>{date(r.created)}</small>
            </article>
          ))}
        </div>
      ) : (
        <Empty title="No published notices yet">
          Approved lost and found reports will appear here. Check back after moderator review.
        </Empty>
      )}
      <Pagination page={page} hasMore={result.data?.hasMore || false} onPage={setPage} />
      {open && user && (
        <Modal
          title="Report a lost or found item"
          description="Your report will be reviewed before publication. Reporter details will not appear in the public notice."
          onClose={() => setOpen(false)}
        >
          <Form
            submit="Send for review"
            onSubmit={async (values) => {
              const r = await api<Result>('lost-found', values);
              setOpen(false);
              notify(r.message!);
              refresh();
            }}
          >
            <Select label="Report type" name="kind" options={['lost', 'found']} />
            <Field label="Item name" name="item" min={3} max={100} />
            <Field label="Location last seen or found" name="location" min={3} max={100} />
            <TextArea
              label="Public description"
              name="details"
              min={10}
              max={500}
              placeholder="Describe the item without revealing private identifying details."
            />
            <p className="form-hint">
              Do not include passwords, serial numbers, phone numbers, or private contact details.
            </p>
          </Form>
        </Modal>
      )}
    </>
  );
}

function Feedback() {
  const { notify } = useTechCare(),
    [rating, setRating] = useState(5),
    [done, setDone] = useState(false);
  return (
    <>
      <PageHeading
        title="Your experience matters"
        description="Tell us what worked and what we can do better. Every bit of feedback helps."
      />
      <div className="feedback-layout">
        <section className="panel feedback-panel">
          <span className="action-icon gold">
            <Star size={30} weight="regular" />
          </span>
          <h2>How was your TechCare experience?</h2>
          <p>Take a moment to share your thoughts with the team.</p>
          {done && <Success>Thank you for helping us improve.</Success>}
          <Form
            submit="Send feedback"
            reset
            onSubmit={async (values) => {
              const r = await api<Result>('feedback', values);
              notify(r.message!);
              setDone(true);
            }}
          >
            <fieldset className="rating-field">
              <legend>Your rating</legend>
              <div className="rating-stars">
                {[1, 2, 3, 4, 5].map((n) => (
                  <label key={n} title={`${n} out of 5`}>
                    <input
                      type="radio"
                      name="rating"
                      value={n}
                      checked={rating === n}
                      onChange={() => setRating(n)}
                      aria-label={`${n} out of 5`}
                    />
                    <Star size={37} weight={n <= rating ? 'fill' : 'regular'} />
                  </label>
                ))}
                <span>{rating} / 5</span>
              </div>
            </fieldset>
            <TextArea
              label="What worked well? What could be better?"
              name="message"
              min={10}
              max={1000}
              placeholder="We’d love to hear about your experience…"
            />
          </Form>
        </section>
        <aside className="privacy-aside">
          <LockKey size={29} weight="regular" />
          <h3>Shared privately with the team</h3>
          <p>
            Your feedback and display name are visible only to moderators and administrators for
            evaluation and follow-up.
          </p>
          <p>It is not posted publicly and is not anonymous.</p>
        </aside>
      </div>
    </>
  );
}

function Profile() {
  const { user, setUser, version, notify, ask } = useTechCare(),
    [page, setPage] = useState(1);
  const result = useData<Dashboard>(`dashboard?page=${page}`, version);
  return (
    <>
      <PageHeading
        title={`Welcome back, ${user!.name.split(' ')[0]}`}
        description="Your profile, your connections, and the questions you’re working through."
        action={
          <button className="button primary" onClick={ask}>
            <Plus size={18} />
            Ask a Question
          </button>
        }
      />
      <div className="profile-layout">
        <section className="panel">
          <div className="profile-heading">
            <Avatar user={user!} large />
            <div>
              <h2>{user!.name}</h2>
              <Badge>{user!.role === 'admin' ? 'Administrator' : user!.role}</Badge>
            </div>
          </div>
          <Form
            submit="Save profile"
            onSubmit={async (values) => {
              const r = await api<Result>('profile', values);
              setUser(r.user!);
              notify('Profile updated.');
            }}
          >
            <Field label="Display name" name="name" min={2} max={80} value={user!.name} />
            <Select
              label="Profile visibility"
              name="visibility"
              value={user!.visibility}
              options={['public', 'private']}
            />
            <p className="form-hint">
              Private hides your bio and picture from non-friends. Your display name and approved
              public questions remain visible.
            </p>
            <TextArea label="About me" name="bio" max={400} value={user!.bio} required={false} />
            <Upload name="picture" label="Profile picture" />
          </Form>
        </section>
        <div>
          {result.loading ? (
            <Loading />
          ) : result.error ? (
            <ErrorState message={result.error} retry={result.reload} />
          ) : (
            <>
              <section className="panel">
                <h2>My questions</h2>
                {result.data?.posts.length ? (
                  result.data.posts.map((p) => (
                    <div className="own-question" key={p.id}>
                      <div>
                        <h3>{p.title}</h3>
                        <small>{date(p.created)}</small>
                        {p.photo && (
                          <a
                            className="action-link"
                            href={p.photo}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ImageIcon size={18} aria-hidden="true" /> View attached photo
                          </a>
                        )}
                      </div>
                      <Badge
                        tone={
                          p.status === 'published' ? 'green' : p.status === 'pending' ? 'gold' : ''
                        }
                      >
                        {p.status}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <Empty title="No questions yet">
                    When you ask, you can follow the review status here.
                  </Empty>
                )}
                <Pagination page={page} hasMore={result.data?.hasMore || false} onPage={setPage} />
              </section>
              <div className="two-panels connections">
                {(['following', 'followers'] as const).map((type) => (
                  <section className="panel" key={type}>
                    <h2>
                      {type === 'following' ? 'Following' : 'Followers'}{' '}
                      <span className="count">{result.data?.[type].length || 0}</span>
                    </h2>
                    {result.data?.[type].length ? (
                      result.data[type].map((u) => (
                        <div className="person connection" key={u.id}>
                          <Avatar user={u} />
                          <span>{u.name}</span>
                        </div>
                      ))
                    ) : (
                      <p className="muted">No {type} yet.</p>
                    )}
                  </section>
                ))}
              </div>
              <Link className="action-link" href="/members">
                <Users size={18} aria-hidden="true" /> Find people in your community
              </Link>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function Moderation() {
  const { version, refresh, notify } = useTechCare(),
    [tab, setTab] = useState('Questions'),
    [answer, setAnswer] = useState<Post | null>(null),
    [resource, setResource] = useState(false),
    [busy, setBusy] = useState('');
  const result = useData<Queue>('queue', version);
  async function decide(kind: string, id: number, status: string) {
    if (busy) return;
    setBusy(`${kind}${id}`);
    try {
      const r = await api<Result>('moderate', { kind, id, status });
      notify(r.message!);
      refresh();
    } catch (e) {
      notify((e as Error).message);
      refresh();
    } finally {
      setBusy('');
    }
  }
  const tabs = ['Questions', 'Replies', 'Lost & Found', 'Feedback', 'Message reports'];
  return (
    <>
      <PageHeading
        title="Review and Respond"
        description="Keep shared knowledge useful, respectful, and safe for your community."
        action={
          <button className="button primary" onClick={() => setResource(true)}>
            <Plus size={18} />
            Publish resource
          </button>
        }
      />
      <div className="filter-tabs">
        {tabs.map((t) => (
          <button
            key={t}
            className={tab === t ? 'active' : ''}
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {result.loading ? (
        <Loading />
      ) : result.error ? (
        <ErrorState message={result.error} retry={result.reload} />
      ) : (
        result.data && (
          <>
            {tab === 'Questions' &&
              (result.data.posts.length ? (
                result.data.posts.map((p) => (
                  <article className="panel queue-card" key={p.id}>
                    <div className="post-top">
                      <Badge>{p.category}</Badge>
                      <span>
                        {p.name} · {date(p.created)}
                      </span>
                    </div>
                    <h2>{p.title}</h2>
                    <p className="preserve-lines">{p.body}</p>
                    <QuestionImage photo={p.photo} title={p.title} />
                    <div className="button-row">
                      <button
                        disabled={!!busy}
                        className="button primary"
                        onClick={() => setAnswer(p)}
                      >
                        <CheckCircle size={18} aria-hidden="true" /> Approve & Answer
                      </button>
                      <button
                        disabled={!!busy}
                        className="button secondary"
                        onClick={() => decide('post', p.id, 'published')}
                      >
                        Approve
                      </button>
                      <button
                        disabled={!!busy}
                        className="button secondary danger"
                        onClick={() => decide('post', p.id, 'rejected')}
                      >
                        Reject
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <Empty title="The question queue is clear">
                  New questions will appear here for review.
                </Empty>
              ))}
            {tab === 'Replies' &&
              (result.data.comments.length ? (
                result.data.comments.map((c) => (
                  <article className="panel queue-card" key={c.id}>
                    <Badge>Reply</Badge>
                    <h2>{c.title}</h2>
                    <p className="preserve-lines">{c.body}</p>
                    <p className="muted">By {c.name}</p>
                    <div className="button-row">
                      <button
                        disabled={!!busy}
                        className="button primary"
                        onClick={() => decide('comment', c.id, 'published')}
                      >
                        Approve
                      </button>
                      <button
                        disabled={!!busy}
                        className="button secondary danger"
                        onClick={() => decide('comment', c.id, 'rejected')}
                      >
                        Reject
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <Empty title="No replies awaiting review" />
              ))}
            {tab === 'Lost & Found' &&
              (result.data.reports.length ? (
                result.data.reports.map((r) => (
                  <article className="panel queue-card" key={r.id}>
                    <Badge>{r.kind}</Badge>
                    <h2>{r.item}</h2>
                    <p>{r.details}</p>
                    <p>
                      {r.location} · Submitted by {r.name}
                    </p>
                    <div className="button-row">
                      <button
                        disabled={!!busy}
                        className="button primary"
                        onClick={() => decide('report', r.id, 'published')}
                      >
                        Approve
                      </button>
                      <button
                        disabled={!!busy}
                        className="button secondary danger"
                        onClick={() => decide('report', r.id, 'rejected')}
                      >
                        Reject
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <Empty title="No reports awaiting review" />
              ))}
            {tab === 'Feedback' &&
              (result.data.feedback.length ? (
                result.data.feedback.map((f) => (
                  <article className="panel queue-card" key={f.id}>
                    <Badge tone="gold">{f.rating} / 5</Badge>
                    <h3>{f.name}</h3>
                    <p>{f.message}</p>
                  </article>
                ))
              ) : (
                <Empty title="No feedback yet">Feedback is private to the project team.</Empty>
              ))}
            {tab === 'Message reports' && (
              <>
                <div className="callout">
                  <LockKey size={22} />
                  <p>
                    Only the reported message and report reason are available. Staff do not have
                    general access to private conversations.
                  </p>
                </div>
                {result.data.messageReports.length ? (
                  result.data.messageReports.map((r) => (
                    <article className="panel queue-card" key={r.id}>
                      <Badge>Report #{r.id}</Badge>
                      <h3>Reported by {r.name}</h3>
                      <blockquote>{r.body}</blockquote>
                      <p>
                        <strong>Reason:</strong> {r.reason}
                      </p>
                    </article>
                  ))
                ) : (
                  <Empty title="No message reports" />
                )}
              </>
            )}
          </>
        )
      )}
      {answer && (
        <Modal
          title="Approve & Answer"
          description="The question and your answer will be published together."
          onClose={() => setAnswer(null)}
          wide
        >
          <div className="review-context">
            <h3>{answer.title}</h3>
            <p>{answer.body}</p>
            <QuestionImage photo={answer.photo} title={answer.title} />
          </div>
          <Form
            submit="Publish question & answer"
            onSubmit={async (values) => {
              const r = await api<Result>('moderate', {
                ...values,
                kind: 'post',
                id: answer.id,
                status: 'published',
              });
              setAnswer(null);
              refresh();
              notify(r.message!);
            }}
          >
            <TextArea label="Your moderator answer" name="answer" min={3} max={1000} />
            <TextArea
              label="Internal decision note (optional)"
              name="reason"
              max={500}
              required={false}
            />
          </Form>
        </Modal>
      )}
      {resource && <ResourceForm close={() => setResource(false)} />}
    </>
  );
}
function ResourceForm({ close }: { close: () => void }) {
  const { notify, refresh } = useTechCare(),
    [type, setType] = useState('external');
  return (
    <Modal
      title="Publish a learning resource"
      description="Review suitability, credit, licensing, and accessibility before publishing."
      onClose={close}
    >
      <Form
        submit="Publish resource"
        onSubmit={async (values) => {
          const r = await api<Result>('resource', values);
          refresh();
          close();
          notify(r.message!);
        }}
      >
        <Field label="Title" name="title" min={4} max={120} />
        <TextArea label="Description / transcript" name="description" max={500} required={false} />
        <Select label="Category" name="category" options={categories} />
        <label className="field">
          <span>Resource type</span>
          <select name="type" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="external">external</option>
            <option value="image">image</option>
            <option value="video">video</option>
          </select>
        </label>
        <Field label="Student or source credit" name="author" min={2} max={80} />
        {type === 'external' ? (
          <Field label="Direct HTTPS link" name="url" type="url" max={1000} />
        ) : (
          <Upload video={type === 'video'} required label={type === 'video' ? 'Video' : 'Image'} />
        )}
        <p className="form-hint">
          For instructional video, use a captioned source and provide a useful description or
          transcript. Uploaded videos require the server media validator.
        </p>
      </Form>
    </Modal>
  );
}

function Admin() {
  return (
    <>
      <PageHeading
        title="Care for your community"
        description="Manage page content, announcements, moderators, and your app logo."
      />
      <ContentSettings>
        <AdminAppSettings />
      </ContentSettings>
    </>
  );
}

function AdminAppSettings() {
  const { user, version, refresh, notify } = useTechCare(),
    [busy, setBusy] = useState<number | null>(null);
  const result = useData<{ users: User[] }>('admin/users', version);
  return (
    <>
      <AnnouncementSettings />
      <section className="panel">
        <h2>Moderator accounts</h2>
        <p>Members create and verify their own accounts before you assign a moderator role.</p>
        {result.loading ? (
          <Loading />
        ) : result.error ? (
          <ErrorState message={result.error} retry={result.reload} />
        ) : (
          <div className="admin-users">
            {result.data?.users.map((u) => (
              <div className="admin-user" key={u.id}>
                <Avatar user={{ name: u.name, avatar: '' }} />
                <div>
                  <strong>{u.name}</strong>
                  <small>{u.email}</small>
                </div>
                <Badge>{u.role}</Badge>
                {u.role === 'admin' ? (
                  <span className="muted">Protected</span>
                ) : (
                  <button
                    disabled={busy === u.id || !u.verified}
                    className="button secondary small"
                    onClick={async () => {
                      setBusy(u.id);
                      try {
                        const r = await api<Result>('admin/role', {
                          id: u.id,
                          role: u.role === 'moderator' ? 'member' : 'moderator',
                        });
                        notify(r.message!);
                        refresh();
                      } catch (e) {
                        notify((e as Error).message);
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    {!u.verified
                      ? 'Awaiting verification'
                      : u.role === 'moderator'
                        ? 'Remove moderator'
                        : 'Make moderator'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
      <LogoSettings />
      <section className="panel hero-admin">
        <h2>Homepage illustration</h2>
        <p>Shown when no announcements are published.</p>
        <Form
          submit="Update illustration"
          reset
          onSubmit={async (values) => {
            const r = await api<Result>('admin/hero', values);
            refresh();
            notify(r.message!);
          }}
        >
          <Upload required label="New homepage illustration" />
        </Form>
      </section>
      <div className="callout">
        <ShieldCheck size={22} />
        <p>
          You are signed in as {user!.name}. Administrator roles are protected from changes through
          this interface.
        </p>
      </div>
    </>
  );
}

function Privacy() {
  return (
    <>
      <PageHeading
        title="A community built on care"
        description="How TechCare handles your information and keeps conversations useful."
      />
      <div className="privacy-document">
        <section>
          <h2>What is public</h2>
          <p>
            Your display name, approved questions and their attached photos, and approved replies
            are public. Public profiles also show a bio and profile picture. A private profile hides
            your bio and picture from everyone except you and accepted friends.
          </p>
          <p>
            Approved Lost & Found notices show the item, description, location, date, and report
            number. They do not expose your identity or contact details.
          </p>
        </section>
        <section>
          <h2>What stays private</h2>
          <p>
            Your email is used for account access and recovery. Administrators can see account
            emails for role management. Feedback is visible with your identity to moderators and
            administrators, and is not anonymous.
          </p>
          <p>
            Only accepted friends can read or send messages in their conversation. Removing a
            friendship or blocking stops access. Stored messages are retained; becoming friends
            again can restore access to previous messages.
          </p>
        </section>
        <section>
          <h2>Report and block</h2>
          <p>
            Use the flag beside a received message to report it. Staff can review the reported
            message and your reason, but cannot browse your whole conversation. Use Block on a
            member’s profile card or in a conversation to revoke friendship and communication
            access.
          </p>
        </section>
        <section>
          <h2>Keep it helpful</h2>
          <ul>
            <li>Be respectful and keep questions relevant to technology support.</li>
            <li>
              Do not share passwords, private identifiers, or someone else’s personal information.
            </li>
            <li>
              Give safe advice. Do not suggest account bypass, pirated software, or unsafe repairs.
            </li>
            <li>Credit original creators when sharing resources.</li>
          </ul>
          <p>
            Questions, member replies, and Lost & Found reports are reviewed before publication.
            Moderators may reject inappropriate or unsafe submissions.
          </p>
        </section>
        <section className="callout">
          <ShieldCheck size={25} />
          <div>
            <h2>Local pilot notice</h2>
            <p>
              TechCare is a student community service learning project, not an official University
              website. This notice describes the pilot’s behavior. Responsible privacy contacts,
              retention and deletion periods, appeals, and incident procedures must be approved
              before public operation. Use synthetic information for local demonstrations.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
