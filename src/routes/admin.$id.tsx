import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RichEditor } from "@/components/RichEditor";
import { getArticleByIdAdmin, upsertArticle } from "@/lib/articles.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/$id")({
  component: AdminEditor,
});

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function AdminEditor() {
  const { id } = Route.useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const getOne = useServerFn(getArticleByIdAdmin);
  const save = useServerFn(upsertArticle);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [content, setContent] = useState<unknown>("");
  const [contentText, setContentText] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  useEffect(() => {
    if (isNew) return;
    getOne({ data: { id } }).then((row) => {
      if (!row) return;
      const r = row as {
        title: string; slug: string; excerpt: string | null;
        category: string | null; subcategory: string | null; cover_image_url: string | null;
        content: unknown; content_text: string | null; status: "draft" | "published";
      };
      setTitle(r.title);
      setSlug(r.slug);
      setExcerpt(r.excerpt ?? "");
      setCategory(r.category ?? "");
      setSubcategory(r.subcategory ?? "");
      setCoverUrl(r.cover_image_url ?? "");
      setContent(r.content);
      setContentText(r.content_text ?? "");
      setStatus(r.status);
      setSlugTouched(true);
    });
  }, [id, isNew, getOne]);

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(title));
  }, [title, slugTouched]);

  async function onSave(next: "draft" | "published") {
    setSaving(true);
    try {
      const res = await save({
        data: {
          id: isNew ? undefined : id,
          title,
          slug,
          excerpt: excerpt || null,
          category: category || null,
          subcategory: subcategory || null,
          cover_image_url: coverUrl || null,
          content,
          content_text: contentText,
          status: next,
        },
      });
      setStatus(next);
      toast.success(next === "published" ? "Publicado!" : "Salvo");
      if (isNew && res) {
        navigate({ to: "/admin/$id", params: { id: (res as { id: string }).id } });
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {isNew ? "Novo artigo" : "Editar artigo"}
        </h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onSave("draft")}
            disabled={saving || !title || !slug}
          >
            Salvar rascunho
          </Button>
          <Button
            onClick={() => onSave("published")}
            disabled={saving || !title || !slug}
          >
            Publicar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Título</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        {!isNew && (
          <div>
            <Label>Slug</Label>
            <Input
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugTouched(true);
              }}
            />
          </div>
        )}
        <div>
          <Label>Tópico</Label>
          <Input value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
        <div>
          <Label>Subtópico</Label>
          <Input value={subcategory} onChange={(e) => setSubcategory(e.target.value)} />
        </div>
        <div>
          <Label>URL da capa</Label>
          <Input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <Label>Resumo</Label>
          <Textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            rows={2}
          />
        </div>
      </div>

      <div>
        <Label>Conteúdo</Label>
        <RichEditor
          value={content}
          onChange={(json, text) => {
            setContent(json);
            setContentText(text);
          }}
        />
      </div>
      <div className="text-xs text-muted-foreground">Status atual: {status}</div>
    </main>
  );
}
