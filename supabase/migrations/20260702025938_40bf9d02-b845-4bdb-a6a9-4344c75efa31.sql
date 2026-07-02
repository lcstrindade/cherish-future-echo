
create extension if not exists pg_trgm;

create index if not exists articles_title_trgm on public.articles using gin (title gin_trgm_ops);
create index if not exists articles_content_trgm on public.articles using gin (content_text gin_trgm_ops);

create or replace function public.search_articles(
  query_text text,
  query_embedding vector default null,
  match_count int default 10
)
returns table (
  id uuid, slug text, title text, excerpt text, category text,
  cover_image_url text, published_at timestamptz, score real
)
language sql
stable
set search_path to 'public'
as $$
  with ft as (
    select a.id,
           ts_rank(a.search_tsv, websearch_to_tsquery('portuguese', query_text)) as r
    from public.articles a
    where a.status = 'published'
      and query_text <> ''
      and a.search_tsv @@ websearch_to_tsquery('portuguese', query_text)
  ),
  sem as (
    select a.id,
           case when query_embedding is null then 0
                else 1 - (a.embedding <=> query_embedding) end as s
    from public.articles a
    where a.status = 'published' and a.embedding is not null
  ),
  trg as (
    select a.id,
           greatest(
             similarity(coalesce(a.title,''), query_text),
             similarity(coalesce(a.excerpt,''), query_text) * 0.7,
             similarity(coalesce(a.content_text,''), query_text) * 0.5
           ) as t
    from public.articles a
    where a.status = 'published'
      and query_text <> ''
      and (
        a.title ilike '%' || query_text || '%'
        or a.excerpt ilike '%' || query_text || '%'
        or a.content_text ilike '%' || query_text || '%'
        or similarity(coalesce(a.title,''), query_text) > 0.2
        or similarity(coalesce(a.content_text,''), query_text) > 0.15
      )
  )
  select a.id, a.slug, a.title, a.excerpt, a.category, a.cover_image_url, a.published_at,
         (coalesce(ft.r,0) * 1.2
          + coalesce(sem.s,0) * 1.0
          + coalesce(trg.t,0) * 0.6)::real as score
  from public.articles a
  left join ft on ft.id = a.id
  left join sem on sem.id = a.id
  left join trg on trg.id = a.id
  where a.status = 'published'
    and (
      query_text = ''
      or ft.r is not null
      or sem.s > 0.25
      or trg.t is not null
    )
  order by score desc nulls last, a.published_at desc nulls last
  limit match_count;
$$;
