# POI Admin (Vercel UI + Supabase)

Static HTML + JS admin panel deployable on Vercel. Data + Auth use Supabase.

## 1) Setup Supabase

1. Create a Supabase project.
2. In **SQL Editor**, run: `supabase.sql` (in this repo).
3. In **Authentication**:
   - Enable **Email** provider.
   - (Recommended) Disable **public signups** so only you can log in.
   - Create your admin user (email/password).

## 2) Configure Environment Variables

Set these env vars (both locally and on Vercel):

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

They will be written into `public/env.js` during build.

## 3) Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## 4) Deploy on Vercel

1. Push this repo to GitHub.
2. On Vercel, **Import Project** from the repo.
3. Set Environment Variables (Project Settings → Environment Variables):
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
4. Deploy.

## Notes

- This is a client-only app. Keep using **anon key** in the browser (never use service role key).
- Access control is enforced by **RLS policies** in Supabase.
