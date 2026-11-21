# FrontDesk AI

Front desk for Bright Roots Dental, Banjara Hills, Hyderabad. Patients chat on `/`,
the app answers only from the clinic file (`data/clinic.json`), and anything it
cannot answer is handed to a human on `/staff`.

## Run

```bash
npm start
```

Then open http://localhost:3000 for the patient chat and http://localhost:3000/staff
for the staff page.

No dependencies, no build step. Requires Node 18+ (uses the built-in `fetch`).

## Test

```bash
npm test          # acceptance criteria (27 checks)
npm run test:bonus  # bonus features: languages, booking, doctor availability, ageing/priority, clinic editor, quick replies, theme, responsive (83 checks)
```

Both suites boot the server (no key needed) and run over HTTP; the bonus suite also
drives the real pages through jsdom.

## Languages

Answers are produced in the patient's language. Hindi (Devanagari) and Telugu
(Telugu script) are detected and answered natively; English is the default and the
fallback for any phrase without a local translation.

## Optional AI key (server-side only)

The app answers deterministically from the clinic file and works with **no key**.
If you add a key, it is used only to improve replies for questions the deterministic
matcher does not recognise. Keys live in the server environment, never in page code.

```bash
copy .env.example .env   # then edit
```

Set exactly one provider in the environment:

- `GEMINI_API_KEY` (Google AI Studio free tier) - default model `gemini-3.5-flash-lite`
- `DEEPSEEK_API_KEY` (OpenAI-compatible, base `https://api.deepseek.com`)
- `OPENAI_API_KEY` + `OPENAI_BASE_URL` for any other OpenAI-compatible provider

When no key is set or the AI call fails, the answer is produced from the clinic
file with the label **Answered from the clinic file.**

### Free-tier note

Gemini free-tier limits are per project and vary; Flash-Lite models currently allow
more requests per day than Flash, so `gemini-3.5-flash-lite` is the default. The
matcher answers common questions without calling the AI at all, so a low free quota
is fine. Check current limits in Google AI Studio before relying on a model.

## How answers are produced

Every message is classified in this order (`src/engine.js`):

1. **Emergency** (e.g. "cannot breathe", heavy bleeding) - shows the emergency
   number `98000 00123` first and opens a ticket with status `urgent`.
2. **Injection / discount** (e.g. "ignore your rules", "50% off") - polite refusal,
   no discount, no rules obeyed.
3. **Medical / symptoms** - no medicine named, tells the patient a dentist must
   see them and offers to book.
4. **Conversation control** - greetings ("hi", "hello") and thanks get a friendly
   reply with no ticket; an end phrase ("I'm done", "bye", "that's all", "end chat")
   completes the conversation (`kind: ended`) and the patient page then resets to a
   fresh chat with a new session.
5. **Clinic file match** (timings, doctors, insurance, policies, location, prices,
   services) - answered from the file, with the clinic-file label.
6. **Unknown treatment/product question** (e.g. "Do you do Invisalign?") - treated as
   not in file: says it is not sure, opens a ticket with status `needs human`, and
   promises a call back within 2 working hours. The AI is not allowed to turn these
   into an answer.
7. **Anything else unknown** - optionally the AI is tried first, but only from the
   clinic file, with price/doctor validation. Otherwise a `needs human` ticket.

## Booking receipt

A booking request creates a `needs human` ticket with the requested time and returns a
digital receipt: a reference like `FD-6C6563AC`, the clinic name/phone/address, the
requested time and the status. The patient page shows the receipt as a card with a
**Print / Save PDF** button, and the same reference appears on the staff ticket card.

## Finishing the chat

When the patient says they are done ("I'm done", "thanks, that's all", "bye",
"end chat", or the **End chat** quick button), the assistant replies that the chat is
complete and the page automatically resets to a brand-new conversation (new session,
cleared history, fresh greeting).

## Appearance

Light and dark themes are available from the **Dark/Light** button in the header and
follow the system preference on first load; the choice is remembered. The layout is
mobile-first with no sideways scroll down to 375px and AA-contrast text in both themes.

## Deploy to Vercel

The repo ships with a serverless entry (`api/[...path].js`), `vercel.json` (clean URLs,
30s function timeout) and a `.vercelignore` that keeps `.env` and test files out.

```bash
npx vercel login        # once, opens your browser
npx vercel --prod       # deploy
```

On Vercel the server is detected (`VERCEL=1`), so tickets and clinic edits are written
to `/tmp` (`/tmp/fd_tickets.json`, `/tmp/fd_clinic.json`) instead of the read-only
project disk. **`/tmp` is ephemeral**: tickets survive while the instance is warm but
can be lost on a cold start or new instance. For a durable staff queue across restarts,
a small external store (e.g. Upstash Redis) needs to be added later.

Set the optional AI key as a Vercel environment variable (never commit it):

```bash
npx vercel env add GEMINI_API_KEY production
npx vercel --prod       # redeploy so the new env var applies
```

Without the key the app still answers everything from the clinic file.

## Files

- `data/clinic.json` - single source of truth (timings, doctors, prices, policies,
  insurance, location, emergency number).
- `data/tickets.json` - persisted tickets (created at runtime).
- `src/engine.js` - classification and clinic-file matching.
- `src/ai.js` - optional AI providers (Gemini / DeepSeek / OpenAI-compatible).
- `src/tickets.js` - ticket store (JSON file, override with `TICKETS_FILE`).
- `server.js` - HTTP server and API routes.
- `public/` - patient chat (`index.html`) and staff page (`staff.html`).

## API

- `POST /api/chat` `{ sessionId, message }` -> `{ reply, label, kind, intent, ticket, receipt }`
- `GET /api/tickets` -> all tickets
- `POST /api/tickets/:id/reply` `{ reply }` -> marks ticket `answered`
- `POST /api/tickets/:id/close` -> marks ticket `closed`
- `GET /api/session/:id` -> tickets for a patient session (used for staff replies)
- `GET /api/config` -> `{ name, address, phone, emergency }`

## DOM contract (for automated testing)

Patient page (`/`):
- Chat input `#chat-input`, send button `#chat-send`.
- Every bot reply has class `bot-msg`; the last `.bot-msg` is the answer.
- `?q=<question>` in the URL asks that question on load.

Staff page (`/staff`):
- `#ticket-queue` contains one `[data-ticket]` element per ticket, with `data-status`
  set to `answered`, `needs human`, `urgent` or `closed`.
- Each ticket has a `#staff-reply` textarea and a `#staff-send` button; replying posts
  the reply (which appears in that patient's chat) and sets the ticket to `answered`.