import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RichEditor } from "@/components/RichEditor";
import { IconPicker } from "@/components/IconPicker";
import {
  getArticleByIdAdmin,
  listAllArticlesAdmin,
  upsertArticle,
} from "@/lib/articles.functions";
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
  const [parentId, setParentId] = useState<string>("");
  const [icon, setIcon] = useState<string | null>(null);

  const listAll = useServerFn(listAllArticlesAdmin);
  const { data: allArticles = [] } = useQuery({
    queryKey: ["admin-articles"],
    queryFn: () => listAll(),
  });

  // Prevent choosing self or a descendant as parent
  const invalidParents = useMemo(() => {
    const set = new Set<string>();
    if (isNew) return set;
    set.add(id);
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const a of allArticles as { id: string; parent_id: string | null }[]) {
        if (a.parent_id === cur && !set.has(a.id)) {
          set.add(a.id);
          stack.push(a.id);
        }
      }
    }
    return set;
  }, [allArticles, id, isNew]);

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
      setParentId((r as { parent_id?: string | null }).parent_id ?? "");
      setIcon((r as { icon?: string | null }).icon ?? null);
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
          parent_id: parentId || null,
          icon: icon,
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
          <Label>Ícone</Label>
          <div className="mt-1">
            <IconPicker value={icon} onChange={setIcon} />
          </div>
        </div>
        <div>
          <Label>URL da capa</Label>
          <Input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} />
        </div>
        <div>
          <Label>Página pai</Label>
          <select
            className="w-full h-10 px-3 rounded-md border bg-background text-sm"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
          >
            <option value="">— Sem pai (raiz) —</option>
            {(allArticles as { id: string; title: string; parent_id: string | null }[])
              .filter((a) => !invalidParents.has(a.id))
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {indentTitle(a.id, allArticles as { id: string; parent_id: string | null; title: string }[])}
                </option>
              ))}
          </select>
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

function indentTitle(
  id: string,
  all: { id: string; parent_id: string | null; title: string }[],
): string {
  const byId = new Map(all.map((a) => [a.id, a]));
  let depth = 0;
  let cur = byId.get(id);
  const title = cur?.title ?? "";
  while (cur?.parent_id) {
    depth += 1;
    cur = byId.get(cur.parent_id);
    if (depth > 20) break;
  }
  return `${"— ".repeat(depth)}${title}`;
}
