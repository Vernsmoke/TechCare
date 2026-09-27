'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  SquaresFour,
  ChatCircleDots,
  BookOpen,
  X,
  ArrowCounterClockwise,
} from '@phosphor-icons/react';
import { getGuideReply, type GuideReply } from '@/lib/guide-assistant';
import { useData } from './ui';
import { useTechCare } from './shell';
import type { Guide } from '@/lib/types';
import { helpSuggestions } from '@/lib/assistant-knowledge';

type Message = { id: number; role: 'user' | 'assistant'; reply: GuideReply };
const welcome: Message = {
  id: 0,
  role: 'assistant',
  reply: {
    text: 'Hi! I can help you find your way around TechCare, explain its features, or troubleshoot a device. What would you like to know?',
    choices: helpSuggestions,
  },
};

export function GuideAssistant({ onAsk }: { onAsk: () => void }) {
  const { version } = useTechCare();
  const library = useData<{ guides: Guide[] }>('guides', version);
  const guides = library.data?.guides || [];
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<Message[]>([welcome]);
  const launcher = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const sequence = useRef(0);
  const topic = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  useEffect(() => {
    const latest = log.current?.lastElementChild as HTMLElement | null;
    // Keep the beginning of long guide replies visible so no steps are skipped.
    if (open && log.current && latest) log.current.scrollTop = Math.max(0, latest.offsetTop - 16);
  }, [messages, open]);

  function close() {
    setOpen(false);
    launcher.current?.focus();
  }
  function send(value: string, contextTopic?: string) {
    const text = value.trim().slice(0, 400);
    if (!text) return;
    const question: Message = { id: ++sequence.current, role: 'user', reply: { text } };
    const answer: Message = {
      id: ++sequence.current,
      role: 'assistant',
      reply: getGuideReply(text, contextTopic ?? topic.current, guides),
    };
    topic.current = answer.reply.topic;
    setMessages((previous) => [...previous, question, answer].slice(-41));
    setDraft('');
    input.current?.focus();
  }

  return (
    <div className="guide-assistant">
      {open && (
        <section
          id="guide-assistant-panel"
          className="assistant-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="guide-assistant-title"
          aria-describedby="guide-assistant-description"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              close();
            }
          }}
        >
          <header className="assistant-header">
            <span className="assistant-symbol">
              <ChatCircleDots size={25} weight="regular" />
            </span>
            <div>
              <h2 id="guide-assistant-title">TechCare assistant</h2>
              <p id="guide-assistant-description">A little guidance, right here.</p>
            </div>
            <button
              className="assistant-icon"
              type="button"
              onClick={close}
              aria-label="Close guide assistant"
            >
              <X size={21} />
            </button>
          </header>
          <div className="assistant-source">
            <BookOpen size={15} /> Built-in TechCare help · No AI service
          </div>
          <div
            ref={log}
            className="assistant-messages"
            role="log"
            aria-label="Guide assistant conversation"
            aria-live="polite"
            aria-relevant="additions"
            tabIndex={0}
          >
            {messages.map(({ id, role, reply }) => (
              <div key={id} className={`assistant-message ${role}`}>
                <span className="assistant-speaker">{role === 'user' ? 'You' : 'TechCare'}</span>
                <p>{reply.text}</p>
                {reply.steps && (
                  <ol>
                    {reply.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                )}
                {reply.guide && (
                  <>
                    <h3>{reply.guide.title}</h3>
                    <ol>
                      {reply.guide.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                    <Link href="/guides" className="action-link" onClick={close}>
                      <BookOpen size={18} aria-hidden="true" /> Source: Troubleshooting Guides
                    </Link>
                  </>
                )}
                {reply.choices && (
                  <div className="assistant-choices">
                    {reply.choices.map((choice) => (
                      <button type="button" key={choice} onClick={() => send(choice, reply.topic)}>
                        {choice}
                      </button>
                    ))}
                  </div>
                )}
                {reply.link && (
                  <Link href={reply.link.href} className="action-link" onClick={close}>
                    <SquaresFour size={18} aria-hidden="true" /> {reply.link.label}
                  </Link>
                )}
              </div>
            ))}
          </div>
          <div className="assistant-topics" aria-label="Suggested help topics">
            {guides.slice(0, 4).map((guide) => (
              <button type="button" key={guide.id} onClick={() => send(guide.title)}>
                {guide.title}
              </button>
            ))}
          </div>
          <form
            className="assistant-composer"
            onSubmit={(event) => {
              event.preventDefault();
              send(draft);
            }}
          >
            <label className="sr-only" htmlFor="assistant-question">
              Your question
            </label>
            <input
              ref={input}
              id="assistant-question"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask about TechCare…"
              maxLength={400}
              autoComplete="off"
            />
            <button type="submit" disabled={!draft.trim()} aria-label="Send question">
              <ArrowUp size={21} weight="bold" />
            </button>
          </form>
          <p className="assistant-privacy">
            Chat stays in this tab until you refresh. Skip personal details.
          </p>
          <div className="assistant-footer">
            <button
              className="action-link"
              type="button"
              onClick={() => {
                close();
                onAsk();
              }}
            >
              <ChatCircleDots size={18} aria-hidden="true" /> Ask the community
            </button>
            <button
              type="button"
              onClick={() => {
                setMessages([welcome]);
                topic.current = undefined;
                setDraft('');
                input.current?.focus();
              }}
            >
              <ArrowCounterClockwise size={14} /> Clear chat
            </button>
          </div>
        </section>
      )}
      <button
        ref={launcher}
        type="button"
        className="assistant-launcher"
        aria-expanded={open}
        aria-controls={open ? 'guide-assistant-panel' : undefined}
        aria-label={open ? 'Close guide assistant' : 'Open guide assistant'}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {open ? <X size={25} /> : <ChatCircleDots size={24} weight="regular" />}
        <span>Need a hand?</span>
      </button>
    </div>
  );
}
