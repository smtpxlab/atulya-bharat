import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Search, ShieldCheck, LockOpen, KeyRound, LogOut, Ban, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { BACKEND_ENABLED } from "@/integrations/backend/config";
import { BackendDisabledNotice } from "@/components/security/BackendDisabledNotice";
import type { AppRole } from "@/services/iam.service";
import {
  useIamUsers,
  useSetUserActive,
  useUnlockUser,
  useForcePasswordReset,
  useGrantRole,
  useRevokeRole,
  useRevokeUserSessions,
} from "../../hooks/useAdminIam";

const ROLES: AppRole[] = ["user", "club_owner", "content_manager", "admin", "super_admin"];
const PAGE_SIZE = 25;

export default function IamUserListPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const params = useMemo(
    () => ({ search: search || undefined, limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    [search, page],
  );
  const { data, isLoading, error } = useIamUsers(params);

  const setActive = useSetUserActive();
  const unlock = useUnlockUser();
  const forceReset = useForcePasswordReset();
  const grant = useGrantRole();
  const revoke = useRevokeRole();
  const revokeSessions = useRevokeUserSessions();

  const run = (p: Promise<unknown>, message: string) =>
    p.then(
      () => toast({ title: message }),
      (e: Error) => toast({ title: "Action failed", description: e.message, variant: "destructive" }),
    );

  if (!BACKEND_ENABLED) {
    return (
      <div className="space-y-4">
        <Header />
        <BackendDisabledNotice feature="Identity & Access Management" />
      </div>
    );
  }

  const users = data ?? [];

  return (
    <div className="space-y-4">
      <Header />

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          placeholder="Search by name or email"
          className="pl-8"
        />
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
              <TableHead>User</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last login</TableHead>
              <TableHead className="w-20 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}

            {!isLoading && users.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            )}

            {users.map((u) => {
              const locked = u.lockedUntil && new Date(u.lockedUntil) > new Date();
              return (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="font-medium">{u.fullName || "—"}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(u.roles ?? []).length === 0 && (
                        <span className="text-xs text-muted-foreground">user</span>
                      )}
                      {(u.roles ?? []).map((r) => (
                        <Badge key={r} variant={r.includes("admin") ? "default" : "secondary"}>
                          {r}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant={u.isActive ? "outline" : "destructive"}>
                        {u.isActive ? "Active" : "Disabled"}
                      </Badge>
                      {locked && <Badge variant="destructive">Locked</Badge>}
                      {u.mustChangePassword && <Badge variant="secondary">Reset pending</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {u.lastLoginAt ? format(new Date(u.lastLoginAt), "dd MMM yyyy, HH:mm") : "Never"}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          Manage
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56 bg-popover">
                        <DropdownMenuLabel>Account</DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={() =>
                            run(
                              setActive.mutateAsync({ id: u.id, isActive: !u.isActive }),
                              u.isActive ? "User disabled" : "User enabled",
                            )
                          }
                        >
                          {u.isActive ? (
                            <>
                              <Ban className="mr-2 h-4 w-4" /> Disable account
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="mr-2 h-4 w-4" /> Enable account
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => run(unlock.mutateAsync(u.id), "User unlocked")}>
                          <LockOpen className="mr-2 h-4 w-4" /> Unlock
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => run(forceReset.mutateAsync(u.id), "Password reset forced")}
                        >
                          <KeyRound className="mr-2 h-4 w-4" /> Force password reset
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            run(revokeSessions.mutateAsync(u.id), "All sessions revoked")
                          }
                        >
                          <LogOut className="mr-2 h-4 w-4" /> Revoke all sessions
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Roles</DropdownMenuLabel>
                        {ROLES.map((role) => {
                          const has = (u.roles ?? []).includes(role);
                          return (
                            <DropdownMenuItem
                              key={role}
                              onClick={() =>
                                run(
                                  has
                                    ? revoke.mutateAsync({ id: u.id, role })
                                    : grant.mutateAsync({ id: u.id, role }),
                                  has ? `Revoked ${role}` : `Granted ${role}`,
                                )
                              }
                            >
                              <ShieldCheck
                                className={`mr-2 h-4 w-4 ${has ? "text-primary" : "opacity-30"}`}
                              />
                              {has ? `Revoke ${role}` : `Grant ${role}`}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">Page {page + 1}</span>
        <Button
          variant="outline"
          size="sm"
          disabled={users.length < PAGE_SIZE}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Users & Access</h1>
      <p className="text-sm text-muted-foreground">
        Manage accounts, roles, lockouts and active sessions.
      </p>
    </div>
  );
}
