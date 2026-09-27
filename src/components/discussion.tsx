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
  Clock,
  TrendUp,
} from '@phosphor-icons/react';
import { useTechCare } from './shell';
import { QuestionImage } from './question-photo';
import {
  api,
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
  date,
  useData,
} from './ui';
import { categories } from '@/lib/content';
import type { Post, Reply, Result, VoteState } from '@/lib/types';

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
    <div className="discussion-page">
      <PageHeading
        title="Find a solution together"
        description="Ask a question, share what you know, and learn from your community."
        action={
          <button className="button primary" onClick={ask}>
            <Plus size={18} /> Ask a Question
          </button>
        }
      />
      <Search
        value={query}
        placeholder="Search questions, topics, or a tech issue…"
        onSearch={(q) => filter({ q, page: '1' })}
      />
      <div className="filter-tabs" aria-label="Filter discussions">
        {['All topics', ...categories].map((c) => (
          <button
            key={c}
            className={(category || 'All topics') === c ? 'active' : ''}
            aria-pressed={(category || 'All topics') === c}
            onClick={() => filter({ category: c === 'All topics' ? '' : c, page: '1' })}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="discussion-layout">
        <section aria-label="Community questions">
          <div className="discussion-sort" aria-label="Sort questions">
            <button
              className={sort === 'newest' ? 'active' : ''}
              aria-pressed={sort === 'newest'}
              onClick={() => filter({ sort: 'newest', page: '1' })}
            >
              <Clock size={18} /> Newest
            </button>
            <button
              className={sort === 'top' ? 'active' : ''}
              aria-pressed={sort === 'top'}
              onClick={() => filter({ sort: 'top', page: '1' })}
            >
              <TrendUp size={18} /> Top
            </button>
          </div>
          {result.loading ? (
            <Loading />
          ) : result.error ? (
            <ErrorState message={result.error} retry={result.reload} />
          ) : result.data?.posts.length ? (
            <div className="discussion-feed">
              {result.data.posts.map((post) => (
                <article className="discussion-post" key={post.id}>
                  <Byline item={post} />
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
                    <Votes kind="post" item={post} />
                    <Link
                      className="discussion-comments-link"
                      href={`/discussion/${post.id}#comments`}
                    >
                      <ChatCircleDots size={19} /> {post.replies}{' '}
                      {post.replies === 1 ? 'comment' : 'comments'}
                    </Link>
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
  const [page, setPage] = useState(1),
    [notice, setNotice] = useState('');
  const stamp = version + (user?.id || 0);
  const result = useData<{ post: Post }>(`post?id=${id}`, stamp);
  const comments = useData<{ comments: Reply[]; hasMore: boolean }>(
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
                    <Form
                      submit={
                        user.role === 'member' ? 'Send comment for review' : 'Publish comment'
                      }
                      reset
                      onSubmit={async (values) => {
                        const r = await api<Result>('comments', { ...values, post_id: id });
                        setNotice(r.message!);
                        if (user.role !== 'member') setPage(Math.floor(post.replies / 20) + 1);
                        comments.reload();
                        result.reload();
                      }}
                    >
                      <TextArea
                        label="Your comment"
                        name="body"
                        min={3}
                        max={1000}
                        placeholder="Share a safe, helpful suggestion…"
                      />
                      <p className="form-hint">
                        {user.role === 'member'
                          ? 'Your comment will appear after moderator approval.'
                          : 'Your comment will be published immediately.'}
                      </p>
                    </Form>
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
                      <article className="discussion-comment" key={comment.id}>
                        <Byline item={comment} />
                        <p>{comment.body}</p>
                        <Votes kind="comment" item={comment} />
                      </article>
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
