## Diagnóstico atual

O sistema é uma central de docs estilo GitBook com:
- Autenticação admin via sessão fixa (`admin` / senha), sem contas públicas.
- Editor Tiptap com upload autenticado de imagens (drag/drop/paste) e YouTube.
- Busca híbrida (full-text pt + embeddings vetoriais) via `search_articles` + AI Gateway.
- Sidebar hierárquica (Tópico → Subtópico → Artigo), breadcrumbs, TOC scroll-spy, prev/next, ⌘K, footer global.
- Redirect `/` → `/docs`, logo Bivvo, botão "Acessar Bivvo".

### Pontos fracos identificados

1. **SEO fraco** — `__root.tsx` ainda usa `title: "Lovable App"` e `description: "Lovable Generated Project"` (viola diretriz). Sem sitemap, sem canonical, sem JSON-LD de artigo.
2. **Segurança** — credenciais admin em env, mas sem rate-limit no `/auth`; nenhuma proteção contra brute-force.
3. **Editor limitado** — falta headings H2/H3 no toolbar (essencial pro TOC funcionar), listas ordenadas, tabelas, blocos de código com highlight, callouts (info/warning/tip), quote, alinhamento e undo/redo visíveis.
4. **Imagens** — sem alt text, sem redimensionamento, sem legenda; Base64 → server é ineficiente para arquivos grandes (limite payload).
5. **UX de leitura** — sem "tempo de leitura", sem botão "copiar link" no heading, sem feedback ("isto foi útil?"), sem histórico de versões, sem tags.
6. **Busca** — não destaca termo no snippet, sem histórico recente, sem "buscas populares", sem filtro por tópico.
7. **Admin** — listagem sem filtro/busca/paginação; sem preview antes de publicar; sem draft vs published claro na UI; sem reordenação manual de artigos (hoje é ordem do banco).
8. **Analytics** — nenhum tracking de artigo visto/pesquisado.
9. **Acessibilidade** — foco visível inconsistente, alguns botões só com ícone sem `aria-label`, contraste do sidebar em `text-muted-foreground` baixo.
10. **Performance** — `listPublishedArticles` retorna tudo sempre; sem paginação; imagens sem lazy-loading explícito nem `width/height`.
11. **Mobile** — TOC some (ok), mas prev/next e breadcrumbs poderiam encolher melhor; sidebar Sheet ok.
12. **404/erros** — página 404 ainda em inglês ("Page not found"), destoa do resto em pt-BR.

## Plano de melhorias (em ondas)

### Onda 1 — Fundamentos (alto impacto, baixo esforço)
1. Corrigir SEO do `__root.tsx`: título "Central de Ajuda Bivvo", description real, og:title/description, twitter:card.
2. Adicionar `head()` por artigo já existe — acrescentar JSON-LD `TechArticle` com `datePublished`/`dateModified`.
3. Traduzir 404 e página de erro para pt-BR, com logo Bivvo.
4. Rate-limit simples no login admin (contador por IP em memória + cooldown).
5. Toolbar do editor: adicionar H1/H2/H3, listas, quote, code block, undo/redo, link, alinhamento.
6. Heading anchors com botão "copiar link" no `ArticleRenderer`.
7. Tempo de leitura estimado no topo do artigo.

### Onda 2 — Conteúdo e busca
8. Upload de imagem via multipart (não Base64) — servidor recebe `FormData`, aceita arquivos até 10 MB.
9. Alt text + legenda opcional no upload de imagem (modal antes de inserir).
10. Callouts (info / aviso / dica / sucesso) como node Tiptap custom.
11. Syntax highlight nos code blocks com `lowlight` + botão copiar.
12. Snippet da busca com destaque do termo (`<mark>`).
13. Filtro por tópico dentro do ⌘K.
14. Tags no artigo (nova coluna `tags text[]`) exibidas no cabeçalho e filtráveis.

### Onda 3 — Admin e workflow
15. Listagem admin: busca, filtro por status, paginação (10/pg).
16. Coluna `status` (`draft` | `published`) — hoje só `published_at`; deixar explícito com badge e toggle.
17. Preview do artigo antes de publicar (rota `/admin/preview/$id`).
18. Ordenação manual de artigos dentro do subtópico (coluna `position int`) com drag-and-drop.
19. Rascunho automático (autosave a cada 10s no `admin.$id`).

### Onda 4 — Engajamento e métricas
20. Widget "Este artigo foi útil? 👍 👎" com tabela `article_feedback`.
21. Tracking de visualizações (`article_views` + `search_queries`) para relatório interno.
22. Página `/admin/analytics` com top artigos e top buscas sem resultado.
23. Sitemap.xml gerado por route file (`/sitemap[.]xml.tsx`) e `robots.txt`.

### Onda 5 — Polimento
24. Acessibilidade: `aria-label` em todos icon buttons, foco visível padrão, revisar contraste.
25. Skeleton loaders no sidebar e no artigo.
26. Lazy-load de imagens (`loading="lazy"`, `decoding="async"`) no renderer.
27. Dark mode opcional (foi removido a pedido — manter fora salvo pedido explícito).

## Detalhes técnicos

- **Schema novo**: `articles.tags text[]`, `articles.status text default 'published'`, `articles.position int default 0`; tabelas `article_feedback(article_id, vote, created_at)`, `article_views(article_id, created_at, session_hash)`, `search_queries(query, has_results, created_at)`. Todas com GRANT + RLS (leitura pública onde faz sentido, escrita via server function com `supabaseAdmin`).
- **Editor**: extensões novas — `@tiptap/extension-heading` (já vem no starter-kit, expor no toolbar), `@tiptap/extension-code-block-lowlight`, `lowlight`, `highlight.js`; node custom `Callout`.
- **Upload multipart**: server route em `src/routes/api/admin/upload.ts` protegida por cookie de sessão admin, retorna URL assinada de 1 ano.
- **JSON-LD**: helper em `src/lib/seo.ts`, injetado via `scripts` no `head()` do artigo.
- **Rate-limit**: `Map<ip, {count, until}>` em `admin-auth.functions.ts` (memória do worker basta para o volume).
- **Sitemap**: `src/routes/sitemap[.]xml.tsx` com `server.handlers.GET` lendo `listPublishedArticles`.

## Ordem de execução sugerida

Recomendo começar pela **Onda 1** inteira em uma resposta (fundamentos + editor decente), validar visualmente, depois seguir para as próximas ondas conforme prioridade sua.

## Confirmação

Quer que eu execute a Onda 1 já? Se preferir outra ordem (ex.: pular direto para Callouts + syntax highlight, ou priorizar analytics), me diz.
