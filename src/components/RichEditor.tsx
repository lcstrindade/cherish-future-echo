import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
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
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import {
  Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Minus, Link as LinkIcon, Image as ImageIcon,
  Youtube as YoutubeIcon, Undo, Redo, Code2, Underline as UnderlineIcon,
  Subscript as SubIcon, Superscript as SupIcon, AlignLeft, AlignCenter,
  AlignRight, AlignJustify, ListChecks, Table as TableIcon, Highlighter,
  Palette, Rows, Columns, Trash2, Eraser,
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
  const [uploading, setUploading] = useState(false);
  const uploadMedia = useServerFn(uploadArticleMedia);
  const uploadAtRef = useRef<(file: File, pos?: number) => void>(() => {});

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: false, allowBase64: false }),
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
    ],
    content: value || "",
    onUpdate: ({ editor }) => onChange(editor.getJSON(), editor.getText()),
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

  const btn = (active: boolean) =>
    `p-2 rounded hover:bg-accent ${active ? "bg-accent text-accent-foreground" : ""}`;

  return (
    <div className="border rounded-md bg-background">
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
      </div>
      <EditorContent editor={editor} />
      <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground border-t">
        <span>{uploading ? "Enviando imagem..." : "Dica: arraste imagens direto para o editor"}</span>
        <span>{editor.storage.characterCount?.words?.() ?? 0} palavras · {editor.storage.characterCount?.characters?.() ?? 0} caracteres</span>
      </div>
    </div>
  );
}