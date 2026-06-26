import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { adminLogout, adminStatus } from "@/lib/admin-auth.functions";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    const res = await adminStatus();
    if (!res.isAdmin) throw redirect({ to: "/auth" });
  },
  component: AdminLayout,
});

function AdminLayout() {
  const logout = useServerFn(adminLogout);
  async function onLogout() {
    await logout();
    window.location.href = "/auth";
  }
  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <div className="max-w-5xl mx-auto px-4 pt-4 flex justify-end">
        <Button variant="ghost" size="sm" onClick={onLogout}>
          <LogOut className="h-4 w-4 mr-1" /> Sair
        </Button>
      </div>
      <Outlet />
    </div>
  );
}
