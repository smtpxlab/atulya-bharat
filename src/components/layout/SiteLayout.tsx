import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { TopNotificationBar } from "./TopNotificationBar";
import PageShellSkeleton from "@/components/skeletons/PageShellSkeleton";

export const SiteLayout = () => {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <TopNotificationBar />
      <Navbar />
      <main className="flex-1">
        <Suspense fallback={<PageShellSkeleton />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
};
