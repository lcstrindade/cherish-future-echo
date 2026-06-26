import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Youtube from "@tiptap/extension-youtube";

export function ArticleRenderer({ content }: { content: unknown }) {
  const editor = useEditor({
    editable: false,
    extensions: [
      StarterKit,
      Image,
      Link.configure({ openOnClick: true }),
      Youtube.configure({ nocookie: true }),
    ],
    content: (content as object) ?? "",
    editorProps: {
      attributes: { class: "prose prose-neutral max-w-none" },
    },
    immediatelyRender: false,
  });
  if (!editor) return null;
  return <EditorContent editor={editor} />;
}