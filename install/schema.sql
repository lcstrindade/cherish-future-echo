-- ============================================================================
-- Bivvo Docs — Schema completo do Supabase
-- Execute este arquivo UMA vez no SQL Editor do seu Supabase (self-hosted ou cloud).
-- ============================================================================

-- 1) Extensões
CREATE EXTENSION IF NOT EXISTS vector;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;

-- 2) Roles de usuário
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own roles" ON public.user_roles;
CREATE POLICY "Users can read their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

-- 3) Artigos
CREATE TABLE IF NOT EXISTS public.articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_text TEXT NOT NULL DEFAULT '',
  cover_image_url TEXT,
  category TEXT,
  subcategory TEXT,
  icon TEXT,
  parent_id UUID REFERENCES public.articles(id) ON DELETE CASCADE,
  "position" INTEGER NOT NULL DEFAULT 0,
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

DROP POLICY IF EXISTS "Anyone can read published articles" ON public.articles;
CREATE POLICY "Anyone can read published articles" ON public.articles
  FOR SELECT TO anon, authenticated USING (status = 'published');

DROP POLICY IF EXISTS "Admins can read all articles" ON public.articles;
CREATE POLICY "Admins can read all articles" ON public.articles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert articles" ON public.articles;
CREATE POLICY "Admins can insert articles" ON public.articles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update articles" ON public.articles;
CREATE POLICY "Admins can update articles" ON public.articles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete articles" ON public.articles;
CREATE POLICY "Admins can delete articles" ON public.articles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS articles_search_tsv_idx ON public.articles USING GIN (search_tsv);
CREATE INDEX IF NOT EXISTS articles_embedding_idx ON public.articles USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS articles_status_idx ON public.articles (status, published_at DESC);
CREATE INDEX IF NOT EXISTS articles_parent_position_idx ON public.articles(parent_id, "position");
CREATE INDEX IF NOT EXISTS articles_title_trgm ON public.articles USING GIN (title extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS articles_content_trgm ON public.articles USING GIN (content_text extensions.gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS articles_updated_at ON public.articles;
CREATE TRIGGER articles_updated_at BEFORE UPDATE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Busca híbrida (full-text + embeddings + trigram)
DROP FUNCTION IF EXISTS public.search_articles(text, vector, integer);
CREATE OR REPLACE FUNCTION public.search_articles(
  query_text text,
  query_embedding vector DEFAULT NULL,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid, slug text, title text, excerpt text, category text, subcategory text,
  cover_image_url text, published_at timestamptz, parent_id uuid, "position" int, icon text, score real
)
LANGUAGE SQL STABLE
SET search_path TO public, extensions
AS $$
  with ft as (
    select a.id, ts_rank(a.search_tsv, websearch_to_tsquery('portuguese', query_text)) as r
    from public.articles a
    where a.status = 'published' and query_text <> ''
      and a.search_tsv @@ websearch_to_tsquery('portuguese', query_text)
  ),
  sem as (
    select a.id,
           case when query_embedding is null then 0
                else 1 - (a.embedding <=> query_embedding) end as s
    from public.articles a where a.status = 'published' and a.embedding is not null
  ),
  trg as (
    select a.id,
           greatest(
             extensions.similarity(coalesce(a.title,''), query_text),
             extensions.similarity(coalesce(a.excerpt,''), query_text) * 0.7,
             extensions.similarity(coalesce(a.content_text,''), query_text) * 0.5
           ) as t
    from public.articles a
    where a.status = 'published' and query_text <> ''
      and (
        a.title ilike '%' || query_text || '%'
        or a.excerpt ilike '%' || query_text || '%'
        or a.content_text ilike '%' || query_text || '%'
        or extensions.similarity(coalesce(a.title,''), query_text) > 0.2
        or extensions.similarity(coalesce(a.content_text,''), query_text) > 0.15
      )
  )
  select a.id, a.slug, a.title, a.excerpt, a.category, a.subcategory, a.cover_image_url, a.published_at,
         a.parent_id, a."position", a.icon,
         (coalesce(ft.r,0) * 1.2 + coalesce(sem.s,0) * 1.0 + coalesce(trg.t,0) * 0.6)::real as score
  from public.articles a
  left join ft on ft.id = a.id
  left join sem on sem.id = a.id
  left join trg on trg.id = a.id
  where a.status = 'published'
    and (query_text = '' or ft.r is not null or sem.s > 0.25 or trg.t is not null)
  order by score desc nulls last, a.published_at desc nulls last
  limit match_count;
$$;

-- 5) Storage: bucket para imagens/vídeos dos artigos
INSERT INTO storage.buckets (id, name, public)
VALUES ('article-media', 'article-media', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Admins upload article media" ON storage.objects;
CREATE POLICY "Admins upload article media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'article-media' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update article media" ON storage.objects;
CREATE POLICY "Admins update article media" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'article-media' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins delete article media" ON storage.objects;
CREATE POLICY "Admins delete article media" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'article-media' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins read article media" ON storage.objects;
CREATE POLICY "Admins read article media" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'article-media' AND public.has_role(auth.uid(), 'admin'));

-- 6) Artigo de exemplo
INSERT INTO public.articles (slug, title, excerpt, content, content_text, category, status, published_at)
VALUES (
  'artigo-teste',
  'Artigo de teste',
  'Este é um artigo de exemplo para validar a área de documentação.',
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Bem-vindo à documentação!"}]}]}'::jsonb,
  'Bem-vindo à documentação!',
  'Introdução',
  'published',
  now()
) ON CONFLICT (slug) DO NOTHING;
