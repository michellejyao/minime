# Digital Twin AI Backend

Production-grade backend for a Digital Twin AI: persistent identity with memory embeddings and grounded chat (FastAPI, Supabase Postgres + pgvector, OpenAI).

## Requirements

- Python 3.11+
- Supabase project with Postgres and [pgvector](https://github.com/pgvector/pgvector) enabled
- OpenAI API key

## Setup

1. **Create and activate a virtual environment** (do this before installing dependencies)

   ```bash
   cd backend
   python -m venv .venv
   ```

   Then activate it:

   - **Windows (PowerShell):** `.venv\Scripts\Activate.ps1`
   - **Windows (cmd):** `.venv\Scripts\activate.bat`
   - **macOS/Linux:** `source .venv/bin/activate`

   Your prompt should show `(.venv)` when the environment is active.

2. **Install dependencies** (with the venv activated)

   ```bash
   pip install -r requirements.txt
   ```

3. **Environment variables**

   Copy `.env.example` to `.env` and set:

   - `OPENAI_API_KEY` — your OpenAI API key
   - `SUPABASE_DB_URL` — Supabase Postgres URL in **async** form:
     - Get it from Supabase: **Connect** or **Database → Settings** → Connection string (URI).
     - Change `postgresql://` to `postgresql+asyncpg://`.
     - **Replace `[YOUR-PASSWORD]`** with your real database password (no square brackets).
     - If you see "Not IPv4 compatible", use the **Session Pooler** (or "Pooler settings") URI instead of the direct URI—the pooler host works over IPv4.
   - `ELEVENLABS_API_KEY` — for Interview Mode voice (female/male/neutral/clone).

4. **Enable pgvector in Supabase** (if not already)

   In Supabase SQL Editor:

   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

5. **Run the API**

   From the `backend` directory:

   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

   - Docs: http://localhost:8000/docs  
   - Health: http://localhost:8000/health  

## API

   - **POST /memory** — Ingest a memory (title, content, memory_type, optional occurred_at). Content is chunked (~300–500 tokens), embedded with `text-embedding-3-small`, and stored in `memories` and `memory_chunks`. Use `occurred_at` so Ditto can answer time-based questions (e.g. "what happened last week?").
   - **POST /chat** — Send a message; backend embeds it, retrieves top 5 chunks by cosine similarity, and returns an OpenAI-generated response plus the retrieved memories.

## Troubleshooting

- **`getaddrinfo failed` or "could not resolve database host"**  
  Either the host in `SUPABASE_DB_URL` is wrong, or your network is IPv4-only while the DB host is IPv6. Fix:
  1. **Use the Session Pooler URL** (Supabase → Connect or Pooler settings). The pooler host (e.g. `...pooler.supabase.com`) is IPv4-compatible; the direct `db....supabase.co` host is often IPv6-only.
  2. Copy that URI, change `postgresql://` to `postgresql+asyncpg://`.
  3. **Replace `[YOUR-PASSWORD]`** with your actual database password—**no square brackets**, just the password characters.
  4. Put the final URL in `.env` as `SUPABASE_DB_URL=...`.

- **"SUPABASE_DB_URL must be set to your real Supabase connection URI"**  
  You still have a placeholder in `.env`. Replace `PROJECT_REF` and the password with your real Supabase project ref and database password.

## Project structure

```
backend/
  app/
    main.py           # FastAPI app, lifespan, routers
    config.py         # Pydantic Settings (env)
    db.py             # Async engine, session, init_db
    models.py         # SQLAlchemy models (memories, memory_chunks, conversations, messages)
    schemas.py        # Pydantic request/response
    services/
      embedding_service.py  # OpenAI embeddings
      memory_service.py     # Chunking + ingest
      chat_service.py       # Retrieval + LLM
    routers/
      memory_router.py      # POST /memory
      chat_router.py        # POST /chat
  requirements.txt
  .env.example
```

## Database

Tables are created on startup via `init_db()`:

- `memories` — one row per ingested memory (includes optional `occurred_at` for when the experience happened)
- `memory_chunks` — chunks with `embedding` (pgvector); HNSW index for cosine similarity
- `conversations` / `messages` — for future conversation history

**Existing databases:** If you already have a `memories` table, run the migration in `migrations/add_memory_occurred_at.sql` (e.g. in Supabase SQL Editor) to add the `occurred_at` column.

Vector search uses pgvector cosine distance: `ORDER BY embedding <=> query_embedding` (top 5 chunks).
