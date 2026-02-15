-- Add optional "when did this happen?" timestamp to memories.
-- Run this in Supabase SQL Editor if your memories table already exists.
-- New installs get the column via SQLAlchemy create_all.

ALTER TABLE memories
ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN memories.occurred_at IS 'When the experience/event actually happened (optional; distinct from created_at).';
