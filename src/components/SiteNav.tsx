import { Link } from "@tanstack/react-router";

export function SiteNav() {
  return (
    <header className="border-b bg-background sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="font-semibold flex items-center gap-2">
          <img
            src="https://adm.bivvo.com.br/publicLogo?t=1778778948975"
            alt="Logo"
            className="h-7 w-auto"
          />
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link
            to="/docs"
            className="px-3 py-1.5 rounded hover:bg-accent"
            activeProps={{ className: "px-3 py-1.5 rounded bg-accent" }}
          >
            Documentação
          </Link>
          <a
            href="https://app.bivvo.com.br"
            className="px-3 py-1.5 rounded bg-primary text-primary-foreground hover:opacity-90"
          >
            Acessar Bivvo
          </a>
        </nav>
      </div>
    </header>
  );
}
