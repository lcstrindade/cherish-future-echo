import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BookOpen, LogOut } from "lucide-react";

export function SiteNav() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setEmail(s?.user.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <header className="border-b bg-background sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="font-semibold flex items-center gap-2">
          <BookOpen className="h-5 w-5" /> Docs
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link to="/docs" className="px-3 py-1.5 rounded hover:bg-accent" activeProps={{ className: "px-3 py-1.5 rounded bg-accent" }}>
            Documentação
          </Link>
          {email ? (
            <>
              <Link to="/admin" className="px-3 py-1.5 rounded hover:bg-accent">Admin</Link>
              <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}>
                <LogOut className="h-4 w-4 mr-1" /> Sair
              </Button>
            </>
          ) : (
            <Link to="/auth" className="px-3 py-1.5 rounded hover:bg-accent">Entrar</Link>
          )}
        </nav>
      </div>
    </header>
  );
}