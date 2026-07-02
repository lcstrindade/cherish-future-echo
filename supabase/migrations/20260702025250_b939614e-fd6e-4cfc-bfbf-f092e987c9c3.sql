
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.articles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS articles_parent_position_idx
  ON public.articles(parent_id, position);

-- Backfill: order existing published articles by (category, subcategory, published_at)
WITH ordered AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY COALESCE(category,''), COALESCE(subcategory,'')
           ORDER BY published_at NULLS LAST, created_at
         ) - 1 AS rn
  FROM public.articles
)
UPDATE public.articles a
   SET position = o.rn
  FROM ordered o
 WHERE a.id = o.id AND a.position = 0;
