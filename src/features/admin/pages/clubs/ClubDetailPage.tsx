import { Link, useParams } from "react-router-dom";
import { Pencil, Check, X, Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useAdminClub,
  useAdminClubMembers,
  useApproveClub,
  useRejectClub,
  useToggleClubVisibility,
} from "../../hooks/useAdminClubs";
import { SafeHtml } from "@/components/editor/SafeHtml";
import { toast } from "@/hooks/use-toast";

export default function ClubDetailPage() {
  const { id = "" } = useParams();
  const { data, isLoading, error } = useAdminClub(id);
  const members = useAdminClubMembers(id);
  const approve = useApproveClub();
  const reject = useRejectClub();
  const toggle = useToggleClubVisibility();

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (error)
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        {(error as Error).message}
      </div>
    );
  if (!data) return null;

  const onDone = (msg: string) => () => toast({ title: msg });
  const onError = (e: unknown) =>
    toast({ title: "Action failed", description: (e as Error).message, variant: "destructive" });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{data.name}</h1>
            <Badge
              variant={
                data.status === "approved"
                  ? "default"
                  : data.status === "rejected"
                  ? "destructive"
                  : "secondary"
              }
            >
              {data.status}
            </Badge>
            <Badge variant="outline">{data.is_public ? "Public" : "Hidden"}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">/{data.slug}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => approve.mutate(id, { onSuccess: onDone("Club approved"), onError })}
            disabled={data.status === "approved"}
          >
            <Check className="mr-1 h-4 w-4" /> Approve
          </Button>
          <Button
            variant="outline"
            onClick={() => reject.mutate(id, { onSuccess: onDone("Club rejected"), onError })}
            disabled={data.status === "rejected"}
          >
            <X className="mr-1 h-4 w-4" /> Reject
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              toggle.mutate(
                { id, is_public: !data.is_public },
                { onSuccess: onDone(data.is_public ? "Hidden" : "Visible"), onError },
              )
            }
          >
            {data.is_public ? <EyeOff className="mr-1 h-4 w-4" /> : <Eye className="mr-1 h-4 w-4" />}
            {data.is_public ? "Hide" : "Show"}
          </Button>
          <Button asChild>
            <Link to={`/admin/clubs/${id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" /> Edit
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Field label="Type" value={data.club_type ?? "—"} />
            <Field label="Priority" value={String(data.priority)} />
            <Field label="Members" value={String(data.member_count)} />
            <Field label="Established" value={data.established_at ?? "—"} />
            <Field label="Registration code" value={data.registration_code ?? "—"} />
            <Field label="Referral code" value={data.referral_code ?? "—"} />
            <Field
              label="Challenge discount"
              value={`${data.discount_challenge_percent}%`}
            />
            <Field label="Cart discount" value={`${data.discount_cart_percent}%`} />
            <Field label="Banner" value={data.banner_url ?? "—"} truncate />
            <Field label="Logo" value={data.logo_url ?? "—"} truncate />
            <div className="col-span-2">
              <div className="text-xs uppercase text-muted-foreground">Description</div>
              {data.description ? (
                <SafeHtml html={data.description} className="mt-1" />
              ) : (
                <div className="mt-1 text-muted-foreground">—</div>
              )}
            </div>
            <div className="col-span-2">
              <div className="text-xs uppercase text-muted-foreground">Tags</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {data.tags.length === 0 ? (
                  <span className="text-muted-foreground">None</span>
                ) : (
                  data.tags.map((t) => (
                    <Badge key={t} variant="secondary">
                      {t}
                    </Badge>
                  ))
                )}
              </div>
            </div>
            <div className="col-span-2">
              <div className="text-xs uppercase text-muted-foreground">Social links</div>
              {data.social_links.length === 0 ? (
                <div className="mt-1 text-muted-foreground">None</div>
              ) : (
                <ul className="mt-1 space-y-1">
                  {data.social_links.map((url) => (
                    <li key={url}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        {url}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Promoter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Field label="Name" value={data.promoter_name ?? "—"} />
            <Field label="Email" value={data.promoter_email ?? "—"} />
            <Field label="Phone" value={data.promoter_phone ?? "—"} />
            <Field label="City" value={data.promoter_city ?? "—"} />
            <Field label="State" value={data.promoter_state ?? "—"} />
            <Field label="DOB" value={data.promoter_dob ?? "—"} />
            <div>
              <div className="text-xs uppercase text-muted-foreground">About</div>
              {data.promoter_description ? (
                <SafeHtml html={data.promoter_description} className="mt-1" />
              ) : (
                <div className="mt-1 text-muted-foreground">—</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Members ({members.data?.items.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={4}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : (members.data?.items.length ?? 0) === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                    No members yet.
                  </TableCell>
                </TableRow>
              ) : (
                members.data!.items.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={m.user?.avatar_url ?? undefined} />
                          <AvatarFallback>
                            {(m.user?.full_name ?? "?").slice(0, 1)}
                          </AvatarFallback>
                        </Avatar>
                        {m.user?.full_name ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell>{m.user?.city ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{m.role}</Badge>
                    </TableCell>
                    <TableCell>{new Date(m.joined_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value, truncate }: { label: string; value: string; truncate?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={truncate ? "mt-0.5 truncate" : "mt-0.5"}>{value}</div>
    </div>
  );
}
