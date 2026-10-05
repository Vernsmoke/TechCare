'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createPortal } from 'react-dom';
import { Bell } from '@phosphor-icons/react';
import { Form, TextArea, Loading, ErrorState, Empty } from '../ui/ui';
import { api } from '@/services/api';
import { useData } from '@/hooks/use-data';
import { useTechCare } from '@/context/techcare-context';
import type { Result } from '@shared/types';

export function ReportContent({ kind, id }: { kind: 'post' | 'comment'; id: number }) {
  const { user, auth, notify } = useTechCare();
  const [open, setOpen] = useState(false);
  return (
    <div className="report-content">
      <button
        className="text-button"
        type="button"
        onClick={() => (user ? setOpen(!open) : auth())}
      >
        Report
      </button>
      {open && (
        <div className="inline-composer">
          <Form
            submit="Send report"
            onSubmit={async (values) => {
              const r = await api<Result>('content-reports', { ...values, kind, id });
              setOpen(false);
              notify(r.message!);
            }}
          >
            <TextArea label="Reason for reporting" name="reason" min={5} max={500} />
            <button className="text-button" type="button" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </Form>
        </div>
      )}
    </div>
  );
}
export function ContentReports() {
  const { notify } = useTechCare();
  const result = useData<{
    reports: {
      id: number;
      name: string;
      kind: string;
      body: string;
      reason: string;
      post_id: number;
    }[];
  }>('content-reports');
  if (result.loading) return <Loading />;
  if (result.error) return <ErrorState message={result.error} retry={result.reload} />;
  return result.data?.reports.length ? (
    <>
      {result.data.reports.map((r) => (
        <article className="panel queue-card" key={r.id}>
          <h2>Reported {r.kind}</h2>
          <p>{r.body || 'Content is no longer available.'}</p>
          <p>
            <strong>Reason:</strong> {r.reason}
          </p>
          <small>Reported by {r.name}</small>
          <Form
            submit="Apply decision"
            onSubmit={async (values) => {
              const response = await api<Result>('content-reports/resolve', {
                ...values,
                id: r.id,
              });
              notify(response.message!);
              result.reload();
            }}
          >
            <label className="field">
              <span>Decision</span>
              <select name="action">
                <option value="dismiss">Dismiss report and keep content</option>
                <option value="remove">Remove content from public view</option>
              </select>
            </label>
          </Form>
        </article>
      ))}
    </>
  ) : (
    <Empty title="No content reports">Reports from discussions will appear here.</Empty>
  );
}
type Notification = {
  id: number;
  seen: number;
  name: string;
  post_id: number;
  root_id: number;
  page: number;
  title: string;
};
export function ReplyNotifications() {
  const { version } = useTechCare();
  const pathname = usePathname();
  const [tick, setTick] = useState(0),
    [open, setOpen] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) setTick((t) => t + 1);
    }, 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [open]);
  const result = useData<{ notifications: Notification[] }>('notifications', version + tick);
  const unread = result.data?.notifications.filter((n) => !n.seen).length || 0;
  return (
    <>
      <div className="reply-notifications">
        <button
          className="icon-button"
          aria-label={'Reply notifications' + (unread ? ', ' + unread + ' unread' : '')}
          aria-expanded={open}
          aria-controls="reply-notifications-panel"
          onClick={() => setOpen(!open)}
        >
          <Bell size={22} />
          {unread > 0 && <span className="notification-count">{unread}</span>}
        </button>
      </div>
      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
            <button
              className="notifications-scrim"
              aria-label="Close reply notifications"
              onClick={() => setOpen(false)}
            />
            <section
              id="reply-notifications-panel"
              className="notifications-panel"
              aria-label="Reply notifications"
            >
              <div className="section-heading">
                <h2>Replies to you</h2>
                <button className="text-button" onClick={() => setOpen(false)}>
                  Close
                </button>
              </div>
              {result.loading ? (
                <Loading />
              ) : result.error ? (
                <ErrorState message={result.error} retry={result.reload} />
              ) : result.data?.notifications.length ? (
                <>
                  <Form
                    submit="Mark all as read"
                    onSubmit={async () => {
                      await api('notifications', {});
                      result.reload();
                    }}
                  >
                    <span className="form-hint">New replies appear after approval.</span>
                  </Form>
                  {result.data.notifications.map((n) => (
                    <Link
                      key={n.id}
                      href={
                        '/discussion/' +
                        n.post_id +
                        '?page=' +
                        n.page +
                        '&root=' +
                        n.root_id +
                        '#comments'
                      }
                      onClick={() => setOpen(false)}
                      className={n.seen ? '' : 'unread'}
                    >
                      <strong>{n.name}</strong> replied in <span>{n.title}</span>
                    </Link>
                  ))}
                </>
              ) : (
                <p>No replies yet. We’ll let you know when someone replies to your comment.</p>
              )}
            </section>
          </>,
          document.body,
        )}
    </>
  );
}

export function ItemInquiries() {
  const { version } = useTechCare();
  const result = useData<{
    inquiries: {
      id: number;
      body: string;
      report_id: number;
      name: string;
      item: string;
      response: string;
      canReply: number;
    }[];
  }>('item-inquiries', version);
  return (
    <details className="item-inquiries">
      <summary>Private item messages</summary>
      {result.loading ? (
        <Loading />
      ) : result.error ? (
        <ErrorState message={result.error} retry={result.reload} />
      ) : result.data?.inquiries.length ? (
        result.data.inquiries.map((i) => (
          <article key={i.id}>
            <h3>
              #{i.report_id} · {i.item}
            </h3>
            <p>{i.body}</p>
            {i.response && (
              <blockquote>
                <strong>Reply from the reporter or team</strong>
                <p>{i.response}</p>
              </blockquote>
            )}
            {!!i.canReply && (
              <Form
                submit="Send private reply"
                onSubmit={async (values) => {
                  await api('item-inquiries/reply', { ...values, id: i.id });
                  result.reload();
                }}
              >
                <TextArea
                  label="Private reply"
                  name="response"
                  min={3}
                  max={1000}
                  value={i.response}
                />
              </Form>
            )}
            <small>From {i.name} · Visible only to the sender, reporter, and project team.</small>
          </article>
        ))
      ) : (
        <p>No messages about your items yet.</p>
      )}
    </details>
  );
}
