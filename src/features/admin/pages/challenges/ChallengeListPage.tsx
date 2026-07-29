import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Trash2, Search, ImageOff, MapPin, Users } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  useAdminChallenges,
  useDeleteChallenge,
  useToggleChallengeStatus,
} from "@/features/admin/hooks/useAdminChallenges";
import { isChallengeExpired } from "@/lib/challengeStatus";


const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function Thumb({ src, alt }: { src: string | null; alt: string }) {
  if (!src)
    return (
      <div className="flex h-12 w-16 items-center justify-center rounded bg-muted text-muted-foreground">
        <ImageOff className="h-4 w-4" />
      </div>
    );
  return (
    <img
      src={src}
      alt={alt}
      className="h-12 w-16 rounded object-cover"
      loading="lazy"
    />
  );
}

function TagChips({ tags }: { tags: string[] }) {
  if (!tags || tags.length === 0) return <span className="text-muted-foreground">—</span>;
  const visible = tags.slice(0, 3);
  const extra = tags.length - visible.length;
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((t) => (
        <span
          key={t}
          className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs"
        >
          {t}
        </span>
      ))}
      {extra > 0 && (
        <span className="text-xs text-muted-foreground">+{extra} more</span>
      )}
    </div>
  );
}

const fmt = (d: string | null) => (d ? format(new Date(d), "dd MMM yyyy, HH:mm") : "—");

export default function ChallengeListPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading, isError } = useAdminChallenges({
    search,
    page,
    pageSize,
    status: "all",
  });
  const toggle = useToggleChallengeStatus();
  const del = useDeleteChallenge();

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Challenges</h1>
          <p className="text-sm text-muted-foreground">
            Manage all challenges, tickets, and assets.
          </p>
        </div>
        <Button asChild>
          <Link to="/admin/challenges/new">
            <Plus className="mr-2 h-4 w-4" /> Add Challenge
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name…"
            className="pl-9"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Show</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              setPage(1);
              setPageSize(Number(v));
            }}
          >
            <SelectTrigger className="w-[90px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span>entries</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">S.No.</TableHead>
              <TableHead>Challenge Name</TableHead>
              <TableHead>Challenge Cover</TableHead>
              <TableHead>Challenge Map</TableHead>
              <TableHead>Start Date Time</TableHead>
              <TableHead>End Date Time</TableHead>
              <TableHead>Challenge Type</TableHead>
              <TableHead>Distance</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 12 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {isError && (
              <TableRow>
                <TableCell colSpan={12} className="py-8 text-center text-destructive">
                  Could not load challenges.
                </TableCell>
              </TableRow>
            )}

            {!isLoading && !isError && (data?.items.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={12} className="py-12 text-center text-muted-foreground">
                  No challenges yet. Click <strong>Add Challenge</strong> to create one.
                </TableCell>
              </TableRow>
            )}

            {(data?.items ?? []).map((c, idx) => (
              <TableRow key={c.id}>
                <TableCell>{(page - 1) * pageSize + idx + 1}</TableCell>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>
                  <Thumb src={c.cover_image_url} alt={`${c.name} cover`} />
                </TableCell>
                <TableCell>
                  <Thumb src={c.about_map_image_url} alt={`${c.name} map`} />
                </TableCell>
                <TableCell className="whitespace-nowrap">{fmt(c.start_at)}</TableCell>
                <TableCell className="whitespace-nowrap">{fmt(c.end_at)}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{c.challenge_type}</Badge>
                </TableCell>
                <TableCell>{c.distance} km</TableCell>
                <TableCell><TagChips tags={c.tags} /></TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={c.status}
                      onCheckedChange={(v) =>
                        toggle.mutate({ id: c.id, status: v })
                      }
                    />
                    <span className="text-xs text-muted-foreground">
                      {c.status ? "Enable" : "Disable"}
                    </span>
                    {isChallengeExpired(c.end_at) && (
                      <Badge variant="destructive">Expired</Badge>
                    )}
                  </div>
                </TableCell>

                <TableCell className="whitespace-nowrap">
                  {format(new Date(c.created_at), "dd MMM yyyy")}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button asChild variant="ghost" size="icon" title="Participants">
                      <Link to={`/admin/challenges/${c.id}/participants`}>
                        <Users className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild variant="ghost" size="icon" title="Edit">
                      <Link to={`/admin/challenges/${c.id}/edit`}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild variant="ghost" size="icon" title="Edit Route">
                      <Link to={`/admin/challenges/${c.id}/edit-route`}>
                        <MapPin className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Delete"
                      onClick={() => setDeleteId(c.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {data && data.total > pageSize && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {page} of {totalPages} · {data.total} total
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this challenge?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the challenge and all its tickets. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) del.mutate(deleteId);
                setDeleteId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
