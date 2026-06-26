import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Youtube from "@tiptap/extension-youtube";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import {
  Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Minus, Link as LinkIcon, Image as ImageIcon,
  Youtube as YoutubeIcon, Undo, Redo,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadArticleMedia } from "@/lib/articles.functions";
import { toast } from "sonner";

type Props = {
  value: unknown;
  onChange: (json: unknown, text: string) => void;
};

export function RichEditor({ value, onChange }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const uploadMedia = useServerFn(uploadArticleMedia);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: false, allowBase64: false }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: "Escreva seu artigo..." }),
      Youtube.configure({ width: 640, height: 360, nocookie: true }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => onChange(editor.getJSON(), editor.getText()),
    editorProps: {
      attributes: {
        class:
          "prose prose-neutral dark:prose-invert max-w-none min-h-[400px] focus:outline-none p-4",
      },
    },
    immediatelyRender: false,
  });

  if (!editor) return null;

  async function handleImageUpload(file: File) {
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
      editor!.chain().focus().setImage({ src: url }).run();
    } catch (e) {
      console.error(e);
      toast.error("Falha ao enviar imagem: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setUploading(false);
    }
  }

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
        <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={btn(editor.isActive("strike"))}><Strikethrough className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleCode().run()} className={btn(editor.isActive("code"))}><Code className="h-4 w-4" /></button>
        <span className="w-px bg-border mx-1" />
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={btn(editor.isActive("heading", { level: 1 }))}><Heading1 className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btn(editor.isActive("heading", { level: 2 }))}><Heading2 className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={btn(editor.isActive("heading", { level: 3 }))}><Heading3 className="h-4 w-4" /></button>
        <span className="w-px bg-border mx-1" />
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(editor.isActive("bulletList"))}><List className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(editor.isActive("orderedList"))}><ListOrdered className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={btn(editor.isActive("blockquote"))}><Quote className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().setHorizontalRule().run()} className={btn(false)}><Minus className="h-4 w-4" /></button>
        <span className="w-px bg-border mx-1" />
        <button type="button" onClick={addLink} className={btn(editor.isActive("link"))}><LinkIcon className="h-4 w-4" /></button>
        <button type="button" onClick={() => fileInput.current?.click()} className={btn(false)} disabled={uploading}><ImageIcon className="h-4 w-4" /></button>
        <button type="button" onClick={addYouTube} className={btn(false)}><YoutubeIcon className="h-4 w-4" /></button>
        <span className="w-px bg-border mx-1" />
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
      {uploading && <div className="px-4 py-2 text-xs text-muted-foreground">Enviando imagem...</div>}
    </div>
  );
}