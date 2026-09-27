'use client';
import { useState, useEffect } from 'react';
import {
  ChatCircleDots,
  SignIn,
  UserPlus,
  Users,
  LockKey,
  PaperPlaneTilt,
  Flag,
  Prohibit,
} from '@phosphor-icons/react';
import { useTechCare } from './shell';
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
import type { User, Message, Result } from '@/lib/types';

export { Discussion } from './discussion';
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
                <button className="action-link" onClick={() => auth()}>
                  <SignIn size={18} aria-hidden="true" /> Sign in to connect
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
