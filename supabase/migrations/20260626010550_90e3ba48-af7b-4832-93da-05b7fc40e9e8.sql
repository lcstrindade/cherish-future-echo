
-- Extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Articles
CREATE TABLE public.articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_text TEXT NOT NULL DEFAULT '',
  cover_image_url TEXT,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  embedding vector(1536),
  search_tsv tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('portuguese', coalesce(title,'')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(excerpt,'')), 'B') ||
    setweight(to_tsvector('portuguese', coalesce(content_text,'')), 'C')
  ) STORED,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.articles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.articles TO authenticated;
GRANT ALL ON public.articles TO service_role;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read published articles" ON public.articles
  FOR SELECT TO anon, authenticated USING (status = 'published');

CREATE POLICY "Admins can read all articles" ON public.articles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert articles" ON public.articles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update articles" ON public.articles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete articles" ON public.articles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX articles_search_tsv_idx ON public.articles USING GIN (search_tsv);
CREATE INDEX articles_embedding_idx ON public.articles USING hnsw (embedding vector_cosine_ops);
CREATE INDEX articles_status_idx ON public.articles (status, published_at DESC);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER articles_updated_at BEFORE UPDATE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Hybrid search: combines full-text rank and embedding similarity
CREATE OR REPLACE FUNCTION public.search_articles(
  query_text TEXT,
  query_embedding vector(1536) DEFAULT NULL,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID, slug TEXT, title TEXT, excerpt TEXT, category TEXT,
  cover_image_url TEXT, published_at TIMESTAMPTZ, score REAL
)
LANGUAGE SQL STABLE SET search_path = public
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
