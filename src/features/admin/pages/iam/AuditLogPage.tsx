import { useState } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BACKEND_ENABLED } from "@/integrations/backend/config";
import { BackendDisabledNotice } from "@/components/security/BackendDisabledNotice";
import { useAuditLogs, useLoginAttempts } from "../../hooks/useAdminIam";

const when = (v?: string | null) => (v ? format(new Date(v), "dd MMM yyyy, HH:mm") : "—");

export default function AuditLogPage() {
  const [tab, setTab] = useState("audit");

  if (!BACKEND_ENABLED) {
    return (
      <div className="space-y-4">
        <Header />
        <BackendDisabledNotice feature="Security audit log" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Header />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="audit">Audit trail</TabsTrigger>
          <TabsTrigger value="logins">Login attempts</TabsTrigger>
        </TabsList>
        <TabsContent value="audit" className="mt-4">
          <AuditTable />
        </TabsContent>
        <TabsContent value="logins" className="mt-4">
          <LoginTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Security Log</h1>
      <p className="text-sm text-muted-foreground">
        Administrative actions and authentication attempts.
      </p>
    </div>
  );
}

function LoadingRows({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell colSpan={cols}>
            <Skeleton className="h-6 w-full" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

function AuditTable() {
  const { data, isLoading, error } = useAuditLogs({ limit: 100 });
  const rows = data ?? [];
  return (
    <div className="rounded-md border bg-background">
      {error && (
        <div className="p-4 text-sm text-destructive">{(error as Error).message}</div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Target user</TableHead>
            <TableHead>IP</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && <LoadingRows cols={6} />}
          {!isLoading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                No audit entries yet.
              </TableCell>
            </TableRow>
          )}
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="whitespace-nowrap text-sm">{when(r.createdAt)}</TableCell>
              <TableCell>
                <Badge variant="secondary">{r.category}</Badge>
              </TableCell>
              <TableCell className="text-sm">{r.action}</TableCell>
              <TableCell className="font-mono text-xs">{r.actorId ?? "system"}</TableCell>
              <TableCell className="font-mono text-xs">{r.userId ?? "—"}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{r.ip ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function LoginTable() {
  const { data, isLoading, error } = useLoginAttempts({ limit: 100 });
  const rows = data ?? [];
  return (
    <div className="rounded-md border bg-background">
      {error && (
        <div className="p-4 text-sm text-destructive">{(error as Error).message}</div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Result</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>IP</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && <LoadingRows cols={5} />}
          {!isLoading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                No login attempts recorded.
              </TableCell>
            </TableRow>
          )}
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="whitespace-nowrap text-sm">{when(r.at)}</TableCell>
              <TableCell className="text-sm">{r.email ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={r.success ? "outline" : "destructive"}>
                  {r.success ? "Success" : "Failed"}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{r.reason ?? "—"}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{r.ip ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
