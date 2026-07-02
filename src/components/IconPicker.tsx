import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ARTICLE_ICONS, ARTICLE_ICON_NAMES, ArticleIcon } from "./ArticleIcon";
import { X } from "lucide-react";

export function IconPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = q
    ? ARTICLE_ICON_NAMES.filter((n) => n.includes(q.toLowerCase()))
    : ARTICLE_ICON_NAMES;
  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="h-10 gap-2">
            {value && ARTICLE_ICONS[value] ? (
              <>
                <ArticleIcon name={value} className="h-4 w-4" />
                <span className="text-xs text-muted-foreground">{value}</span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">Escolher ícone</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-2">
          <Input
            autoFocus
            placeholder="Buscar ícone..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="mb-2 h-8"
          />
          <div className="grid grid-cols-8 gap-1 max-h-64 overflow-y-auto">
            {filtered.map((name) => (
              <button
                key={name}
                type="button"
                title={name}
                onClick={() => {
                  onChange(name);
                  setOpen(false);
                }}
                className={
                  "h-8 w-8 rounded flex items-center justify-center hover:bg-accent " +
                  (value === name ? "bg-accent ring-1 ring-primary" : "")
                }
              >
                <ArticleIcon name={name} className="h-4 w-4" />
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-8 text-xs text-muted-foreground p-2">
                Nenhum ícone encontrado.
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onChange(null)}
          aria-label="Remover ícone"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
