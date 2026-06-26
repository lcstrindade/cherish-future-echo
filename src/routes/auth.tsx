import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { BookOpen } from "lucide-react";
import { adminLogin } from "@/lib/admin-auth.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const login = useServerFn(adminLogin);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await login({ data: { username, password } });
      if (res.ok) {
        navigate({ to: "/admin" });
      } else {
        toast.error("Usuário ou senha inválidos");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 justify-center mb-6 font-semibold">
          <BookOpen className="h-5 w-5" /> Docs
        </Link>
        <div className="border rounded-lg p-6 bg-card">
          <h1 className="text-2xl font-bold mb-1">Entrar</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Acesso restrito ao admin.
          </p>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label htmlFor="username">Usuário</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "..." : "Entrar"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
