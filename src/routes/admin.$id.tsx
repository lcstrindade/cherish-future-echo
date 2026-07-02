import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [autoSaving, setAutoSaving] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [publishOpen, setPublishOpen] = useState(false);
  const savedSnapshotRef = useRef<Record<string, unknown> | null>(null);
  const skipAutosaveRef = useRef(true);
  const currentIdRef = useRef<string>(id);
  useEffect(() => { currentIdRef.current = id; }, [id]);

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
      setLastSavedAt(new Date());
      skipAutosaveRef.current = true;
      savedSnapshotRef.current = snapshot({
        title: r.title, slug: r.slug, excerpt: r.excerpt ?? "",
        category: r.category ?? "", subcategory: r.subcategory ?? "",
        coverUrl: r.cover_image_url ?? "", content: r.content,
        parentId: (r as { parent_id?: string | null }).parent_id ?? "",
        icon: (r as { icon?: string | null }).icon ?? null,
      });
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
      setLastSavedAt(new Date());
      savedSnapshotRef.current = snapshot({
        title, slug, excerpt, category, subcategory,
        coverUrl, content, parentId, icon,
      });
      if (isNew && res) {
        navigate({ to: "/admin/$id", params: { id: (res as { id: string }).id } });
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // Autosave (only for existing articles)
  useEffect(() => {
    if (isNew) return;
    // Nunca autosalvar quando já publicado — publicação/atualização exige confirmação
    if (status === "published") return;
    if (skipAutosaveRef.current) { skipAutosaveRef.current = false; return; }
    if (!title || !slug) return;
    const t = setTimeout(async () => {
      const runId = currentIdRef.current;
      if (runId !== id) return;
      setAutoSaving(true);
      try {
        await save({
          data: {
            id, title, slug,
            excerpt: excerpt || null,
            category: category || null,
            subcategory: subcategory || null,
            cover_image_url: coverUrl || null,
            content, content_text: contentText,
            status: "draft",
            parent_id: parentId || null,
            icon,
          },
        });
        setLastSavedAt(new Date());
        savedSnapshotRef.current = snapshot({
          title, slug, excerpt, category, subcategory,
          coverUrl, content, parentId, icon,
        });
      } catch {
        // silent
      } finally {
        setAutoSaving(false);
      }
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, slug, excerpt, category, subcategory, coverUrl, content, contentText, parentId, icon, status]);

  // Tick "salvo há Xs"
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(i);
  }, []);

  const savedAgo = lastSavedAt ? formatAgo(now - lastSavedAt.getTime()) : null;

  const currentSnapshot = snapshot({
    title, slug, excerpt, category, subcategory,
    coverUrl, content, parentId, icon,
  });
  const changes = diffSnapshots(savedSnapshotRef.current, currentSnapshot);

  return (
    <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {isNew ? "Novo artigo" : "Editar artigo"}
        </h1>
        <div className="flex items-center gap-3">
          {!isNew && (
            <span className="text-xs text-muted-foreground">
              {status === "published"
                ? "Publicado — clique em Publicar para atualizar"
                : autoSaving
                ? "Salvando..."
                : savedAgo
                ? `Rascunho salvo ${savedAgo}`
                : ""}
            </span>
          )}
          <Button
            variant="outline"
            onClick={() => onSave("draft")}
            disabled={saving || !title || !slug}
          >
            Salvar rascunho
          </Button>
          <Button
            onClick={() => setPublishOpen(true)}
            disabled={saving || !title || !slug}
          >
            Publicar
          </Button>
        </div>
      </div>

      <AlertDialog open={publishOpen} onOpenChange={setPublishOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar publicação</AlertDialogTitle>
            <AlertDialogDescription>
              {changes.length === 0
                ? "Nenhuma alteração desde o último rascunho salvo. Deseja publicar mesmo assim?"
                : "Revise as alterações desde o último rascunho salvo antes de publicar:"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {changes.length > 0 && (
            <ul className="max-h-64 overflow-auto rounded-md border bg-muted/30 p-3 text-sm space-y-1">
              {changes.map((c) => (
                <li key={c.field} className="flex gap-2">
                  <span className="font-medium">{c.label}:</span>
                  <span className="text-muted-foreground">{c.summary}</span>
                </li>
              ))}
            </ul>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setPublishOpen(false);
                onSave("published");
              }}
            >
              Publicar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

function formatAgo(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 5) return "agora";
  if (s < 60) return `há ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  return `há ${h}h`;
}
