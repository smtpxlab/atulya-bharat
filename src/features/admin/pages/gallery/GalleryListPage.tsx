import { useRef, useState, type DragEvent } from "react";
import { format } from "date-fns";
import { Trash2, Upload, ImageOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  useAdminGallery,
  useDeleteGalleryImage,
  useUploadGalleryImages,
} from "@/features/admin/hooks/useAdminGallery";

const PAGE_SIZE = 20;
const fmt = (d: string | null) => (d ? format(new Date(d), "MMM d, yyyy p") : "—");

export default function GalleryListPage() {
  const [page, setPage] = useState(1);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [queued, setQueued] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, error } = useAdminGallery({ page, pageSize: PAGE_SIZE });
  const upload = useUploadGalleryImages();
  const del = useDeleteGalleryImage();

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const addFiles = (files: FileList | File[] | null) => {
    if (!files) return;
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (arr.length === 0) return;
    setQueued((prev) => [...prev, ...arr]);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  const handleUpload = () => {
    if (queued.length === 0) return;
    upload.mutate(queued, {
      onSuccess: (rows) => {
        toast({ title: `Uploaded ${rows.length} image${rows.length === 1 ? "" : "s"}` });
        setQueued([]);
        setPage(1);
      },
      onError: (e) =>
        toast({
          title: "Upload failed",
          description: (e as Error).message,
          variant: "destructive",
        }),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Gallery</h1>
        <p className="text-sm text-muted-foreground">
          Upload images shown on the public gallery page.
        </p>
      </div>

      {/* Upload zone */}
      <div className="space-y-3 rounded-md border bg-background p-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-8 text-center transition ${
            dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/60"
          }`}
        >
          <Upload className="h-6 w-6 text-muted-foreground" />
          <div className="text-sm">
            <span className="font-medium">Click to choose files</span> or drag and drop
          </div>
          <p className="text-xs text-muted-foreground">PNG, JPG, WebP — multiple allowed</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {queued.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              {queued.length} file{queued.length === 1 ? "" : "s"} ready
            </div>
            <div className="flex flex-wrap gap-2">
              {queued.map((f, i) => (
                <div
                  key={i}
                  className="relative h-20 w-20 overflow-hidden rounded border bg-muted"
                >
                  <img
                    src={URL.createObjectURL(f)}
                    alt={f.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleUpload} disabled={upload.isPending}>
                {upload.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" /> Upload {queued.length}
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setQueued([])}
                disabled={upload.isPending}
              >
                Clear
              </Button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      )}

      <div className="rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">S.No.</TableHead>
              <TableHead className="w-24">Image</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead className="w-20 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={4}>
                    <Skeleton className="h-10 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  No images yet.
                </TableCell>
              </TableRow>
            ) : (
              items.map((img, i) => (
                <TableRow key={img.id}>
                  <TableCell>{(page - 1) * PAGE_SIZE + i + 1}</TableCell>
                  <TableCell>
                    {img.image_url ? (
                      <button
                        type="button"
                        onClick={() => setPreviewUrl(img.image_url)}
                        className="block h-12 w-16 overflow-hidden rounded border"
                      >
                        <img
                          src={img.image_url}
                          alt=""
                          className="h-full w-full object-cover transition hover:scale-105"
                        />
                      </button>
                    ) : (
                      <div className="flex h-12 w-16 items-center justify-center rounded bg-muted text-muted-foreground">
                        <ImageOff className="h-4 w-4" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{fmt(img.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setConfirmId(img.id)}
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <div className="text-muted-foreground">
          {total} total · page {page} of {totalPages}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </Button>
        </div>
      </div>

      <AlertDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this image?</AlertDialogTitle>
            <AlertDialogDescription>
              The file will be removed from storage. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirmId) return;
                del.mutate(confirmId, {
                  onSuccess: () => {
                    toast({ title: "Image deleted" });
                    setConfirmId(null);
                  },
                  onError: (e) =>
                    toast({
                      title: "Delete failed",
                      description: (e as Error).message,
                      variant: "destructive",
                    }),
                });
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!previewUrl} onOpenChange={(o) => !o && setPreviewUrl(null)}>
        <DialogContent className="max-w-3xl p-2">
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Preview"
              className="max-h-[80vh] w-full rounded object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
