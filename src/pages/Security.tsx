import { useState } from "react";
import { format } from "date-fns";
import { Laptop, LogOut, Trash2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { SEO } from "@/components/SEO";
import { BACKEND_ENABLED } from "@/integrations/backend/config";
import { BackendDisabledNotice } from "@/components/security/BackendDisabledNotice";
import {
  useMySessions,
  useMyDevices,
  useMyLoginHistory,
  useRevokeMySession,
  useRevokeAllMySessions,
  useRemoveMyDevice,
  useChangeMyPassword,
} from "@/features/account/hooks/useSecurity";

const when = (v?: string | null) => (v ? format(new Date(v), "dd MMM yyyy, HH:mm") : "—");

export default function Security() {
  return (
    <section className="abr-container space-y-6 py-10">
      <SEO title="Security | Atulya Bharat Run" noindex />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Security</h1>
        <p className="text-sm text-muted-foreground">
          Manage your password, active sessions and trusted devices.
        </p>
      </div>

      {!BACKEND_ENABLED ? (
        <BackendDisabledNotice feature="Session & device management" />
      ) : (
        <div className="grid gap-6">
          <ChangePasswordCard />
          <SessionsCard />
          <DevicesCard />
          <LoginHistoryCard />
        </div>
      )}
    </section>
  );
}

function ChangePasswordCard() {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const change = useChangeMyPassword();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirm) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    change.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          toast({ title: "Password updated", description: "Please sign in again." });
          setCurrent("");
          setNext("");
          setConfirm("");
        },
        onError: (e: Error) =>
          toast({ title: "Could not update password", description: e.message, variant: "destructive" }),
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="h-5 w-5" /> Change password
        </CardTitle>
        <CardDescription>All other sessions are signed out when you change it.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid max-w-md gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="current">Current password</Label>
            <Input id="current" type="password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="next">New password</Label>
            <Input id="next" type="password" value={newPassword} onChange={(e) => setNext(e.target.value)} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="confirm">Confirm new password</Label>
            <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          <Button type="submit" disabled={change.isPending} className="justify-self-start">
            {change.isPending ? "Updating…" : "Update password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function SessionsCard() {
  const { data, isLoading, error } = useMySessions();
  const revoke = useRevokeMySession();
  const revokeAll = useRevokeAllMySessions();
  const sessions = data ?? [];

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-lg">Active sessions</CardTitle>
          <CardDescription>Where your account is currently signed in.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => revokeAll.mutate()} disabled={revokeAll.isPending}>
          <LogOut className="mr-2 h-4 w-4" /> Sign out everywhere
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <Skeleton className="h-20 w-full" />}
        {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
        {!isLoading && sessions.length === 0 && (
          <p className="text-sm text-muted-foreground">No active sessions.</p>
        )}
        {sessions.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-4 rounded-md border p-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className="truncate">{s.userAgent ?? "Unknown device"}</span>
                {s.current && <Badge variant="secondary">This device</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                {s.ip ?? "unknown IP"} · last used {when(s.lastUsedAt ?? s.createdAt)}
              </p>
            </div>
            {!s.current && (
              <Button variant="ghost" size="sm" onClick={() => revoke.mutate(s.id)}>
                Revoke
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function DevicesCard() {
  const { data, isLoading, error } = useMyDevices();
  const remove = useRemoveMyDevice();
  const devices = data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Known devices</CardTitle>
        <CardDescription>Devices that have signed into your account.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <Skeleton className="h-20 w-full" />}
        {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
        {!isLoading && devices.length === 0 && (
          <p className="text-sm text-muted-foreground">No devices recorded.</p>
        )}
        {devices.map((d) => (
          <div key={d.id} className="flex items-center justify-between gap-4 rounded-md border p-3">
            <div className="flex min-w-0 items-center gap-3">
              <Laptop className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{d.name ?? d.userAgent ?? "Unknown device"}</p>
                <p className="text-xs text-muted-foreground">Last seen {when(d.lastSeenAt ?? d.createdAt)}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => remove.mutate(d.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function LoginHistoryCard() {
  const { data, isLoading, error } = useMyLoginHistory(20);
  const rows = data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Recent sign-in activity</CardTitle>
        <CardDescription>The last 20 attempts on your account.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <Skeleton className="h-20 w-full" />}
        {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
        {!isLoading && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        )}
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-4 border-b py-2 last:border-0">
            <div className="min-w-0">
              <p className="text-sm">{when(r.at)}</p>
              <p className="truncate text-xs text-muted-foreground">
                {r.ip ?? "unknown IP"} · {r.userAgent ?? "unknown device"}
              </p>
            </div>
            <Badge variant={r.success ? "outline" : "destructive"}>
              {r.success ? "Success" : r.reason ?? "Failed"}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
