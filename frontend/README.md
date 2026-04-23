# Execution AI Frontend

Next.js frontend for Execution AI.

## Auth Modes

- `NEXT_PUBLIC_AUTH_LOCAL_ONLY=true`
  Browser-only demo accounts. No Supabase auth calls.
- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  Supabase email/password auth.
- `NEXT_PUBLIC_SUPABASE_OTP_AUTH=true`
  Supabase email OTP auth. Requires working outbound email in Supabase.

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Required Environment Variables

Create `frontend/.env.local` with the values you need:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_AUTH_LOCAL_ONLY=false
NEXT_PUBLIC_SUPABASE_OTP_AUTH=false
```

## Quality Checks

```bash
npm run lint
npm run build
```

## Returning User Smoke Test

Run these checks after backend migration `005_sessions_auth_user_link.sql`:

1. Sign up a new user and complete onboarding.
2. Log out and sign back in with that same user in the same browser.
3. Refresh `/dashboard` and confirm the user stays on the dashboard.
4. Open a fresh browser profile, sign in again, and confirm the app restores the existing workspace instead of starting onboarding from scratch.

## Key Rotation Reminder

If active credentials were shared or committed, rotate:

- `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `frontend/.env.local`
- Matching backend secrets in `backend/.env`

Then restart both apps so they load the new values.
