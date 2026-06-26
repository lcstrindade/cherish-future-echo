import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SiteNav } from "@/components/SiteNav";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { isCurrentUserAdmin } from "@/lib/articles.functions";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const check = useServerFn(isCurrentUserAdmin);
  const { data, isLoading } = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => check({}),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteNav />
        <div className="p-8 text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!data?.isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <SiteNav />
        <div className="max-w-xl mx-auto mt-20 p-8 text-center border rounded-lg">
          <ShieldAlert className="h-10 w-10 mx-auto text-destructive mb-3" />
          <h1 className="text-xl font-bold mb-2">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground mb-3">
            Sua conta não tem permissão de admin. Para se promover, peça ao
            time para executar no banco:
          </p>
          <code className="text-xs bg-muted p-2 rounded block text-left">
            INSERT INTO public.user_roles (user_id, role) VALUES ('{data?.userId}', 'admin');
          </code>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <Outlet />
    </div>
  );
}