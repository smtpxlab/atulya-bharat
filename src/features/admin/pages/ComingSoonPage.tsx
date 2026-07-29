import { Construction } from "lucide-react";

export default function ComingSoonPage({ title }: { title: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-background p-8 text-center">
      <Construction className="h-10 w-10 text-muted-foreground" />
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        This module is coming soon. The data model is in place; the admin
        interface will land in a future release.
      </p>
    </div>
  );
}
