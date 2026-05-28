# ReadLater Digest

Chrome extension + Node backend. Save the text of web pages into a per-user FIFO
queue; on demand, the backend selects the N oldest pending items, summarizes them
with OpenAI into one combined HTML newsletter, and emails it via Resend. Resources
sent that way are marked `consumed` and stay out of the queue.

Stack: WXT (Chrome MV3), Hono on Railway, Supabase (Postgres + Auth + RLS),
Vercel AI SDK + OpenAI (`gpt-5.5`), Resend, pnpm workspaces, Biome.

See `CLAUDE.md` for the architecture & general guidelines aimed at Claude Code
instances working in this repo.

## Repo layout

```
/db          generated Supabase types + schema.sql reference
/extension   WXT + vanilla TS extension (popup, content, background)
/backend     Hono API with the single POST /newsletter/send endpoint
```

## One-time setup

These steps require accounts/credentials and cannot be automated.

### 1. Install deps

```
pnpm install
```

Requires Node ≥ 20 and pnpm ≥ 9.

### 2. Supabase project

1. Create a project at <https://supabase.com>.
2. **SQL Editor → New query** → paste the entire contents of `db/schema.sql` and run it.
3. Grab from **Project Settings → API**:
   - `Project URL` → `SUPABASE_URL` and `WXT_SUPABASE_URL`
   - `anon public` key → `SUPABASE_ANON_KEY` and `WXT_SUPABASE_ANON_KEY`
   - The project ref (the subdomain in the URL) → used by `pnpm db:types`
4. Regenerate types whenever the schema changes:
   ```
   SUPABASE_PROJECT_REF=<ref> pnpm db:types
   ```

### 3. Chrome extension OAuth (Google Cloud)

The trickiest part. The Item ID of the extension must be stable across reloads
so Google + Supabase recognize the same client.

1. Build the extension once (`pnpm dev:extension` or `pnpm --filter @rld/extension build`).
2. Load `extension/.output/chrome-mv3` as an **unpacked extension** in
   `chrome://extensions` (Developer mode on). Note the **extension ID**.
3. In **Google Cloud Console → APIs & Services → Credentials**:
   - Create OAuth 2.0 Client ID, type **Chrome Extension**, paste the extension ID.
   - Note the resulting **Client ID** → `WXT_GOOGLE_CLIENT_ID`.
4. In **Supabase → Authentication → Providers → Google**:
   - Enable Google. Under **Client IDs** put the same `WXT_GOOGLE_CLIENT_ID`.
   - Skip nonce check: leave **off** (we send a nonce from the extension).
5. To make the extension ID stable across reloads, set `manifest.key` in
   `extension/wxt.config.ts`. Generate a key with:
   ```
   openssl rand -base64 1024 | tr -d '\n' | tr '+/' '-_' | cut -c1-1024
   ```
   Uncomment the `key:` line and paste the value. Re-load the extension; the
   ID is now permanent for that key.

### 4. OpenAI + Resend

- OpenAI: create a key at <https://platform.openai.com> → `OPENAI_API_KEY`.
- Resend: create an account, copy the API key → `RESEND_API_KEY`. The current
  sender is the sandbox `onboarding@resend.dev`, which **only delivers to the
  email address registered on your Resend account**. For real multi-user use,
  verify a domain and update `FROM` in `backend/src/services/email.ts`.

### 5. Env files

Copy `.env.example` to `.env` at the repo root, fill in every value. WXT picks
up the `WXT_*` vars at build time; the backend reads its vars from
`process.env`. For local backend dev, also create `backend/.env` (or export
the vars in your shell).

`ALLOWED_EXTENSION_ORIGIN` is `chrome-extension://<extension-id>` — fill in
after step 3.

## Run locally

```
# Backend (port 8787 by default)
pnpm dev:backend

# Extension (HMR, watches for changes, outputs to extension/.output/chrome-mv3)
pnpm dev:extension
```

Re-load the unpacked extension in `chrome://extensions` after the first
successful build, then again whenever WXT regenerates the manifest.

## Deploy

### Backend → Railway

1. Connect the repo to a Railway project.
2. Set the service root to `/backend` (or use nixpacks autodetect with the
   workspace root and let it pick `@rld/backend`).
3. Set env vars in Railway: `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
   `OPENAI_API_KEY`, `RESEND_API_KEY`, `ALLOWED_EXTENSION_ORIGIN`.
4. Start command: `pnpm --filter @rld/backend start` (or just `pnpm start`
   inside `/backend`).
5. Copy the deployed URL into `WXT_BACKEND_URL` and rebuild the extension.

### Extension → Chrome Web Store

Out of scope for V1; for now we ship as unpacked locally.

## Validation

```
pnpm typecheck
pnpm lint
```

End-to-end smoke (manual, per the plan):

1. Open the popup → Sign in with Google → consent screen → back in popup with
   the Queue/Settings tabs and the signed-in email.
2. Visit a blog post → popup → "Add current page" → status reads "Saved." Twice
   across two tabs.
3. Queue tab shows both entries in FIFO order.
4. Settings tab → set `Resources per newsletter` to 2 and a `Tone prompt`
   ("Resumí cada artículo en 3 bullets, tono técnico"). Save.
5. Queue tab → "Send newsletter" → wait 10–60 s → "Sent! 2 article(s)
   summarized." Queue becomes empty.
6. The email arrives at your Google address with an HTML summary.
7. Supabase Studio → `resources` table: both rows have `status='consumed'` and
   `consumed_at` set.

Empty-queue case: with no pending items, clicking "Send newsletter" should
return "No pending resources to send."

## Notes / known V1 trade-offs

- The send flow is best-effort: if Postgres fails to mark items consumed
  *after* Resend succeeded, the user may see the same content sent again on a
  retry. Accepted for V1.
- No lock on concurrent sends — rapid double-click could in principle generate
  two emails. Accepted for V1.
- No automated tests in V1. Validation loop is typecheck + lint + manual smoke.
- `from = onboarding@resend.dev` only delivers to your Resend account email.
  Verify a domain to support arbitrary users.
- `db/generated.ts` ships with a hand-written placeholder so the repo
  type-checks before you connect a Supabase project. Run `pnpm db:types` once
  you have one to replace it.
