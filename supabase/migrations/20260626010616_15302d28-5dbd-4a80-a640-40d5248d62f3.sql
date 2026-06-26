
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;

-- search_articles only returns published rows; make it INVOKER so RLS applies
CREATE OR REPLACE FUNCTION public.search_articles(
  query_text TEXT,
  query_embedding vector(1536) DEFAULT NULL,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID, slug TEXT, title TEXT, excerpt TEXT, category TEXT,
  cover_image_url TEXT, published_at TIMESTAMPTZ, score REAL
)
LANGUAGE SQL STABLE SECURITY INVOKER SET search_path = public
AS $$
  WITH ft AS (
    SELECT a.id, ts_rank(a.search_tsv, websearch_to_tsquery('portuguese', query_text)) AS r
    FROM public.articles a
    WHERE a.status = 'published'
      AND (query_text = '' OR a.search_tsv @@ websearch_to_tsquery('portuguese', query_text))
  ),
  sem AS (
    SELECT a.id, CASE WHEN query_embedding IS NULL THEN 0
                      ELSE 1 - (a.embedding <=> query_embedding) END AS s
    FROM public.articles a WHERE a.status = 'published' AND a.embedding IS NOT NULL
  )
  SELECT a.id, a.slug, a.title, a.excerpt, a.category, a.cover_image_url, a.published_at,
         (COALESCE(ft.r,0) * 1.0 + COALESCE(sem.s,0) * 0.8)::REAL AS score
  FROM public.articles a
  LEFT JOIN ft ON ft.id = a.id
  LEFT JOIN sem ON sem.id = a.id
  WHERE a.status = 'published'
    AND (query_text = '' OR ft.r IS NOT NULL OR sem.s > 0.5)
  ORDER BY score DESC NULLS LAST, a.published_at DESC NULLS LAST
  LIMIT match_count;
$$;
