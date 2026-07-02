import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Plus, Pencil, Trash2, ChevronRight, ChevronUp, ChevronDown,
  IndentIncrease, IndentDecrease,
} from "lucide-react";
import {
  listAllArticlesAdmin,
  deleteArticle,
  reorderArticles,
} from "@/lib/articles.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/")({
  component: AdminList,
});

type AdminArticle = {
  id: string;
  slug: string;
  title: string;
  status: string;
  parent_id: string | null;
  position: number;
};
type AdminNode = AdminArticle & { children: AdminNode[] };

function AdminList() {
  const list = useServerFn(listAllArticlesAdmin);
  const del = useServerFn(deleteArticle);
  const reorder = useServerFn(reorderArticles);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-articles"],
    queryFn: () => list(),
  });
  const articles = (data ?? []) as AdminArticle[];
  const tree = useMemo(() => buildTree(articles), [articles]);

  async function onDelete(id: string) {
    if (!confirm("Excluir este artigo?")) return;
    try {
      await del({ data: { id } });
      toast.success("Excluído");
      qc.invalidateQueries({ queryKey: ["admin-articles"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function applyMove(
    updates: { id: string; parent_id: string | null; position: number }[],
  ) {
    try {
      await reorder({ data: { updates } });
      qc.invalidateQueries({ queryKey: ["admin-articles"] });
      qc.invalidateQueries({ queryKey: ["docs-sidebar"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function moveVertical(nodeId: string, dir: -1 | 1) {
    const node = articles.find((a) => a.id === nodeId);
    if (!node) return;
    const siblings = articles
      .filter((a) => a.parent_id === node.parent_id)
      .sort((a, b) => a.position - b.position);
    const idx = siblings.findIndex((s) => s.id === nodeId);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;
    const reordered = [...siblings];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    applyMove(reordered.map((s, i) => ({ id: s.id, parent_id: s.parent_id, position: i })));
  }

  function indent(nodeId: string) {
    const node = articles.find((a) => a.id === nodeId);
    if (!node) return;
    const siblings = articles
      .filter((a) => a.parent_id === node.parent_id)
      .sort((a, b) => a.position - b.position);
    const idx = siblings.findIndex((s) => s.id === nodeId);
    if (idx <= 0) return;
    const newParent = siblings[idx - 1];
    const newSiblings = articles
      .filter((a) => a.parent_id === newParent.id)
      .sort((a, b) => a.position - b.position);
    applyMove([
      { id: nodeId, parent_id: newParent.id, position: newSiblings.length },
    ]);
  }

  function outdent(nodeId: string) {
    const node = articles.find((a) => a.id === nodeId);
    if (!node || !node.parent_id) return;
    const parent = articles.find((a) => a.id === node.parent_id);
    if (!parent) return;
    const grandParent = parent.parent_id;
    const uncles = articles
      .filter((a) => a.parent_id === grandParent)
      .sort((a, b) => a.position - b.position);
    const parentIdx = uncles.findIndex((u) => u.id === parent.id);
    const updates: { id: string; parent_id: string | null; position: number }[] = [];
    updates.push({ id: nodeId, parent_id: grandParent, position: parentIdx + 1 });
    // Shift uncles after parent by +1 to make room
    uncles.slice(parentIdx + 1).forEach((u, i) => {
      updates.push({ id: u.id, parent_id: grandParent, position: parentIdx + 2 + i });
    });
    applyMove(updates);
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Artigos</h1>
        <Button asChild>
          <Link to="/admin/$id" params={{ id: "new" }}>
            <Plus className="h-4 w-4 mr-2" /> Novo artigo
          </Link>
        </Button>
      </div>
      {isLoading && <div className="text-muted-foreground">Carregando...</div>}
      <div className="border rounded-lg divide-y">
        {tree.map((n) => (
          <TreeRow
            key={n.id}
            node={n}
            depth={0}
            onDelete={onDelete}
            onMoveUp={(id) => moveVertical(id, -1)}
            onMoveDown={(id) => moveVertical(id, 1)}
            onIndent={indent}
            onOutdent={outdent}
          />
        ))}
        {!isLoading && tree.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            Nenhum artigo ainda.
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        Use as setas para reordenar. Use os botões de indentação para transformar em subitem
        ou promover ao nível de cima.
      </p>
    </main>
  );
}

function buildTree(all: AdminArticle[]): AdminNode[] {
  const byId = new Map<string, AdminNode>();
  all.forEach((a) => byId.set(a.id, { ...a, children: [] }));
  const roots: AdminNode[] = [];
  for (const n of byId.values()) {
    if (n.parent_id && byId.has(n.parent_id)) byId.get(n.parent_id)!.children.push(n);
    else roots.push(n);
  }
  const sortRec = (nodes: AdminNode[]) => {
    nodes.sort((a, b) => a.position - b.position);
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

function TreeRow({
  node, depth, onDelete, onMoveUp, onMoveDown, onIndent, onOutdent,
}: {
  node: AdminNode;
  depth: number;
  onDelete: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onIndent: (id: string) => void;
  onOutdent: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const has = node.children.length > 0;
  return (
    <div>
      <div
        className="p-3 flex items-center gap-2"
        style={{ paddingLeft: `${12 + depth * 20}px` }}
      >
        {has ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label={open ? "Recolher" : "Expandir"}
          >
            <ChevronRight className={"h-3.5 w-3.5 transition-transform " + (open ? "rotate-90" : "")} />
          </button>
        ) : (
          <span className="h-6 w-6" />
        )}
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate">{node.title}</div>
          <div className="text-xs text-muted-foreground">
            /{node.slug} ·{" "}
            <span className={node.status === "published" ? "text-green-600" : "text-amber-600"}>
              {node.status}
            </span>
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => onMoveUp(node.id)} aria-label="Subir">
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onMoveDown(node.id)} aria-label="Descer">
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onOutdent(node.id)} aria-label="Promover">
            <IndentDecrease className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onIndent(node.id)} aria-label="Aninhar">
            <IndentIncrease className="h-4 w-4" />
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/$id" params={{ id: node.id }}>
              <Pencil className="h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => onDelete(node.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {has && open && (
        <div className="border-t">
          {node.children.map((c) => (
            <TreeRow
              key={c.id}
              node={c}
              depth={depth + 1}
              onDelete={onDelete}
              onMoveUp={onMoveUp}
              onMoveDown={onMoveDown}
              onIndent={onIndent}
              onOutdent={onOutdent}
            />
          ))}
        </div>
      )}
    </div>
  );
}
