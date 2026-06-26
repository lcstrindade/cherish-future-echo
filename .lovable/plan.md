## Objetivo

Modernizar a central de ajuda Bivvo com padrões usados por Stripe Docs, Vercel Docs e GitBook — busca por atalho, sumário com scroll-spy, modo escuro, blocos de código destacados, breadcrumbs e refinamento visual.

## Escopo e entregas

### 1. Command Palette (⌘K / Ctrl+K)
- Instalar `cmdk`.
- Novo componente `SearchCommand.tsx` em modal full-screen.
- Atalho global de teclado, navegação por setas, Enter abre artigo.
- Agrupar resultados por tópico, mostrar trecho (snippet) com termo destacado.
- Substituir o input atual da topbar por um botão "Buscar... ⌘K".

### 2. Sumário lateral (TOC) com scroll-spy
- Extrair headings (h2/h3) do JSON do Tiptap no `ArticleRenderer`.
- Componente `ArticleToc.tsx` fixo à direita em telas ≥ lg.
- `IntersectionObserver` destaca a seção ativa.
- Headings com `id` + `scroll-margin-top` para âncora suave.

### 3. Breadcrumbs
- Componente `Breadcrumbs.tsx` no topo de `/docs/$slug`: Docs › Tópico › Subtópico › Título.

### 4. Modo escuro
- Toggle persistente (localStorage) no header.
- Já existe `.dark` em `styles.css`; adicionar `ThemeToggle` com ícones sol/lua.
- Aplicar classe no `<html>` via efeito client-side.

### 5. Syntax highlight nos blocos de código
- Adicionar `@tiptap/extension-code-block-lowlight` + `lowlight` + `highlight.js`.
- Tema claro/escuro condicionado ao modo.
- Botão "copiar" nos blocos do `ArticleRenderer`.

### 6. Callouts (info / warning / tip / success)
- Extensão Tiptap simples baseada em Node custom (`callout`).
- Botões no toolbar do `RichEditor` para inserir.
- Render com ícone + cor (lucide-react + tokens semânticos).

### 7. Refinamento da sidebar
- Tópicos colapsáveis (accordion shadcn) com estado persistido por tópico ativo.
- Barra vertical colorida no item ativo, ícone por categoria opcional.
- Em mobile, sidebar vira `Sheet` acionado por botão hambúrguer.

### 8. Cards Anterior/Próximo aprimorados
- Mostrar nome do tópico em cima, título embaixo, ícones de seta.

### 9. Tipografia e densidade
- Coluna de leitura ~720px, `prose-lg`.
- Headings com `scroll-margin-top: 6rem`.
- Ajustar tokens em `styles.css` para neutros mais suaves no claro/escuro.

### 10. Home (`/`)
- Hero centralizado com botão de busca grande (abre command palette).
- Grid de tópicos com contagem de artigos por categoria, gerado a partir do banco.

## Detalhes técnicos

- **Dependências novas**: `cmdk`, `lowlight`, `highlight.js`, `@tiptap/extension-code-block-lowlight`.
- **Arquivos novos**:
  - `src/components/SearchCommand.tsx`
  - `src/components/ArticleToc.tsx`
  - `src/components/Breadcrumbs.tsx`
  - `src/components/ThemeToggle.tsx`
  - `src/components/CalloutExtension.ts`
  - `src/hooks/use-theme.ts`
- **Arquivos modificados**:
  - `src/routes/docs.tsx` (topbar nova, sidebar accordion, sheet mobile)
  - `src/routes/docs.$slug.tsx` (breadcrumbs, TOC, prev/next melhorados)
  - `src/routes/docs.index.tsx` e `src/routes/index.tsx` (hero novo)
  - `src/components/RichEditor.tsx` (callouts + code-block-lowlight)
  - `src/components/ArticleRenderer.tsx` (callouts + copiar código + ids em headings)
  - `src/components/SiteNav.tsx` (ThemeToggle)
  - `src/styles.css` (tokens refinados, hljs themes)
- **Sem mudanças de schema** — toda a melhoria é de UI/UX.

## Ordem de execução

Vou entregar em duas levas para validar visualmente antes de seguir:

**Leva 1 (esta resposta)** — base estrutural:
1. Command Palette ⌘K
2. Breadcrumbs
3. Dark mode + ThemeToggle
4. Sidebar com accordion + Sheet mobile
5. Tipografia/tokens

**Leva 2 (após você aprovar a leva 1)**:
6. TOC com scroll-spy
7. Syntax highlight + copiar
8. Callouts no editor
9. Prev/Next polidos
10. Home com hero novo
