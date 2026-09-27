'use client';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Plus,
  ChatCircleDots,
  ArrowUpRight,
  ShieldCheck,
  UserPlus,
  Users,
  LockKey,
  PaperPlaneTilt,
  Flag,
  Prohibit,
} from '@phosphor-icons/react';
import { useTechCare } from './shell';
import { QuestionImage } from './question-photo';
import {
  api,
  ApiError,
  Avatar,
  Badge,
  Empty,
  ErrorState,
  Form,
  Loading,
  Modal,
  PageHeading,
  Pagination,
  Search,
  Success,
  TextArea,
  date,
} from './ui';
import { useData } from './ui';
import { categories } from '@/lib/content';
import type { Post, Reply, User, Message, Result } from '@/lib/types';

export function Discussion() {
  const search = useSearchParams(),
    { ask, version } = useTechCare();
  const [query, setQuery] = useState(search.get('q') || ''),
    [category, setCategory] = useState(search.get('category') || ''),
    [page, setPage] = useState(1),
    [thread, setThread] = useState<Post | null>(null);
  const result = useData<{ posts: Post[]; hasMore: boolean }>(
    `posts?q=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}&page=${page}`,
    version,
  );
  useEffect(() => {
    const id = Number(search.get('thread'));
    if (id && result.data?.posts) {
      const p = result.data.posts.find((p) => p.id === id);
      if (p) setThread(p);
    }
  }, [search, result.data]);
  return (
    <>
      <PageHeading
        title="Find a solution together"
        description="Ask a question, share what you know, and learn from your community."
        action={
          <button className="button primary" onClick={ask}>
            <Plus size={18} />
            Ask a Question
          </button>
        }
      />
      <div className="content-toolbar">
        <Search
          value={query}
          placeholder="Search questions, topics, or a tech issue…"
          onSearch={(q) => {
            setQuery(q);
            setPage(1);
          }}
        />
      </div>
      <div className="filter-tabs" aria-label="Filter discussions">
        {['All topics', ...categories].map((c) => (
          <button
            key={c}
            className={(category || 'All topics') === c ? 'active' : ''}
            aria-pressed={(category || 'All topics') === c}
            onClick={() => {
              setCategory(c === 'All topics' ? '' : c);
              setPage(1);
            }}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="discussion-layout">
        <section>
          {result.loading ? (
            <Loading />
          ) : result.error ? (
            <ErrorState message={result.error} retry={result.reload} />
          ) : result.data?.posts.length ? (
            <div className="post-list">
              {result.data.posts.map((p) => (
                <article className="post-card" key={p.id}>
                  <div className="post-top">
                    <Badge>{p.category}</Badge>
                    <span>{date(p.created)}</span>
                  </div>
                  <h2>
                    <button className="title-button" onClick={() => setThread(p)}>
                      {p.title}
                    </button>
                  </h2>
                  <p className="post-excerpt">{p.body}</p>
                  {p.photo && <span className="photo-attached-label">Photo attached</span>}
                  <div className="post-bottom">
                    <div className="person">
                      <Avatar user={p} />
                      <span>{p.name}</span>
                    </div>
                    <button className="text-link" onClick={() => setThread(p)}>
                      <ChatCircleDots size={18} />
                      {p.replies} {p.replies === 1 ? 'reply' : 'replies'}
                      <ArrowUpRight size={16} />
                      <span className="sr-only">View Replies</span>
                    </button>
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
                ? 'Try a different topic or search term.'
                : 'Published questions will appear here after moderator review.'}
            </Empty>
          )}
          <Pagination page={page} hasMore={result.data?.hasMore || false} onPage={setPage} />
        </section>
        <aside className="discussion-aside">
          <ShieldCheck size={28} weight="duotone" />
          <h3>Good questions get better answers.</h3>
          <ul>
            <li>Give your question a clear title.</li>
            <li>Tell us what you have already tried.</li>
            <li>Leave out passwords and personal information.</li>
            <li>Be patient and kind to one another.</li>
          </ul>
          <p>Questions and member replies are reviewed before publication.</p>
        </aside>
      </div>
      {thread && <Thread post={thread} close={() => setThread(null)} />}
    </>
  );
}
function Thread({ post, close }: { post: Post; close: () => void }) {
  const { user, version, refresh, notify, auth } = useTechCare(),
    [page, setPage] = useState(1),
    [replyNotice, setReplyNotice] = useState('');
  const result = useData<{ comments: Reply[]; hasMore: boolean }>(
    `comments?post=${post.id}&page=${page}`,
    version,
  );
  return (
    <Modal title={post.title} onClose={close} wide>
      <div className="thread-author">
        <Badge>{post.category}</Badge>
        <span>
          {post.name} · {date(post.created)}
        </span>
      </div>
      <p className="thread-body">{post.body}</p>
      <QuestionImage photo={post.photo} title={post.title} />
      <h3 className="replies-title">Community replies</h3>
      {replyNotice && <Success>{replyNotice}</Success>}
      {result.loading ? (
        <Loading />
      ) : result.error ? (
        <ErrorState message={result.error} retry={result.reload} />
      ) : result.data?.comments.length ? (
        result.data.comments.map((c) => (
          <article className="reply" key={c.id}>
            <Avatar user={c} />
            <div>
              <div className="reply-byline">
                <strong>{c.name}</strong>
                {c.role !== 'member' && (
                  <Badge>
                    <ShieldCheck size={13} />
                    {c.role === 'admin' ? 'Administrator' : 'Moderator'}
                  </Badge>
                )}
              </div>
              <p>{c.body}</p>
              <small>{date(c.created)}</small>
            </div>
          </article>
        ))
      ) : (
        <p className="muted">No published replies yet. Have something helpful to add?</p>
      )}
      <Pagination page={page} hasMore={result.data?.hasMore || false} onPage={setPage} />
      {user ? (
        <Form
          submit={user.role === 'member' ? 'Send reply for review' : 'Publish reply'}
          reset
          onSubmit={async (values) => {
            const r = await api<Result>('comments', { ...values, post_id: post.id });
            setReplyNotice(r.message!);
            refresh();
          }}
        >
          <TextArea
            label="Your reply"
            name="body"
            min={3}
            max={1000}
            placeholder="Share a safe, helpful suggestion…"
          />
        </Form>
      ) : (
        <button
          className="button primary"
          onClick={() => {
            close();
            auth();
          }}
        >
          Sign in to reply
        </button>
      )}
    </Modal>
  );
}
export function Members() {
  const { user, version, refresh, auth, notify } = useTechCare(),
    [query, setQuery] = useState(''),
    [page, setPage] = useState(1),
    [conversation, setConversation] = useState<User | null>(null),
    [busy, setBusy] = useState<number | null>(null);
  const result = useData<{ members: User[]; hasMore: boolean }>(
    `members?q=${encodeURIComponent(query)}&page=${page}`,
    version,
  );
  async function action(path: string, u: User, mode?: string) {
    if (busy !== null) return;
    setBusy(u.id);
    try {
      await api(path, { user_id: u.id, action: mode });
      refresh();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  useEffect(() => {
    if (!user) setConversation(null);
  }, [user]);
  return (
    <>
      <PageHeading
        title="Your community, connected"
        description="Meet the people learning, sharing, and helping around you."
      />
      <Search
        value={query}
        placeholder="Find a community member…"
        onSearch={(q) => {
          setQuery(q);
          setPage(1);
        }}
      />
      <div className="callout compact">
        <Users size={21} />
        <p>
          Following keeps someone in your dashboard. Accepted friends can see private profiles and
          message each other.
        </p>
      </div>
      {result.loading ? (
        <Loading />
      ) : result.error ? (
        <ErrorState message={result.error} retry={result.reload} />
      ) : result.data?.members.length ? (
        <div className="member-grid">
          {result.data.members.map((u) => (
            <article className="member-card" key={u.id}>
              <div className="member-heading">
                <Avatar user={u} large />
                {u.role !== 'member' && (
                  <Badge>{u.role === 'admin' ? 'Administrator' : 'Moderator'}</Badge>
                )}
              </div>
              <h2>{u.name}</h2>
              <p>
                {u.visibility === 'private' && u.friendship !== 'friends' && user?.id !== u.id ? (
                  <span>
                    <LockKey size={14} /> Private profile
                  </span>
                ) : (
                  u.bio || 'Part of the TechCare community.'
                )}
              </p>
              {user && u.id !== user.id ? (
                <div className="member-actions">
                  <button
                    disabled={busy === u.id}
                    className="button secondary small"
                    onClick={() => action('follow', u)}
                  >
                    {u.following ? 'Unfollow' : 'Follow'}
                  </button>
                  {!u.blocked && (
                    <>
                      <button
                        disabled={busy === u.id}
                        className="button secondary small"
                        onClick={() =>
                          action(
                            'friend',
                            u,
                            u.friendship === 'incoming'
                              ? 'accept'
                              : u.friendship === 'none'
                                ? 'request'
                                : 'remove',
                          )
                        }
                      >
                        <UserPlus size={16} />
                        {
                          {
                            none: 'Add friend',
                            incoming: 'Accept request',
                            outgoing: 'Cancel request',
                            friends: 'Remove friend',
                          }[u.friendship || 'none']
                        }
                      </button>
                      {u.friendship === 'incoming' && (
                        <button
                          className="text-button"
                          onClick={() => action('friend', u, 'remove')}
                        >
                          Decline
                        </button>
                      )}
                      {u.friendship === 'friends' && (
                        <button className="button primary small" onClick={() => setConversation(u)}>
                          <ChatCircleDots size={16} />
                          Message
                        </button>
                      )}
                    </>
                  )}
                  <button
                    disabled={busy === u.id}
                    className="text-button subtle"
                    onClick={() => action('block', u, u.blocked ? 'unblock' : 'block')}
                  >
                    {u.blocked ? 'Unblock' : 'Block'}
                  </button>
                </div>
              ) : !user ? (
                <button className="text-link" onClick={() => auth()}>
                  Sign in to connect <ArrowUpRight size={16} />
                </button>
              ) : (
                <Badge>Your profile</Badge>
              )}
            </article>
          ))}
        </div>
      ) : (
        <Empty title="No members found">
          {query ? 'Try a different name.' : 'Verified community members will appear here.'}
        </Empty>
      )}
      <Pagination page={page} hasMore={result.data?.hasMore || false} onPage={setPage} />
      {conversation && user && (
        <Conversation person={conversation} close={() => setConversation(null)} />
      )}
    </>
  );
}
function Conversation({ person, close }: { person: User; close: () => void }) {
  const { user, version, notify, refresh } = useTechCare(),
    [before, setBefore] = useState<number | null>(null),
    [report, setReport] = useState<Message | null>(null),
    [reportNotice, setReportNotice] = useState(''),
    [accessError, setAccessError] = useState('');
  const result = useData<{ messages: Message[]; hasMore: boolean }>(
    `messages?user=${person.id}${before ? `&before=${before}` : ''}`,
    version,
  );
  // Recheck friendship on focus and periodically while a conversation is open.
  useEffect(() => {
    const controller = new AbortController();
    async function checkAccess() {
      try {
        await api(`messages/access?user=${person.id}`, undefined, controller.signal);
      } catch (error) {
        if (error instanceof ApiError && [401, 403].includes(error.status)) {
          setAccessError(error.message);
          setReport(null);
          setReportNotice('');
        }
      }
    }
    const timer = setInterval(checkAccess, 15000);
    window.addEventListener('focus', checkAccess);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', checkAccess);
      controller.abort();
    };
  }, [person.id]);
  return (
    <Modal
      title={`Message ${person.name}`}
      description="Messages are available only while you are accepted friends. This is not a real-time chat."
      onClose={close}
      wide
    >
      {reportNotice && <Success>{reportNotice}</Success>}
      {accessError ? (
        <div className="error-message" role="alert">
          {accessError}
        </div>
      ) : result.loading ? (
        <Loading />
      ) : result.error ? (
        <ErrorState message={result.error} retry={result.reload} />
      ) : (
        <>
          <div className="message-history">
            {result.data?.hasMore && (
              <button
                className="text-button"
                onClick={() => setBefore(result.data!.messages[0].id)}
              >
                Earlier messages
              </button>
            )}
            {before && (
              <button className="text-button" onClick={() => setBefore(null)}>
                Latest messages
              </button>
            )}
            {result.data?.messages.length ? (
              result.data.messages.map((m) => (
                <div
                  className={`message ${m.sender === user?.id ? 'sent' : 'received'}`}
                  key={m.id}
                >
                  <p>{m.body}</p>
                  <small>{date(m.created)}</small>
                  {m.sender !== user?.id && (
                    <button
                      className="icon-button"
                      aria-label="Report this message"
                      onClick={() => setReport(m)}
                    >
                      <Flag size={14} />
                    </button>
                  )}
                </div>
              ))
            ) : (
              <Empty title="Say hello">A helpful conversation starts here.</Empty>
            )}
          </div>
          <Form
            submit="Send message"
            reset
            onSubmit={async (values) => {
              await api('messages', { ...values, user_id: person.id });
              setBefore(null);
              result.reload();
            }}
          >
            <TextArea
              label="New message"
              name="body"
              min={1}
              max={1000}
              placeholder="Write your message…"
            />
          </Form>
        </>
      )}
      <button
        className="text-button danger"
        onClick={async () => {
          try {
            await api('block', { user_id: person.id, action: 'block' });
            refresh();
            close();
            notify('Member blocked. Messaging and friendship access have been revoked.');
          } catch (e) {
            notify((e as Error).message);
          }
        }}
      >
        <Prohibit size={16} /> Block member
      </button>
      {report && (
        <div className="report-form">
          <h3>Report this message</h3>
          <p>Staff will see only the reported message and your reason.</p>
          <Form
            submit="Send report"
            onSubmit={async (values) => {
              const r = await api<Result>('message-report', { ...values, message_id: report.id });
              setReport(null);
              setReportNotice(r.message!);
            }}
          >
            <TextArea label="Reason for reporting" name="reason" min={10} max={500} />
          </Form>
          <button className="text-button" onClick={() => setReport(null)}>
            Cancel report
          </button>
        </div>
      )}
    </Modal>
  );
}
