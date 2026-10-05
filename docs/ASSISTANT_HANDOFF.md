# TechCare assistant handoff

The built-in help widget uses local project content. There is no OpenAI SDK, AI endpoint, or personal ChatGPT connection in the application. No AI API credentials are required.

## How answers work

The widget runs entirely in the browser. `frontend/src/utils/assistant-knowledge.ts` holds public product answers, wording patterns, detailed steps, and internal links. `frontend/src/utils/guide-assistant.ts` matches questions to that content and the existing troubleshooting guides in `frontend/src/utils/content.ts`. It recognizes limited follow-ups such as “Show me the steps” and “Tell me more” using the last topic. This is a rule-based help assistant, not a generative model or general-purpose search engine. Unsupported questions receive an honest fallback with suggestions and a community link.

The UI is in `frontend/src/components/features/guide-assistant.tsx`, mounted in the shared shell. Suggested follow-ups retain the topic of the reply they belong to. Answers do not inspect accounts, discussions, private messages, or live moderation status, and cannot take actions for the visitor. Ordinary page links navigate to existing screens; account permissions still apply on those screens.

## Updating help

1. Verify a feature against its current screen and backend behavior.
2. Add or update a `helpTopics` entry with a stable ID, a sample question, matching patterns, an accurate answer, steps, and an optional internal link.
3. Keep entries specific. Exact sample questions are matched first. Broader pattern matches use array order, so place specific intents before generic words such as “account.”
4. Keep personal information, credentials, account status, and unapproved support promises out of this public content.
5. Add representative questions and follow-up checks to `scripts/chatbot-check.mjs` when extending behavior.

Booth answers intentionally link to the current page instead of duplicating dates. If workflows or permissions change, update the relevant answers and browser checks together. Broader language understanding would require a separate design decision; the current matcher does not promise to understand arbitrary wording.

## Privacy and operation

Chat messages are kept only in React memory, capped at 41 displayed messages. Clear chat, a page refresh, or an account change clears the conversation. Closing/reopening retains it within the same page session. There is no chat API, browser-storage persistence, AI request, or chat transcript logging. Page navigation and other site actions still use the normal TechCare backend.

There are no AI usage fees for this implementation. Ordinary hosting, email delivery, and other project operating costs are separate. Keep `.env.local`, databases, uploaded private media, and generated build folders out of a source handoff; use `.env.example` and have the receiving team supply its own operational configuration.

## Verification

Start the local app on port 3000, then run:

```powershell
node scripts/chatbot-check.mjs
npm run typecheck
npm run build
```

Browser checks use locally installed Edge and synthetic text without registering accounts. They cover app topics, follow-ups, matching ambiguity, safety/fallback behavior, escaped input, no external chat requests, keyboard controls, navigation, temporary history, and desktop/mobile accessibility. Screenshots and the report are written to ignored `artifacts/`.
