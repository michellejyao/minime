# MiniMe

**An AI that actually remembers you.** Ditto is your digital twin: it speaks as you, thinks from your experiences, and stays consistent across every conversation because it's grounded in a **persistent, searchable memory** of your life, not a fading chat window.

---

## The problem: why generic chatbots forget you

Today's chatbots feel personal only until you scroll up. Under the hood:

- **Context is finite.** Models have a fixed context window; once you hit the limit, older messages are dropped or deprioritized. New chats start from zero. So "remember when I said X?" often fails or responses are not true to your experiences.
- **Memory is selective and opaque.** Features like memory or custom instructions are helpful but limited: small character budgets, no guarantee your preferences or past events are actually used, and no way to search your *entire* history.
- **There's no real identity graph.** The model doesn't maintain a single, evolving picture of you. It has whatever fits in this thread, right now.

The result: details from older conversations slip away, past preferences aren't applied consistently, and the assistant can't reliably connect related events across time. **Persistent identity isn't a feature toggle it's an architecture.**

---

## What Ditto does differently

Ditto doesn't rely on in-conversation memory. It uses a **personal memory store** that:

1. **Stores** your experiences and notes permanently (not just in the current chat).
2. **Retrieves** the most relevant pieces for every question via semantic search over *all* stored memories.
3. **Injects** those exact memories into the prompt so the model always answers from your real context.
4. **Evolves** as you add new memories no manual "remember this?" in each thread.
5. **Stays consistent** across sessions and time, because every answer is grounded in the same retrievable past.

That requires a specific stack: **embeddings + vector DB + retrieval + structured prompting.** MiniMe is that stack.

---

## How it works (technical)

### End-to-end flow

1. **Ingest.** You add a memory (e.g. a note or experience). The backend chunks it (~300-500 tokens, splitting on sentence boundaries), embeds each chunk with **OpenAI `text-embedding-3-small`**, and stores chunks + vectors in **Postgres with pgvector**.
2. **Ask.** You send a message in the chat. The backend embeds your message with the same model.
3. **Retrieve.** It runs a **cosine-similarity search** over *all* memory chunks (using pgvector's HNSW index) and returns the **top 5** most relevant chunks.
4. **Ground.** Those chunks are formatted into a Memory context section and, if you've done the personality flow, your **Big Five (OCEAN)** profile is appended. That block is sent in the same request as your message.
5. **Generate.** **GPT-4o-mini** receives a fixed system prompt (you are the user's digital twin; respond in first person as them; ground every answer in the provided memory; never invent). It sees only the retrieved memories + personality + your message, and returns a response that's consistent with your stored identity.

So: **full vector retrieval over a dedicated personal memory DB**, every time not a small, opaque memory layer inside the product. Chat history is still stored (conversations + messages) for continuity, but the *identity* that shapes replies comes from the memory store and retrieval.

### Stack (backend)

| Concern        | Implementation                                                       |
|----------------|----------------------------------------------------------------------|
| Embeddings     | OpenAI `text-embedding-3-small`                                      |
| Chunking       | tiktoken `cl100k_base`, ~400 tokens, sentence-boundary aware         |
| Vector store   | Supabase Postgres + **pgvector**, HNSW, cosine                       |
| Retrieval      | Top 5 chunks by cosine similarity per query                          |
| LLM            | OpenAI `gpt-4o-mini` with digital-twin system prompt                 |
| API            | FastAPI; `POST /memory` (ingest), `POST /chat` (retrieve + generate) |

The frontend (Next.js) talks to this API, shows the chat and retrieved memories, and can capture memories and run the personality (BFI) flow so Ditto can mirror your style and tendencies as well as your facts.

---

## Repo layout

- **`backend/`**: FastAPI app, embedding + memory + chat services, pgvector models. See **[backend/README.md](backend/README.md)** for setup, env vars, and API details.
- **`app/`**, **`components/`**: Next.js app and UI (chat, sidebar, personality, etc.).

---

## TL;DR

**Problem:** Chatbots forget you because of context limits and adhoc memory.  
**Idea:** Persistent identity = store everything, retrieve what's relevant, inject it every time.  
**Ditto:** Your digital twin backed by a vector DB of your memories and optional personality profile so it actually remembers, stays consistent, and evolves with you.
