import { Link } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";

export function SiteNav() {
  return (
    <header className="border-b bg-background sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="font-semibold flex items-center gap-2">
          <BookOpen className="h-5 w-5" /> Docs
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link
            to="/docs"
            className="px-3 py-1.5 rounded hover:bg-accent"
            activeProps={{ className: "px-3 py-1.5 rounded bg-accent" }}
          >
            Documentação
          </Link>
        </nav>
      </div>
    </header>
  );
}
