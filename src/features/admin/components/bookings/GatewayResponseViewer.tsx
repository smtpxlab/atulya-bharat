import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GatewayResponseViewer({ data }: { data: unknown }) {
  const [open, setOpen] = useState(false);
  const pretty = JSON.stringify(data ?? {}, null, 2);
  return (
    <div className="rounded-md border bg-muted/20">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full justify-start"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <ChevronDown className="mr-2 h-4 w-4" />
        ) : (
          <ChevronRight className="mr-2 h-4 w-4" />
        )}
        Gateway Response (JSON)
      </Button>
      {open && (
        <pre className="max-h-96 overflow-auto border-t bg-background p-3 text-xs">
          {pretty}
        </pre>
      )}
    </div>
  );
}
