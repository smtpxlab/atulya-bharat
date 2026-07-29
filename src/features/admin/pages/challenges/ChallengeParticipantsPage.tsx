import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { adminParticipantsService } from "@/features/admin/services/participants.admin";

const PAGE_SIZE = 25;

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    active: "bg-blue-500/10 text-blue-700 border-blue-500/30",
    completed: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
    cancelled: "bg-zinc-500/10 text-zinc-700 border-zinc-500/30",
    expired: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  };
  return (
    <Badge variant="outline" className={map[status] ?? ""}>
      {status}
    </Badge>
  );
};

const paymentBadge = (status: string) => {
  const map: Record<string, string> = {
    paid: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
    pending: "bg-amber-500/10 text-amber-700 border-amber-500/30",
    failed: "bg-red-500/10 text-red-700 border-red-500/30",
    refunded: "bg-zinc-500/10 text-zinc-700 border-zinc-500/30",
  };
  return (
    <Badge variant="outline" className={map[status] ?? ""}>
      {status}
    </Badge>
  );
};

export default function ChallengeParticipantsPage() {
  const { id = "" } = useParams<{ id: string }>();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);

  const debouncedSearch = useMemo(() => search.trim(), [search]);

  const listQ = useQuery({
    queryKey: ["admin", "participants", id, debouncedSearch, status, page],
    queryFn: () =>
      adminParticipantsService.list({
        challengeId: id,
        search: debouncedSearch || undefined,
        status,
        page,
        pageSize: PAGE_SIZE,
      }),
    enabled: !!id,
  });

  const statsQ = useQuery({
    queryKey: ["admin", "participants", id, "stats"],
    queryFn: () => adminParticipantsService.stats(id),
    enabled: !!id,
  });

  const totalPages = Math.max(1, Math.ceil((listQ.data?.total ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/challenges">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to Challenges
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">Challenge Participants</h1>
      </div>

      {/* Stats */}
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Total", value: statsQ.data?.total },
          { label: "Active", value: statsQ.data?.active },
          { label: "Completed", value: statsQ.data?.completed },
          { label: "Cancelled", value: statsQ.data?.cancelled },
          { label: "Expired", value: statsQ.data?.expired },
          {
            label: "Completion %",
            value:
              statsQ.data?.completion_rate != null
                ? `${statsQ.data.completion_rate}%`
                : undefined,
          },
        ].map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {s.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {statsQ.isLoading ? <Skeleton className="h-7 w-12" /> : s.value ?? 0}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, email, BIB"
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking #</TableHead>
                <TableHead>Participant</TableHead>
                <TableHead>Registered</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-56">Progress</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>Certificate</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listQ.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={9}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : (listQ.data?.items.length ?? 0) === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-10">
                    No participants match these filters.
                  </TableCell>
                </TableRow>
              ) : (
                listQ.data!.items.map((p) => (
                  <TableRow key={p.registration_id}>
                    <TableCell className="font-mono text-xs">{p.booking_number ?? "—"}</TableCell>
                    <TableCell>
                      <div className="font-medium">{p.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{p.email ?? ""}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {format(new Date(p.registered_at), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell>{statusBadge(p.status)}</TableCell>
                    <TableCell>
                      <Progress value={Math.min(100, Number(p.pct_complete))} className="h-2" />
                      <div className="mt-1 text-xs text-muted-foreground">
                        {p.distance_logged_km.toFixed(1)} / {p.distance_target_km.toFixed(0)} km
                        {" · "}
                        {p.activities_count} acts
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {p.completed_at
                        ? format(new Date(p.completed_at), "dd MMM yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {p.certificate_number ?? "—"}
                    </TableCell>
                    <TableCell>{paymentBadge(p.payment_status)}</TableCell>
                    <TableCell className="text-right">
                      {p.order_id && (
                        <Button asChild variant="ghost" size="sm">
                          <Link to={`/admin/bookings/${p.order_id}`}>Booking</Link>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {(listQ.data?.total ?? 0) > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} · {listQ.data?.total ?? 0} participants
          </p>
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
      )}
    </div>
  );
}
