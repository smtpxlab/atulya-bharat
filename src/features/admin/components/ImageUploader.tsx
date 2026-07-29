import { useRef, useState, type DragEvent } from "react";
import { Upload, X, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  uploadChallengeImage,
  type ChallengeImageFolder,
} from "@/services/challenge.service";
import { toast } from "@/hooks/use-toast";

type Props = {
  label: string;
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  folder: ChallengeImageFolder;
  hint?: string;
};

export default function ImageUploader({ label, value, onChange, folder, hint }: Props) {
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = async (file: File) => {
    setBusy(true);
    try {
      const url = await uploadChallengeImage(file, folder);
      onChange(url);
    } catch (e: any) {
      toast({
        title: "Upload failed",
        description: e?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handle(file);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handle(f);
          e.target.value = "";
        }}
      />
      {value ? (
        <div className="group relative overflow-hidden rounded-lg border bg-muted">
          <img
            src={value}
            alt={label}
            className="h-40 w-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Replace
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => onChange(null)}
              disabled={busy}
            >
              <X className="mr-2 h-4 w-4" />
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            "flex h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-sm text-muted-foreground transition-colors",
            dragOver
              ? "border-primary bg-primary/5 text-primary"
              : "border-border hover:border-primary/50 hover:bg-muted/40",
          )}
        >
          {busy ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Uploading…
            </>
          ) : (
            <>
              <Upload className="h-5 w-5" />
              <span>Drag &amp; drop or click to upload</span>
              <span className="text-xs">JPG, PNG, WEBP · max 5 MB</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
