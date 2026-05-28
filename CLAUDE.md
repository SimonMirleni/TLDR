# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

ReadLater Digest — Chrome extension + Node backend. Users save raw page text ("save for later") into a per-user FIFO queue and trigger an on-demand newsletter email containing a combined LLM summary of the N oldest pending resources (N = user setting). V1 greenfield: no scheduler, no manual resource selection in the UI, email is always the OAuth address.

## Stack

- **Extension:** Chrome MV3, TypeScript. Popup (HTML/CSS) with two tabs (Queue / Settings), content script for scraping, background service worker for `chrome.identity.getAuthToken`.
- **Backend:** Node.js + TypeScript, REST API, deployed to Railway.
- **DB / Auth:** Supabase (Postgres + Auth). Google OAuth JWT validated server-side; RLS enforces `auth.uid() = user_id` on every table.
- **LLM:** Vercel AI SDK + OpenAI — used only for the combined newsletter summary.
- **Email:** Resend (`emails.send` to the OAuth email).

## Directory distribution

Monorepo. Layout (created as code lands — repo is currently empty):

```
/extension
  /src
    popup/        UI (Queue + Settings tabs)
    content/     content script (document.body.innerText extraction)
    background/  service worker (OAuth, messaging)
  manifest.json
/backend
  /src
    routes/     /resources, /newsletter/send, /settings
    services/   auth (Supabase JWT verify), llm (Vercel AI SDK), email (Resend)
    db/         Supabase client + FIFO query
/shared         (optional) shared request/response DTO types
```

Duplicating types between extension and backend is acceptable until `/shared` is justified.

## Validation loop

No automated test suite in V1. For every change, run from the repo root:

1. `pnpm -r typecheck` (or `tsc --noEmit` per package) — must pass.
2. `pnpm -r lint` — must pass.
3. If touching the send flow, manually confirm the FIFO query uses `ORDER BY created_at ASC LIMIT N` and that a successful send marks the selected rows `status='consumed'` with `consumed_at=now()`.

Exact scripts will be wired up when `package.json` files are created; keep them aligned with the names above.

## General guidelines

- **RLS first.** Every DB access path must respect `auth.uid() = user_id`. Do not use the service role key outside the JWT-validation/upsert-user path.
- **FIFO selection lives in the backend.** `POST /newsletter/send` accepts `{}` — never accept resource IDs from the popup. Selection is always `WHERE user_id=? AND status='pending' ORDER BY created_at ASC LIMIT N`.
- **Email is non-editable.** The recipient is always the OAuth email; do not expose a settings field for it.
- **Never trim content at save time** (FR-2.3). If the LLM context window forces truncation, do it only in the send path, in-memory — never mutate stored `content`.
- `**consumed` is terminal in V1.** Consumed resources are not re-sent and not re-activated.
- **"No pending" is a success.** Respond `200 { sent:false, reason:'no_pending' }`, not a 4xx.
- **Required index** on `resources(user_id, status, created_at)` — the FIFO query depends on it.
- **OAuth scopes:** `email`, `profile` only.
- **Out of scope for V1** (do not implement unless asked): scheduler/auto-send, Twitter/X scraping, manual selection, tags/notes/priority, separate web dashboard, content cleanup/trimming, editable email.

## Data model (snapshot)

- `users(id uuid PK = auth.uid(), email, name, created_at)`
- `resources(id, user_id FK, url, content, status 'pending'|'consumed', created_at, consumed_at)` — index `(user_id, status, created_at)`
- `settings(user_id PK/FK, tone_prompt, resources_per_newsletter int default 3, updated_at)`

## API surface

All routes require `Authorization: Bearer <google_oauth_token>`.

- `POST /resources` `{ url, content }` → `201 { id, url, status, created_at }`
- `GET /resources?status=pending` → `200 { resources: [{ id, url, created_at }] }` (FIFO order)
- `POST /newsletter/send` `{}` → `200 { sent:true, emailId, consumedCount }` or `200 { sent:false, reason:'no_pending' }`
- `GET /settings` → `{ tonePrompt, resourcesPerNewsletter }`
- `PUT /settings` `{ tonePrompt?, resourcesPerNewsletter? }` → updated settings

