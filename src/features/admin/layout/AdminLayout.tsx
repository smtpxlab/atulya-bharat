import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { AdminHeader } from "./AdminHeader";
import { SEO } from "@/components/SEO";
import AdminContentSkeleton from "@/components/skeletons/AdminContentSkeleton";

export default function AdminLayout() {
  return (
    <SidebarProvider>
      <SEO title="Admin — Atulya Bharat Run" description="ABR admin console" />
      <div className="flex min-h-dvh w-full bg-muted/30">
        <AdminSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AdminHeader />
          <main className="flex-1 p-6">
            <Suspense fallback={<AdminContentSkeleton />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
