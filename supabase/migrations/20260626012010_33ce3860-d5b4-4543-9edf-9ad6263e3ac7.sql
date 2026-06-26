INSERT INTO public.articles (slug, title, excerpt, content, content_text, category, status, published_at)
VALUES (
  'artigo-teste',
  'Artigo de teste',
  'Este é um artigo de exemplo para validar a área de documentação.',
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Bem-vindo à documentação! Este é um artigo de teste criado automaticamente para validar o layout e a busca."}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Como funciona"}]},{"type":"paragraph","content":[{"type":"text","text":"Use a barra de busca acima para encontrar artigos por palavra-chave ou contexto."}]}]}'::jsonb,
  'Bem-vindo à documentação! Este é um artigo de teste criado automaticamente para validar o layout e a busca. Como funciona. Use a barra de busca acima para encontrar artigos por palavra-chave ou contexto.',
  'Introdução',
  'published',
  now()
)
ON CONFLICT (slug) DO NOTHING;