import { Link } from "react-router-dom";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Mail, Calendar, Pencil, Users } from "lucide-react";
import { format } from "date-fns";
import type { Profile } from "@/types/profile";

type Props = { profile: Profile | null | undefined; loading: boolean; email?: string | null };

export const ProfileSummaryCard = ({ profile, loading, email }: Props) => (
  <section className="card-elevated overflow-hidden">
    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-5 sm:p-6">

      <div className="rounded-full ring-4 ring-card">
        <Avatar
          url={profile?.avatar_url ?? null}
          name={profile?.full_name ?? "You"}
          size={84}
        />
      </div>
      <div className="min-w-0 flex-1 sm:pb-1">
        {loading ? (
          <Skeleton className="h-6 w-40" />
        ) : (
          <h2 className="font-display text-2xl text-navy">
            {profile?.full_name || "Welcome!"}
          </h2>
        )}
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {(profile?.city || profile?.state) && (
            <li className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {[profile?.city, profile?.state].filter(Boolean).join(", ")}
            </li>
          )}
          {email && (
            <li className="inline-flex items-center gap-1">
              <Mail className="h-3.5 w-3.5" /> {email}
            </li>
          )}
          {profile?.created_at && (
            <li className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              Member since {format(new Date(profile.created_at), "MMM yyyy")}
            </li>
          )}
        </ul>
      </div>
      <div className="flex flex-wrap gap-2 sm:pb-1">
        <Button asChild size="sm" variant="outline" className="rounded-full">
          <Link to="/profile">
            <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit Profile
          </Link>
        </Button>
        <Button asChild size="sm" className="rounded-full">
          <Link to="/clubs">
            <Users className="mr-1.5 h-3.5 w-3.5" /> View Clubs
          </Link>
        </Button>
      </div>
    </div>
  </section>
);
