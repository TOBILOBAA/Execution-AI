# Execution AI

Execution AI is organized as a single project root with two app folders:

- `frontend/`: Next.js product UI
- `backend/`: FastAPI + Supabase integration layer

The root exists for shared project tooling, deployment coordination, and QA utilities.

## Local Development

Frontend:

```bash
npm run dev:frontend
```

Backend:

```bash
npm run dev:backend
```

## Verification

Build the frontend:

```bash
npm run build:frontend
```

Run the browser smoke script:

```bash
npm run qa:ui-smoke
```

## Notes

- Frontend environment variables live in `frontend/.env.local`
- Backend environment variables live in `backend/.env`
- The backend runner at `run_backend.py` starts the API from the repo root safely
