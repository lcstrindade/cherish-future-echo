import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SiteNav } from "@/components/SiteNav";

export const Route = createFileRoute("/docs")({
  component: () => (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <Outlet />
    </div>
  ),
});