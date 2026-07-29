import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowDown, ArrowUp, ArrowUpDown, Download } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  useAdminClubReportSummary,
  useClubMemberReport,
} from "../../hooks/useAdminClubs";
import type { ClubMemberReportRow } from "../../services/club.admin.service";

type Format = "csv" | "xlsx" | "xls" | "txt";
const PAGE_SIZE = 25;

const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const download = (rows: Record<string, unknown>[], name: string, fmt: Format) => {
  if (!rows.length) {
    toast({ title: "Nothing to export", variant: "destructive" });
    return;
  }
  if (fmt === "csv" || fmt === "txt") {
    const headers = Object.keys(rows[0]);
    const sep = fmt === "csv" ? "," : "\t";
    const escape = (v: unknown) => {
      const s = String(v ?? "");
      if (fmt === "csv" && /[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const body = [headers.join(sep), ...rows.map((r) => headers.map((h) => escape(r[h])).join(sep))].join("\n");
    const blob = new Blob([body], {
      type: fmt === "csv" ? "text/csv;charset=utf-8" : "text/plain;charset=utf-8",
    });
    triggerDownload(blob, `${name}.${fmt}`);
    return;
  }
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  const bookType = fmt === "xlsx" ? "xlsx" : "biff8";
  const out = XLSX.write(wb, { bookType: bookType as any, type: "array" });
  const blob = new Blob([out], { type: "application/octet-stream" });
  triggerDownload(blob, `${name}.${fmt}`);
};

type SortDir = "asc" | "desc";

function useSortableSearch<T>(
  rows: T[],
  searchFields: (r: T) => string[],
  sortGetters: Record<string, (r: T) => string | number>,
  defaultSort: { key: string; dir: SortDir },
) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState(defaultSort.key);
  const [sortDir, setSortDir] = useState<SortDir>(defaultSort.dir);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = rows;
    if (q) {
      out = rows.filter((r) =>
        searchFields(r).some((v) => (v ?? "").toLowerCase().includes(q)),
      );
    }
    const getter = sortGetters[sortKey];
    if (getter) {
      out = [...out].sort((a, b) => {
        const av = getter(a);
        const bv = getter(b);
        if (av < bv) return sortDir === "asc" ? -1 : 1;
        if (av > bv) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return out;
  }, [rows, query, sortKey, sortDir, searchFields, sortGetters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return {
    query,
    setQuery: (v: string) => {
      setQuery(v);
      setPage(1);
    },
    sortKey,
    sortDir,
    toggleSort,
    filtered,
    pageRows,
    page: safePage,
    totalPages,
    setPage,
  };
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 hover:text-foreground"
    >
      {label}
      <Icon className="h-3 w-3" />
    </button>
  );
}

function Pager({
  page,
  totalPages,
  setPage,
  total,
}: {
  page: number;
  totalPages: number;
  setPage: (n: number) => void;
  total: number;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground">
      <span>
        Page {page} of {totalPages} · {total} rows
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          Prev
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export default function ClubReportsPage() {
  const summary = useAdminClubReportSummary();
  const members = useClubMemberReport();
  const [fmt, setFmt] = useState<Format>("xlsx");

  // ---- Clubs Details ----
  const clubsRows = summary.data ?? [];
  const clubsCtrl = useSortableSearch(
    clubsRows,
    (r: any) => [
      String(r["Club Name"] ?? ""),
      String(r["Promoter Name"] ?? ""),
      String(r["Promoter Email"] ?? ""),
      String(r["Promoter Phone"] ?? ""),
    ],
    {
      "Club Name": (r: any) => String(r["Club Name"] ?? "").toLowerCase(),
      "Promoter Name": (r: any) => String(r["Promoter Name"] ?? "").toLowerCase(),
      "Total Members": (r: any) => Number(r["Total Members"] ?? 0),
    },
    { key: "Club Name", dir: "asc" },
  );

  const exportClubs = () => {
    const rows = clubsCtrl.filtered.map((r: any, i: number) => ({
      "S.No.": i + 1,
      "Club Name": r["Club Name"] ?? "N/A",
      "Promoter Name": r["Promoter Name"] || "N/A",
      "Promoter Email": r["Promoter Email"] || "N/A",
      "Promoter Phone": r["Promoter Phone"] || "N/A",
      "Total Club Members": r["Total Members"] ?? 0,
    }));
    download(rows, "clubs-details", fmt);
  };

  // ---- Members ----
  const memberRows: ClubMemberReportRow[] = members.data ?? [];
  const membersCtrl = useSortableSearch(
    memberRows,
    (r) => [r.clubName, r.memberName, r.memberEmail, r.memberPhone],
    {
      "Club Name": (r) => r.clubName.toLowerCase(),
      "Member Name": (r) => r.memberName.toLowerCase(),
      "Joined Date": (r) => r.joinedAt,
    },
    { key: "Joined Date", dir: "desc" },
  );

  const exportMembers = () => {
    const rows = membersCtrl.filtered.map((r, i) => ({
      "S.No.": i + 1,
      "Club Name": r.clubName,
      "Promoter Name": r.promoterName,
      "Promoter Email": r.promoterEmail,
      "Promoter Phone": r.promoterPhone,
      "Member Name": r.memberName,
      "Member Email": r.memberEmail,
      "Member Phone": r.memberPhone,
      "Member Address": r.memberAddress,
      "Joined Date": r.joinedAt
        ? new Date(r.joinedAt).toISOString().slice(0, 10)
        : "",
    }));
    download(rows, "club-members", fmt);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Club Reports</h1>
          <p className="text-sm text-muted-foreground">
            Summary and detailed member exports.
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={fmt} onValueChange={(v) => setFmt(v as Format)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="xlsx">XLSX</SelectItem>
              <SelectItem value="xls">XLS</SelectItem>
              <SelectItem value="csv">CSV</SelectItem>
              <SelectItem value="txt">TXT</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">Clubs Details</TabsTrigger>
          <TabsTrigger value="members">Clubs Member Details</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Input
              placeholder="Search clubs, promoters…"
              value={clubsCtrl.query}
              onChange={(e) => clubsCtrl.setQuery(e.target.value)}
              className="max-w-xs"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={exportClubs}
              disabled={summary.isLoading}
            >
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
          </div>
          <div className="overflow-x-auto rounded-md border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>S.No.</TableHead>
                  <TableHead>
                    <SortHeader
                      label="Club Name"
                      active={clubsCtrl.sortKey === "Club Name"}
                      dir={clubsCtrl.sortDir}
                      onClick={() => clubsCtrl.toggleSort("Club Name")}
                    />
                  </TableHead>
                  <TableHead>
                    <SortHeader
                      label="Promoter Name"
                      active={clubsCtrl.sortKey === "Promoter Name"}
                      dir={clubsCtrl.sortDir}
                      onClick={() => clubsCtrl.toggleSort("Promoter Name")}
                    />
                  </TableHead>
                  <TableHead>Promoter Email</TableHead>
                  <TableHead>Promoter Phone</TableHead>
                  <TableHead>
                    <SortHeader
                      label="Total Club Members"
                      active={clubsCtrl.sortKey === "Total Members"}
                      dir={clubsCtrl.sortDir}
                      onClick={() => clubsCtrl.toggleSort("Total Members")}
                    />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ) : clubsCtrl.pageRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      No clubs found.
                    </TableCell>
                  </TableRow>
                ) : (
                  clubsCtrl.pageRows.map((r: any, i) => (
                    <TableRow key={i}>
                      <TableCell>{(clubsCtrl.page - 1) * PAGE_SIZE + i + 1}</TableCell>
                      <TableCell>{r["Club Name"] || "N/A"}</TableCell>
                      <TableCell>{r["Promoter Name"] || "N/A"}</TableCell>
                      <TableCell>{r["Promoter Email"] || "N/A"}</TableCell>
                      <TableCell>{r["Promoter Phone"] || "N/A"}</TableCell>
                      <TableCell>{r["Total Members"] ?? 0}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <Pager
              page={clubsCtrl.page}
              totalPages={clubsCtrl.totalPages}
              setPage={clubsCtrl.setPage}
              total={clubsCtrl.filtered.length}
            />
          </div>
        </TabsContent>

        <TabsContent value="members" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Input
              placeholder="Search clubs, members, emails, phones…"
              value={membersCtrl.query}
              onChange={(e) => membersCtrl.setQuery(e.target.value)}
              className="max-w-sm"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={exportMembers}
              disabled={members.isLoading}
            >
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
          </div>
          <div className="overflow-x-auto rounded-md border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>S.No.</TableHead>
                  <TableHead>
                    <SortHeader
                      label="Club Name"
                      active={membersCtrl.sortKey === "Club Name"}
                      dir={membersCtrl.sortDir}
                      onClick={() => membersCtrl.toggleSort("Club Name")}
                    />
                  </TableHead>
                  <TableHead>Promoter Name</TableHead>
                  <TableHead>Promoter Email</TableHead>
                  <TableHead>Promoter Phone</TableHead>
                  <TableHead>
                    <SortHeader
                      label="Member Name"
                      active={membersCtrl.sortKey === "Member Name"}
                      dir={membersCtrl.sortDir}
                      onClick={() => membersCtrl.toggleSort("Member Name")}
                    />
                  </TableHead>
                  <TableHead>Member Email</TableHead>
                  <TableHead>Member Phone</TableHead>
                  <TableHead>Member Address</TableHead>
                  <TableHead>
                    <SortHeader
                      label="Joined Date"
                      active={membersCtrl.sortKey === "Joined Date"}
                      dir={membersCtrl.sortDir}
                      onClick={() => membersCtrl.toggleSort("Joined Date")}
                    />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ) : membersCtrl.pageRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                      No club members found.
                    </TableCell>
                  </TableRow>
                ) : (
                  membersCtrl.pageRows.map((r, i) => (
                    <TableRow key={`${r.clubId}-${r.memberId}-${i}`}>
                      <TableCell>{(membersCtrl.page - 1) * PAGE_SIZE + i + 1}</TableCell>
                      <TableCell>{r.clubName}</TableCell>
                      <TableCell>{r.promoterName}</TableCell>
                      <TableCell>{r.promoterEmail}</TableCell>
                      <TableCell>{r.promoterPhone}</TableCell>
                      <TableCell>{r.memberName}</TableCell>
                      <TableCell>{r.memberEmail}</TableCell>
                      <TableCell>{r.memberPhone}</TableCell>
                      <TableCell className="max-w-xs whitespace-normal">{r.memberAddress}</TableCell>
                      <TableCell>
                        {r.joinedAt ? new Date(r.joinedAt).toLocaleDateString() : "N/A"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <Pager
              page={membersCtrl.page}
              totalPages={membersCtrl.totalPages}
              setPage={membersCtrl.setPage}
              total={membersCtrl.filtered.length}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
