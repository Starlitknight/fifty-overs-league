# Deploying to Supabase

Two ways to apply the database, ordered by how little secret you must expose:

## A. SQL Editor (recommended — shares NO secret with anyone)
1. Dashboard → **SQL Editor** → **New query**.
2. Paste the entire contents of `deploy/all_migrations.sql` and click **Run**.
   Run it **once** on a fresh project (the `create policy` statements are not
   re-runnable).
3. Dashboard → **Project Settings → API → Data API** → **Exposed schemas**: add
   `app` (alongside `public`). Save. (This is what `config.toml`'s
   `[api].schemas` does for local dev.)

That's the whole database. No CLI, no password shared.

## B. Supabase CLI (if you prefer git-tracked migrations)
```bash
supabase login                     # opens browser; stores your access token locally
supabase link --project-ref YOUR_PROJECT_REF
supabase db push                   # applies supabase/migrations/* in order
```
The CLI reads your access token + DB password from its own local config — you do
NOT paste them anywhere in this repo.

## Edge Functions
```bash
# from repo root, with the CLI logged in + linked:
supabase functions deploy action
supabase functions deploy deal_draft

# function secrets (stored by Supabase, never in the repo):
supabase secrets set \
  SUPABASE_URL=https://YOUR_REF.supabase.co \
  SUPABASE_ANON_KEY=YOUR_ANON_KEY \
  RESOLVER_URL=https://your-resolver.host
```
`SUPABASE_URL` and `SUPABASE_ANON_KEY` are injected into Edge Functions
automatically by Supabase, but setting them explicitly is harmless and keeps
`identity.ts` portable.

## Where each value lives in the dashboard
| value | location | sensitivity |
|---|---|---|
| Project URL / ref | Project Settings → API (or Data API) | public |
| anon / publishable key | Project Settings → API keys | public (RLS-protected) |
| service_role key | Project Settings → API keys → *Reveal* | **SECRET** (bypasses RLS) |
| DB password | Project Settings → Database → *Reset/Reveal* | **SECRET** |
| access token (CLI) | Account → Access Tokens (supabase.com/dashboard/account/tokens) | **SECRET** |

## Secret hygiene
- `.env`, `.env.*`, `secrets/` are gitignored (see repo `.gitignore`).
- The **service_role key**, **DB password**, and **access token** are used by
  YOU (SQL editor / CLI) or set as platform secrets — they never need to live in
  this repo and should never be pasted into a chat log.
- The resolver container gets `SUPABASE_SERVICE_ROLE_KEY` from its host platform's
  secret store (Fly `fly secrets set`, Railway variables) — not from a file.
