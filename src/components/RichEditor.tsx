import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { lowlight } from "@/lib/lowlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Youtube from "@tiptap/extension-youtube";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Underline from "@tiptap/extension-underline";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import Typography from "@tiptap/extension-typography";
import CharacterCount from "@tiptap/extension-character-count";
import { Callout, DetailsBlock, VideoEmbed, AlignableImage } from "@/lib/tiptap-extensions";
import { useQuery } from "@tanstack/react-query";
import { listPublishedArticles } from "@/lib/articles.functions";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { useEffect } from "react";
import {
  Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Minus, Link as LinkIcon, Image as ImageIcon,
  Youtube as YoutubeIcon, Undo, Redo, Code2, Underline as UnderlineIcon,
  Subscript as SubIcon, Superscript as SupIcon, AlignLeft, AlignCenter,
  AlignRight, AlignJustify, ListChecks, Table as TableIcon, Highlighter,
  Palette, Rows, Columns, Trash2, Eraser, Info, AlertTriangle, CheckCircle2,
  XCircle, Lightbulb, ChevronDown, Video, FileVideo, BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { uploadArticleMedia } from "@/lib/articles.functions";
import { toast } from "sonner";

type Props = {
  value: unknown;
  onChange: (json: unknown, text: string) => void;
};

const PALETTE = [
  "#0f172a", "#dc2626", "#ea580c", "#ca8a04", "#16a34a",
  "#0891b2", "#2563eb", "#7c3aed", "#db2777", "#6b7280",
];
const HIGHLIGHTS = [
  "#fef08a", "#bbf7d0", "#bfdbfe", "#fecaca", "#e9d5ff",
  "#fed7aa", "#fbcfe8", "#e5e7eb",
];

export function RichEditor({ value, onChange }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(false);
  const [linkQuery, setLinkQuery] = useState("");
  const [slash, setSlash] = useState<{
    open: boolean;
    query: string;
    top: number;
    left: number;
    from: number;
  }>({ open: false, query: "", top: 0, left: 0, from: 0 });
  const [slashIndex, setSlashIndex] = useState(0);
  const uploadMedia = useServerFn(uploadArticleMedia);
  const uploadAtRef = useRef<(file: File, pos?: number) => void>(() => {});
  const { data: allArticles = [] } = useQuery({
    queryKey: ["docs-sidebar"],
    queryFn: () => listPublishedArticles(),
    staleTime: 60_000,
  });

  const editor = useEditor({
    extensions: [
      // StarterKit v3 already ships Link and Underline — disable them so our
      // configured versions win instead of triggering duplicate-extension warnings.
      StarterKit.configure({ codeBlock: false, link: false, underline: false }),
      CodeBlockLowlight.configure({ lowlight, defaultLanguage: "plaintext" }),
      AlignableImage.configure({ inline: false, allowBase64: false }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: "Escreva seu artigo..." }),
      Youtube.configure({ width: 640, height: 360, nocookie: true }),
      Underline,
      Subscript,
      Superscript,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Typography,
      Table.configure({ resizable: true, HTMLAttributes: { class: "tiptap-table" } }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      CharacterCount,
      Callout,
      DetailsBlock,
      VideoEmbed,
    ],
    content: value || "",
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON(), editor.getText());
      // Slash command detection
      const { $from } = editor.state.selection;
      const paraText = $from.parent.textContent;
      if (paraText.startsWith("/") && $from.parent.type.name === "paragraph") {
        const query = paraText.slice(1);
        const start = $from.start();
        const coords = editor.view.coordsAtPos(start);
        const container = (wrapperRef.current ?? editor.view.dom).getBoundingClientRect();
        setSlash({
          open: true,
          query,
          top: coords.bottom - container.top + 6,
          left: coords.left - container.left,
          from: start,
        });
        setSlashIndex(0);
      } else {
        setSlash((s) => (s.open ? { ...s, open: false } : s));
      }
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-neutral dark:prose-invert max-w-none min-h-[400px] focus:outline-none p-4",
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const files = Array.from(event.dataTransfer?.files ?? []).filter((f) =>
          f.type.startsWith("image/"),
        );
        if (files.length === 0) return false;
        event.preventDefault();
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
        const pos = coords?.pos;
        files.forEach((f) => uploadAtRef.current(f, pos));
        return true;
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) =>
          f.type.startsWith("image/"),
        );
        if (files.length === 0) return false;
        event.preventDefault();
        files.forEach((f) => uploadAtRef.current(f));
        return true;
      },
    },
    immediatelyRender: false,
  });

  async function handleImageUpload(file: File, pos?: number) {
    if (!editor) return;
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      const CHUNK = 8192;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode.apply(
          null,
          Array.from(bytes.subarray(i, i + CHUNK)),
        );
      }
      const dataBase64 = btoa(binary);
      const { url } = await uploadMedia({
        data: {
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          dataBase64,
        },
      });
      const chain = editor.chain().focus();
      if (typeof pos === "number") chain.insertContentAt(pos, { type: "image", attrs: { src: url } });
      else chain.setImage({ src: url });
      chain.run();
    } catch (e) {
      console.error(e);
      toast.error("Falha ao enviar imagem: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setUploading(false);
    }
  }

  uploadAtRef.current = handleImageUpload;

  type SlashItem = { label: string; keywords: string; run: () => void };
  const slashItems: SlashItem[] = editor
    ? [
        { label: "Título 1", keywords: "h1 heading titulo", run: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
        { label: "Título 2", keywords: "h2 heading titulo", run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
        { label: "Título 3", keywords: "h3 heading titulo", run: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
        { label: "Lista com marcadores", keywords: "bullet list", run: () => editor.chain().focus().toggleBulletList().run() },
        { label: "Lista numerada", keywords: "ordered list numero", run: () => editor.chain().focus().toggleOrderedList().run() },
        { label: "Lista de tarefas", keywords: "task todo checkbox", run: () => editor.chain().focus().toggleTaskList().run() },
        { label: "Citação", keywords: "quote blockquote", run: () => editor.chain().focus().toggleBlockquote().run() },
        { label: "Divisor", keywords: "hr horizontal rule linha", run: () => editor.chain().focus().setHorizontalRule().run() },
        { label: "Bloco de código", keywords: "code codeblock", run: () => editor.chain().focus().toggleCodeBlock().run() },
        { label: "Tabela 3×3", keywords: "table tabela", run: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
        { label: "Callout: Informação", keywords: "callout info aviso", run: () => editor.chain().focus().setCallout("info").run() },
        { label: "Callout: Dica", keywords: "callout tip dica", run: () => editor.chain().focus().setCallout("tip").run() },
        { label: "Callout: Aviso", keywords: "callout warn atencao", run: () => editor.chain().focus().setCallout("warn").run() },
        { label: "Callout: Perigo", keywords: "callout danger perigo erro", run: () => editor.chain().focus().setCallout("danger").run() },
        { label: "Bloco recolhível", keywords: "toggle details accordion", run: () => editor.chain().focus().insertDetails().run() },
        { label: "Imagem", keywords: "image imagem foto", run: () => fileInput.current?.click() },
        { label: "Vídeo (upload)", keywords: "video mp4", run: () => videoInput.current?.click() },
        { label: "Vídeo YouTube", keywords: "video youtube embed", run: () => addYouTube() },
      ]
    : [];

  const filteredSlash = slash.query
    ? slashItems.filter((i) =>
        (i.label + " " + i.keywords).toLowerCase().includes(slash.query.toLowerCase()),
      )
    : slashItems;

  function runSlash(item: SlashItem) {
    if (!editor) return;
    const to = editor.state.selection.$from.end();
    editor.chain().focus().deleteRange({ from: slash.from, to }).run();
    item.run();
    setSlash((s) => ({ ...s, open: false }));
  }

  useEffect(() => {
    if (!slash.open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setSlash((s) => ({ ...s, open: false })); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setSlashIndex((i) => Math.min(i + 1, filteredSlash.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setSlashIndex((i) => Math.max(i - 1, 0)); }
      else if (e.key === "Enter") {
        const it = filteredSlash[slashIndex];
        if (it) { e.preventDefault(); runSlash(it); }
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [slash.open, slashIndex, filteredSlash]);

  async function handleVideoUpload(file: File) {
    if (!editor) return;
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      const CHUNK = 8192;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode.apply(
          null,
          Array.from(bytes.subarray(i, i + CHUNK)),
        );
      }
      const dataBase64 = btoa(binary);
      const { url } = await uploadMedia({
        data: {
          filename: file.name,
          contentType: file.type || "video/mp4",
          dataBase64,
        },
      });
      editor.chain().focus().setVideo({ src: url }).run();
    } catch (e) {
      console.error(e);
      toast.error("Falha ao enviar vídeo: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setUploading(false);
    }
  }

  if (!editor) return null;

  function addYouTube() {
    const url = window.prompt("URL do vídeo (YouTube)");
    if (!url) return;
    editor!.chain().focus().setYoutubeVideo({ src: url }).run();
  }

  function addLink() {
    const url = window.prompt("URL");
    if (!url) return;
    editor!.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  function insertInternalLink(slug: string, title: string) {
    editor!
      .chain()
      .focus()
      .insertContent(
        `<a href="/docs/${slug}" data-internal="true">${title}</a>`,
      )
      .run();
  }

  function setImageAlign(align: "left" | "center" | "right" | null) {
    editor!.chain().focus().updateAttributes("image", { align }).run();
  }

  const btn = (active: boolean) =>
    `p-2 rounded hover:bg-accent ${active ? "bg-accent text-accent-foreground" : ""}`;

  const CALLOUTS: Array<{ id: "info"|"tip"|"success"|"warn"|"danger"; label: string; Icon: typeof Info }> = [
    { id: "info", label: "Informação", Icon: Info },
    { id: "tip", label: "Dica", Icon: Lightbulb },
    { id: "success", label: "Sucesso", Icon: CheckCircle2 },
    { id: "warn", label: "Aviso", Icon: AlertTriangle },
    { id: "danger", label: "Perigo", Icon: XCircle },
  ];
  const filteredArticles = linkQuery.trim()
    ? allArticles.filter((a) =>
        a.title.toLowerCase().includes(linkQuery.toLowerCase()),
      ).slice(0, 8)
    : allArticles.slice(0, 8);

  return (
    <div ref={wrapperRef} className="border rounded-md bg-background relative">
      <div className="flex flex-wrap gap-1 border-b p-2 sticky top-0 bg-background z-10">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btn(editor.isActive("bold"))}><Bold className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btn(editor.isActive("italic"))}><Italic className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={btn(editor.isActive("underline"))} title="Sublinhado"><UnderlineIcon className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={btn(editor.isActive("strike"))}><Strikethrough className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleCode().run()} className={btn(editor.isActive("code"))}><Code className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={btn(editor.isActive("codeBlock"))} title="Bloco de código"><Code2 className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleSubscript().run()} className={btn(editor.isActive("subscript"))} title="Subscrito"><SubIcon className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleSuperscript().run()} className={btn(editor.isActive("superscript"))} title="Sobrescrito"><SupIcon className="h-4 w-4" /></button>
        <span className="w-px bg-border mx-1" />
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={btn(editor.isActive("heading", { level: 1 }))}><Heading1 className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btn(editor.isActive("heading", { level: 2 }))}><Heading2 className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={btn(editor.isActive("heading", { level: 3 }))}><Heading3 className="h-4 w-4" /></button>
        <span className="w-px bg-border mx-1" />
        <button type="button" onClick={() => editor.chain().focus().setTextAlign("left").run()} className={btn(editor.isActive({ textAlign: "left" }))} title="Alinhar à esquerda"><AlignLeft className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().setTextAlign("center").run()} className={btn(editor.isActive({ textAlign: "center" }))} title="Centralizar"><AlignCenter className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().setTextAlign("right").run()} className={btn(editor.isActive({ textAlign: "right" }))} title="Alinhar à direita"><AlignRight className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().setTextAlign("justify").run()} className={btn(editor.isActive({ textAlign: "justify" }))} title="Justificar"><AlignJustify className="h-4 w-4" /></button>
        <span className="w-px bg-border mx-1" />
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(editor.isActive("bulletList"))}><List className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(editor.isActive("orderedList"))}><ListOrdered className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleTaskList().run()} className={btn(editor.isActive("taskList"))} title="Lista de tarefas"><ListChecks className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={btn(editor.isActive("blockquote"))}><Quote className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().setHorizontalRule().run()} className={btn(false)}><Minus className="h-4 w-4" /></button>
        <span className="w-px bg-border mx-1" />
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className={btn(false)} title="Cor do texto"><Palette className="h-4 w-4" /></button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2">
            <div className="grid grid-cols-5 gap-1">
              {PALETTE.map((c) => (
                <button key={c} type="button" onClick={() => editor.chain().focus().setColor(c).run()} className="h-6 w-6 rounded border" style={{ background: c }} />
              ))}
            </div>
            <button type="button" onClick={() => editor.chain().focus().unsetColor().run()} className="mt-2 w-full text-xs flex items-center gap-1 px-2 py-1 rounded hover:bg-accent"><Eraser className="h-3 w-3" /> Remover cor</button>
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className={btn(editor.isActive("highlight"))} title="Marca-texto"><Highlighter className="h-4 w-4" /></button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2">
            <div className="grid grid-cols-4 gap-1">
              {HIGHLIGHTS.map((c) => (
                <button key={c} type="button" onClick={() => editor.chain().focus().toggleHighlight({ color: c }).run()} className="h-6 w-6 rounded border" style={{ background: c }} />
              ))}
            </div>
            <button type="button" onClick={() => editor.chain().focus().unsetHighlight().run()} className="mt-2 w-full text-xs flex items-center gap-1 px-2 py-1 rounded hover:bg-accent"><Eraser className="h-3 w-3" /> Remover</button>
          </PopoverContent>
        </Popover>
        <span className="w-px bg-border mx-1" />
        <button type="button" onClick={addLink} className={btn(editor.isActive("link"))}><LinkIcon className="h-4 w-4" /></button>
        <button type="button" onClick={() => fileInput.current?.click()} className={btn(false)} disabled={uploading}><ImageIcon className="h-4 w-4" /></button>
        <button type="button" onClick={addYouTube} className={btn(false)}><YoutubeIcon className="h-4 w-4" /></button>
        <button type="button" onClick={() => videoInput.current?.click()} className={btn(false)} disabled={uploading} title="Enviar vídeo (MP4)"><FileVideo className="h-4 w-4" /></button>
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className={btn(false)} title="Link para artigo"><BookOpen className="h-4 w-4" /></button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2">
            <input
              autoFocus
              value={linkQuery}
              onChange={(e) => setLinkQuery(e.target.value)}
              placeholder="Buscar artigo..."
              className="w-full h-8 px-2 rounded border bg-background text-sm mb-2"
            />
            <div className="max-h-64 overflow-y-auto space-y-0.5">
              {filteredArticles.length === 0 && (
                <div className="text-xs text-muted-foreground px-2 py-1">Nenhum artigo</div>
              )}
              {filteredArticles.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => { insertInternalLink(a.slug, a.title); setLinkQuery(""); }}
                  className="w-full text-left text-sm px-2 py-1 rounded hover:bg-accent truncate"
                >
                  {a.title}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className={btn(editor.isActive("callout"))} title="Callout / Aviso"><Info className="h-4 w-4" /></button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-1">
            {CALLOUTS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => editor.chain().focus().toggleCallout(id).run()}
                className="w-full flex items-center gap-2 text-sm px-2 py-1.5 rounded hover:bg-accent"
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
            {editor.isActive("callout") && (
              <>
                <div className="h-px bg-border my-1" />
                <button type="button" onClick={() => editor.chain().focus().unsetCallout().run()} className="w-full flex items-center gap-2 text-sm px-2 py-1.5 rounded hover:bg-accent text-muted-foreground"><Eraser className="h-3 w-3" /> Remover</button>
              </>
            )}
          </PopoverContent>
        </Popover>
        <button type="button" onClick={() => editor.chain().focus().insertDetails().run()} className={btn(editor.isActive("detailsBlock"))} title="Bloco recolhível"><ChevronDown className="h-4 w-4" /></button>
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className={btn(editor.isActive("table"))} title="Tabela"><TableIcon className="h-4 w-4" /></button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2 space-y-1 text-sm">
            <button type="button" className="w-full text-left px-2 py-1 rounded hover:bg-accent" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>Inserir tabela 3×3</button>
            <div className="h-px bg-border my-1" />
            <button type="button" className="w-full text-left px-2 py-1 rounded hover:bg-accent flex items-center gap-2" onClick={() => editor.chain().focus().addRowAfter().run()}><Rows className="h-3 w-3" /> Adicionar linha</button>
            <button type="button" className="w-full text-left px-2 py-1 rounded hover:bg-accent flex items-center gap-2" onClick={() => editor.chain().focus().addColumnAfter().run()}><Columns className="h-3 w-3" /> Adicionar coluna</button>
            <button type="button" className="w-full text-left px-2 py-1 rounded hover:bg-accent" onClick={() => editor.chain().focus().deleteRow().run()}>Excluir linha</button>
            <button type="button" className="w-full text-left px-2 py-1 rounded hover:bg-accent" onClick={() => editor.chain().focus().deleteColumn().run()}>Excluir coluna</button>
            <button type="button" className="w-full text-left px-2 py-1 rounded hover:bg-accent" onClick={() => editor.chain().focus().toggleHeaderRow().run()}>Alternar cabeçalho</button>
            <div className="h-px bg-border my-1" />
            <button type="button" className="w-full text-left px-2 py-1 rounded hover:bg-accent text-destructive flex items-center gap-2" onClick={() => editor.chain().focus().deleteTable().run()}><Trash2 className="h-3 w-3" /> Excluir tabela</button>
          </PopoverContent>
        </Popover>
        <span className="w-px bg-border mx-1" />
        <button type="button" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} className={btn(false)} title="Limpar formatação"><Eraser className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().undo().run()} className={btn(false)}><Undo className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().redo().run()} className={btn(false)}><Redo className="h-4 w-4" /></button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImageUpload(f);
            e.target.value = "";
          }}
        />
        <input
          ref={videoInput}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleVideoUpload(f);
            e.target.value = "";
          }}
        />
      </div>
      <EditorContent editor={editor} />
      {slash.open && filteredSlash.length > 0 && (
        <div
          className="absolute z-50 w-64 max-h-72 overflow-y-auto rounded-md border bg-popover shadow-md p-1"
          style={{ top: slash.top, left: slash.left }}
        >
          {filteredSlash.map((it, i) => (
            <button
              key={it.label}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); runSlash(it); }}
              onMouseEnter={() => setSlashIndex(i)}
              className={`w-full text-left text-sm px-2 py-1.5 rounded ${i === slashIndex ? "bg-accent" : ""}`}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
      {editor.isActive("image") && (
        <div className="flex items-center gap-2 px-4 py-2 text-xs border-t bg-muted/40">
          <span className="text-muted-foreground">Imagem:</span>
          <button type="button" onClick={() => setImageAlign("left")} className={btn(false)} title="Esquerda"><AlignLeft className="h-4 w-4" /></button>
          <button type="button" onClick={() => setImageAlign("center")} className={btn(false)} title="Centro"><AlignCenter className="h-4 w-4" /></button>
          <button type="button" onClick={() => setImageAlign("right")} className={btn(false)} title="Direita"><AlignRight className="h-4 w-4" /></button>
          <button type="button" onClick={() => setImageAlign(null)} className={btn(false)} title="Padrão"><Eraser className="h-4 w-4" /></button>
        </div>
      )}
      {editor.isActive("codeBlock") && (
        <div className="flex items-center gap-2 px-4 py-2 text-xs border-t bg-muted/40">
          <span className="text-muted-foreground">Linguagem:</span>
          <select
            className="h-7 px-2 rounded border bg-background text-xs"
            value={editor.getAttributes("codeBlock").language || "plaintext"}
            onChange={(e) => editor.chain().focus().updateAttributes("codeBlock", { language: e.target.value }).run()}
          >
            {["plaintext","javascript","typescript","html","css","json","bash","python","sql","markdown","go","rust","java","php","xml"].map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
      )}
      <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground border-t">
        <span>{uploading ? "Enviando imagem..." : "Dica: arraste imagens direto para o editor"}</span>
        <span>{editor.storage.characterCount?.words?.() ?? 0} palavras · {editor.storage.characterCount?.characters?.() ?? 0} caracteres</span>
      </div>
    </div>
  );
}