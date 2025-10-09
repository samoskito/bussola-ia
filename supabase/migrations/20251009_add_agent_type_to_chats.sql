-- Add agent_type column to chats and backfill
BEGIN;

-- 1) Add column with constraint
ALTER TABLE IF EXISTS public.chats
  ADD COLUMN IF NOT EXISTS agent_type TEXT CHECK (agent_type IN ('comunicacao', 'apresentacao'));

-- 2) Optional: create index for filtering by user and type
CREATE INDEX IF NOT EXISTS idx_chats_user_type ON public.chats (user_id, agent_type);

-- 3) Backfill existing rows heuristically using title
UPDATE public.chats
SET agent_type = CASE
  WHEN title ILIKE '%apresenta%' OR title ILIKE '%reuniao%' OR title ILIKE '%reunião%' THEN 'apresentacao'
  ELSE 'comunicacao'
END
WHERE agent_type IS NULL;

COMMIT;
