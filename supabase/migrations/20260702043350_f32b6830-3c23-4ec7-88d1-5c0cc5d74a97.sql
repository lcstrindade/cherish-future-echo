drop function if exists public.search_articles(text, vector, integer);
create or replace function public.search_articles(
  query_text text,
  query_embedding vector default null,
  match_count int default 10
)
returns table (
  id uuid, slug text, title text, excerpt text, category text, subcategory text,
  cover_image_url text, published_at timestamptz, parent_id uuid, "position" int, icon text, score real
)
language sql
stable
set search_path to public, extensions
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
             extensions.similarity(coalesce(a.title,''), query_text),
             extensions.similarity(coalesce(a.excerpt,''), query_text) * 0.7,
             extensions.similarity(coalesce(a.content_text,''), query_text) * 0.5
           ) as t
    from public.articles a
    where a.status = 'published'
      and query_text <> ''
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