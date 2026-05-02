# IronAtlas

A workout tracker with a visual muscle heatmap. Built with Next.js (App Router), Supabase, and Tailwind.

## Setup

1. **Create a Supabase project** at https://supabase.com.
2. Copy `.env.local.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (Settings → API → `service_role`)
3. **Run the SQL** in `supabase/schema.sql` against your project (SQL Editor).
4. **Create the first admin**:
   - In Supabase: Authentication → Users → Add user (email + password).
   - In SQL Editor: `update public.profiles set role = 'admin' where id = '<that-user-id>';`
5. `npm install`
6. `npm run dev` → http://localhost:3000

## Features

- Email/password sign-in (no public sign-up).
- `/dashboard` — large interactive front/back body diagram, muscles colored by strength level.
- `/admin` — admin-only page to create and delete users.
- Strength levels computed from best lift per exercise vs. age-group standards (`strength_standards`).
