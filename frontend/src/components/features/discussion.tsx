'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Plus,
  ChatCircleDots,
  ArrowFatUp,
  ArrowFatDown,
  ArrowLeft,
  LinkSimple,
  CaretDown,
  SquaresFour,
  Cpu,
  Desktop,
  WifiHigh,
  ShieldCheck,
  Clock,
  TrendUp,
  type Icon,
} from '@phosphor-icons/react';
import { useTechCare } from '@/context/techcare-context';
import { ReportContent } from './community-extras';
import { QuestionImage } from '../common/question-photo';
import {
  Avatar,
  Badge,
  Empty,
  ErrorState,
  Form,
  Loading,
  PageHeading,
  Pagination,
  Search,
  Success,
  TextArea,
  Upload,
  date,
} from '../ui/ui';
import { api } from '@/services/api';
import { useData } from '@/hooks/use-data';
import { categories } from '@/utils/content';
import type { Post, Reply, Result, VoteState } from '@shared/types';

type FilterOption = {
  value: string;
  label: string;
  icon: Icon;
};

const topicOptions: FilterOption[] = [
  { value: '', label: 'All topics', icon: SquaresFour },
  { value: categories[0], label: categories[0], icon: ChatCircleDots },
  { value: categories[1], label: categories[1], icon: Cpu },
  { value: categories[2], label: categories[2], icon: Desktop },
  { value: categories[3], label: categories[3], icon: WifiHigh },
  { value: categories[4], label: categories[4], icon: ShieldCheck },
];

const sortOptions: FilterOption[] = [
  { value: 'newest', label: 'Newest', icon: Clock },
  { value: 'top', label: 'Top rated', icon: TrendUp },
];

function DiscussionFilterMenu({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}) {
  const selected = options.find((option) => option.value === value) || options[0];
  const SelectedIcon = selected.icon;
  return (
    <details
      className="discussion-filter-menu"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.currentTarget.open = false;
          event.currentTarget.querySelector('summary')?.focus();
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
      }}
    >
      <summary aria-label={`${label}: ${selected.label}`}>
        <span className="filter-menu-icon">
          <SelectedIcon size={19} aria-hidden="true" />
        </span>
        <span className="filter-menu-copy">
          <small>{label}</small>
          <strong>{selected.label}</strong>
        </span>
        <CaretDown className="filter-menu-caret" size={16} aria-hidden="true" />
      </summary>
      <div className="filter-menu-options" role="menu" aria-label={label}>
        {options.map((option) => {
          const OptionIcon = option.icon;
          const active = option.value === selected.value;
          return (
            <button
              type="button"
              role="menuitemradio"
              aria-checked={active}
              className={active ? 'active' : ''}
              key={option.value || 'all'}
              onClick={(event) => {
                onChange(option.value);
                event.currentTarget.closest('details')?.removeAttribute('open');
              }}
            >
              <span className="filter-option-icon">
                <OptionIcon size={19} aria-hidden="true" />
              </span>
              <span>{option.label}</span>
              {active && <span className="filter-option-check">Selected</span>}
            </button>
          );
        })}
      </div>
    </details>
  );
}

function Votes({
  kind,
  item,
}: {
  kind: 'post' | 'comment';
  item: { id: number; score?: number; myVote?: number };
}) {
  const { user, auth } = useTechCare();
  const [state, setState] = useState<VoteState>({
    score: item.score || 0,
    myVote: item.myVote || 0,
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const locked = useRef(false);
  useEffect(() => {
    setState({ score: item.score || 0, myVote: item.myVote || 0 });
    setError('');
  }, [item.id, item.score, item.myVote, user?.id]);
  async function vote(value: number) {
    if (!user) {
      auth();
      return;
    }
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    try {
      setState(
        await api<VoteState>('vote', {
          kind,
          id: item.id,
          value: state.myVote === value ? 0 : value,
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  const label = kind === 'post' ? 'question' : 'comment';
  return (
    <div className="discussion-vote-wrap">
      <div className="discussion-votes" role="group" aria-label={`Vote on ${label}`}>
        <button
          type="button"
          aria-label={`Upvote ${label}`}
          aria-pressed={state.myVote === 1}
          disabled={busy}
          onClick={() => vote(1)}
        >
          <ArrowFatUp size={21} weight={state.myVote === 1 ? 'fill' : 'regular'} />
        </button>
        <span className="vote-score" aria-label={`Score: ${state.score}`} aria-live="polite">
          {state.score}
        </span>
        <button
          type="button"
          aria-label={`Downvote ${label}`}
          aria-pressed={state.myVote === -1}
          disabled={busy}
          onClick={() => vote(-1)}
        >
          <ArrowFatDown size={21} weight={state.myVote === -1 ? 'fill' : 'regular'} />
        </button>
      </div>
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

function Byline({ item }: { item: Post | Reply }) {
  return (
    <div className="discussion-byline">
      <Avatar user={item} />
      <strong>{item.name}</strong>
      {item.role !== 'member' && (
        <Badge>{item.role === 'admin' ? 'Administrator' : 'Moderator'}</Badge>
      )}
      <span>· {date(item.created)}</span>
    </div>
  );
}

export function Discussion() {
  const search = useSearchParams(),
    router = useRouter();
  const { ask, version, user } = useTechCare();
  const query = search.get('q') || '',
    category = search.get('category') || '',
    sort = search.get('sort') || 'newest';
  const page = Math.max(1, Number(search.get('page')) || 1);
  const legacy = search.get('thread');
  useEffect(() => {
    if (legacy && /^\d+$/.test(legacy)) router.replace(`/discussion/${legacy}`);
  }, [legacy, router]);
  const result = useData<{ posts: Post[]; hasMore: boolean }>(
    `posts?q=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}&sort=${encodeURIComponent(sort)}&page=${page}`,
    version + (user?.id || 0),
  );
  function filter(values: Record<string, string>) {
    const params = new URLSearchParams(search.toString());
    params.delete('thread');
    for (const [key, value] of Object.entries(values)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.replace(`/discussion?${params}`, { scroll: false });
  }
  if (legacy && /^\d+$/.test(legacy)) return <Loading />;
  return (
    <div className="discussion-page community-discussion">
      <PageHeading
        title="Find a solution together"
        description="Ask a question, share what you know, and learn from your community."
        action={
          <button className="button primary" onClick={ask}>
            <Plus size={18} /> Ask a Question
          </button>
        }
      />
      <div className="discussion-toolbar">
        <Search
          value={query}
          placeholder="Search questions, topics, or a tech issue…"
          onSearch={(q) => filter({ q, page: '1' })}
        />
        <div className="discussion-filter-group">
          <DiscussionFilterMenu
            label="Topic"
            value={category}
            options={topicOptions}
            onChange={(next) => filter({ category: next, page: '1' })}
          />
          <DiscussionFilterMenu
            label="Sort by"
            value={sort === 'top' ? 'top' : 'newest'}
            options={sortOptions}
            onChange={(next) => filter({ sort: next, page: '1' })}
          />
          {(query || category || sort === 'top') && (
            <button
              className="community-link"
              onClick={() => filter({ q: '', category: '', sort: '', page: '1' })}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>
      <div className="discussion-layout">
        <section aria-label="Community questions">
          <div className="feed-heading">
            <h2>{category || 'All discussions'}</h2>
            <span>
              {query
                ? `Results for “${query}”`
                : sort === 'top'
                  ? 'Highest rated by the community'
                  : 'Latest from the community'}
            </span>
          </div>
          {result.loading ? (
            <Loading />
          ) : result.error ? (
            <ErrorState message={result.error} retry={result.reload} />
          ) : result.data?.posts.length ? (
            <div className="discussion-feed">
              {result.data.posts.map((post) => (
                <article className="discussion-post" key={post.id}>
                  <div className="post-vote-rail">
                    <Votes kind="post" item={post} />
                  </div>
                  <div className="post-content">
                    <Badge>{post.category}</Badge>
                    <h2>
                      <Link href={`/discussion/${post.id}`}>{post.title}</Link>
                    </h2>
                    <p className="discussion-excerpt">{post.body}</p>
                    {post.photo && (
                      <Link
                        className="discussion-photo"
                        href={`/discussion/${post.id}`}
                        aria-label={`View question: ${post.title}`}
                      >
                        <img
                          src={post.photo}
                          alt={`Photo attached to: ${post.title}`}
                          loading="lazy"
                        />
                      </Link>
                    )}
                    <div className="discussion-actions">
                      <Byline item={post} />
                      <Link
                        className="discussion-comments-link"
                        href={`/discussion/${post.id}#comments`}
                      >
                        <ChatCircleDots size={19} /> {post.replies}{' '}
                        {post.replies === 1 ? 'comment' : 'comments'}
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Empty
              title={query || category ? 'No discussions found' : 'A good question helps everyone'}
              action={
                <button className="button secondary" onClick={ask}>
                  Ask the first question
                </button>
              }
            >
              {query || category
                ? 'Try another topic or search term.'
                : 'Published questions will appear here after moderator review.'}
            </Empty>
          )}
          <Pagination
            page={page}
            hasMore={result.data?.hasMore || false}
            onPage={(p) => filter({ page: String(p) })}
          />
        </section>
      </div>
    </div>
  );
}

export function DiscussionThread({ id }: { id: number }) {
  const { user, version, auth, notify } = useTechCare();
  const params = useSearchParams();
  const requestedPage = Math.max(1, Math.floor(Number(params.get('page')) || 1));
  const [page, setPage] = useState(requestedPage),
    [notice, setNotice] = useState('');
  useEffect(() => setPage(requestedPage), [requestedPage]);
  const stamp = version + (user?.id || 0);
  const result = useData<{ post: Post }>(`post?id=${id}`, stamp);
  const comments = useData<{ comments: Reply[]; hasMore: boolean; rootCount: number }>(
    `comments?post=${id}&page=${page}`,
    stamp,
  );
  const post = result.data?.post;
  const opened = useRef(false);
  useEffect(() => {
    if (!post || opened.current) return;
    opened.current = true;
    if (window.location.hash === '#comments') document.getElementById('comments')?.scrollIntoView();
  }, [post]);
  return (
    <div className="discussion-page discussion-thread-page">
      <Link href="/discussion" className="action-link discussion-back">
        <ArrowLeft size={19} /> All discussions
      </Link>
      {result.loading ? (
        <Loading />
      ) : result.error ? (
        <>
          <PageHeading
            title="Question unavailable"
            description="This question may be awaiting review or no longer available."
          />
          <ErrorState message={result.error} retry={result.reload} />
        </>
      ) : (
        post && (
          <div className="discussion-layout">
            <section aria-label="Question and comments">
              <article className="discussion-post full-question">
                <Byline item={post} />
                <Badge>{post.category}</Badge>
                <h1>{post.title}</h1>
                <p className="discussion-full-body">{post.body}</p>
                <QuestionImage photo={post.photo} title={post.title} />
                <div className="discussion-actions">
                  <Votes kind="post" item={post} />
                  <a className="discussion-comments-link" href="#comments">
                    <ChatCircleDots size={19} /> {post.replies}{' '}
                    {post.replies === 1 ? 'comment' : 'comments'}
                  </a>
                  <button
                    className="button secondary small"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(`${location.origin}/discussion/${id}`);
                        notify('Question link copied.');
                      } catch {
                        notify('Copy the page address from your browser to share this question.');
                      }
                    }}
                  >
                    <LinkSimple size={18} /> Copy link
                  </button>
                  <ReportContent kind="post" id={id} />
                </div>
              </article>
              <section
                id="comments"
                className="discussion-comments"
                aria-labelledby="comments-heading"
              >
                <h2 id="comments-heading">
                  Comments <span>{post.replies}</span>
                </h2>
                <div className="comment-composer">
                  {notice && <Success>{notice}</Success>}
                  {user ? (
                    <CommentComposer
                      postId={id}
                      done={(message) => {
                        setNotice(message);
                        if (user.role !== 'member')
                          setPage(Math.floor((comments.data?.rootCount || 0) / 20) + 1);
                        comments.reload();
                        result.reload();
                      }}
                    />
                  ) : (
                    <div className="comment-signin">
                      <p>Have something helpful to add?</p>
                      <button className="button primary" onClick={() => auth()}>
                        Sign in to comment
                      </button>
                    </div>
                  )}
                </div>
                {comments.loading ? (
                  <Loading />
                ) : comments.error ? (
                  <ErrorState message={comments.error} retry={comments.reload} />
                ) : comments.data?.comments.length ? (
                  <div className="comment-list">
                    {comments.data.comments.map((comment) => (
                      <CommentThread
                        key={comment.id}
                        comment={comment}
                        postId={id}
                        changed={() => {
                          comments.reload();
                          result.reload();
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="comment-empty">No published comments yet. Be the first to help.</p>
                )}
                <Pagination
                  page={page}
                  hasMore={comments.data?.hasMore || false}
                  onPage={setPage}
                />
              </section>
            </section>
          </div>
        )
      )}
    </div>
  );
}

function CommentComposer({
  postId,
  parent,
  editing,
  done,
  cancel,
}: {
  postId: number;
  parent?: Reply;
  editing?: Reply;
  done: (message: string) => void;
  cancel?: () => void;
}) {
  const { user } = useTechCare();
  return (
    <Form
      submit={editing ? 'Save comment' : parent ? 'Send reply' : 'Send comment'}
      reset
      onSubmit={async (values, progress) => {
        const response = await api<Result>(
          'comments',
          {
            ...values,
            post_id: postId,
            ...(parent ? { parent_id: parent.id } : {}),
            ...(editing ? { id: editing.id, revision: editing.revision } : {}),
          },
          undefined,
          progress,
        );
        done(response.message!);
      }}
    >
      <TextArea
        label={editing ? 'Edit comment' : parent ? 'Reply to ' + parent.name : 'Your comment'}
        name="body"
        value={editing?.body}
        required={false}
        max={1000}
        placeholder="Share a helpful suggestion or attach a photo…"
      />
      <Upload compact label="Attach an image (optional)" initial={editing?.photo} />
      {editing?.photo && (
        <label className="checkbox-field">
          <input name="removePhoto" type="checkbox" value="1" /> Remove saved image
        </label>
      )}
      <p className="form-hint">
        {user?.role === 'member'
          ? 'Comments, photos, and edits appear after moderator approval.'
          : 'Your comment will be published immediately.'}
      </p>
      {cancel && (
        <button className="text-button" type="button" onClick={cancel}>
          Cancel
        </button>
      )}
    </Form>
  );
}
function CommentItem({
  comment: c,
  postId,
  changed,
}: {
  comment: Reply;
  postId: number;
  changed: () => void;
}) {
  const { user, auth, notify } = useTechCare();
  const [mode, setMode] = useState<'reply' | 'edit' | 'delete' | null>(null);
  return (
    <article className="discussion-comment" id={'comment-' + c.id}>
      <Byline item={c} />
      {c.replyTo && <small className="reply-to">Replying to {c.replyTo}</small>}
      {c.deleted ? (
        <p className="muted">This comment was removed by its author.</p>
      ) : (
        <>
          <p className="preserve-lines">{c.body}</p>
          <QuestionImage photo={c.photo} title={'Comment by ' + c.name} />
          <div className="comment-actions">
            <Votes kind="comment" item={c} />
            <button
              className="text-button"
              onClick={() => (user ? setMode(mode === 'reply' ? null : 'reply') : auth())}
            >
              Reply
            </button>
            {!!c.own && (
              <>
                <button className="text-button" onClick={() => setMode('edit')}>
                  Edit
                </button>
                <button className="text-button" onClick={() => setMode('delete')}>
                  Delete
                </button>
              </>
            )}
            <ReportContent kind="comment" id={c.id} />
          </div>
        </>
      )}
      {(mode === 'reply' || mode === 'edit') && (
        <div className="inline-composer">
          <CommentComposer
            key={mode}
            postId={postId}
            parent={mode === 'reply' ? c : undefined}
            editing={mode === 'edit' ? c : undefined}
            cancel={() => setMode(null)}
            done={(message) => {
              notify(message);
              setMode(null);
              changed();
            }}
          />
        </div>
      )}
      {mode === 'delete' && (
        <Form
          submit="Delete my comment"
          onSubmit={async () => {
            const result = await api<Result>('comments', {
              id: c.id,
              revision: c.revision,
              action: 'delete',
            });
            notify(result.message!);
            setMode(null);
            changed();
          }}
        >
          <p>Remove your text and image? Existing replies will stay in this thread.</p>
          <button className="text-button" type="button" onClick={() => setMode(null)}>
            Keep comment
          </button>
        </Form>
      )}
    </article>
  );
}
function CommentThread({
  comment,
  postId,
  changed,
}: {
  comment: Reply;
  postId: number;
  changed: () => void;
}) {
  const params = useSearchParams();
  const [open, setOpen] = useState(params.get('root') === String(comment.id)),
    [tick, setTick] = useState(0);
  return (
    <div className="comment-thread">
      <CommentItem
        comment={comment}
        postId={postId}
        changed={() => {
          setTick((t) => t + 1);
          changed();
        }}
      />
      {!!comment.replies && (
        <button
          className="text-button thread-toggle"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
        >
          {open ? 'Hide' : 'Show'} {comment.replies} {comment.replies === 1 ? 'reply' : 'replies'}
        </button>
      )}
      {open && <ThreadReplies root={comment.id} postId={postId} tick={tick} changed={changed} />}
    </div>
  );
}
function ThreadReplies({
  root,
  postId,
  tick,
  changed,
}: {
  root: number;
  postId: number;
  tick: number;
  changed: () => void;
}) {
  const { user, version } = useTechCare();
  const [page, setPage] = useState(1);
  const result = useData<{ comments: Reply[]; hasMore: boolean }>(
    'comments?post=' + postId + '&root=' + root + '&page=' + page,
    tick + version + (user?.id || 0),
  );
  return (
    <div className="thread-replies">
      {result.loading ? (
        <Loading />
      ) : result.error ? (
        <ErrorState message={result.error} retry={result.reload} />
      ) : (
        result.data?.comments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            postId={postId}
            changed={() => {
              result.reload();
              changed();
            }}
          />
        ))
      )}
      <Pagination page={page} hasMore={result.data?.hasMore || false} onPage={setPage} />
    </div>
  );
}
