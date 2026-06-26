import { useEffect, useState, type RefObject } from "react";

type TocItem = { id: string; text: string; level: number };

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60) || "section";
}

export function ArticleToc({
  containerRef,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let observer: IntersectionObserver | null = null;

    const scan = () => {
      const headings = Array.from(
        container.querySelectorAll("h2, h3"),
      ) as HTMLHeadingElement[];
      if (headings.length === 0) {
        setItems([]);
        return;
      }
      const used = new Set<string>();
      const list: TocItem[] = headings.map((h) => {
        const text = (h.textContent ?? "").trim();
        const base = slugify(text);
        let id = base;
        let i = 2;
        while (used.has(id)) id = `${base}-${i++}`;
        used.add(id);
        h.id = id;
        return { id, text, level: h.tagName === "H2" ? 2 : 3 };
      });
      setItems((prev) => {
        if (
          prev.length === list.length &&
          prev.every((p, idx) => p.id === list[idx].id)
        )
          return prev;
        return list;
      });

      observer?.disconnect();
      observer = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((e) => e.isIntersecting)
            .sort(
              (a, b) =>
                a.boundingClientRect.top - b.boundingClientRect.top,
            );
          if (visible[0]) setActiveId((visible[0].target as HTMLElement).id);
        },
        { rootMargin: "-90px 0px -65% 0px", threshold: [0, 1] },
      );
      headings.forEach((h) => observer!.observe(h));
    };

    scan();
    const mo = new MutationObserver(() => scan());
    mo.observe(container, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      observer?.disconnect();
    };
  }, [containerRef]);

  if (items.length === 0) return null;

  return (
    <nav aria-label="Nesta página" className="text-sm">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Nesta página
      </div>
      <ul className="space-y-1.5 border-l border-border">
        {items.map((item) => {
          const isActive = item.id === activeId;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  const el = document.getElementById(item.id);
                  if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "start" });
                    history.replaceState(null, "", `#${item.id}`);
                    setActiveId(item.id);
                  }
                }}
                className={
                  "block -ml-px border-l py-1 transition-colors " +
                  (item.level === 3 ? "pl-6 " : "pl-3 ") +
                  (isActive
                    ? "border-primary text-foreground font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-foreground/30")
                }
              >
                {item.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}