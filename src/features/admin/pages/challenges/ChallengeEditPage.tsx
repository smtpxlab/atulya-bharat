import { useNavigate, useParams, Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import ChallengeForm from "./ChallengeForm";
import {
  useAdminChallenge,
  useUpdateChallenge,
} from "@/features/admin/hooks/useAdminChallenges";
import type { ChallengeFormValues } from "@/features/challenges/schemas/challenge.schema";

export default function ChallengeEditPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useAdminChallenge(id);
  const update = useUpdateChallenge();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return <p className="text-destructive">Could not load challenge.</p>;
  }

  const { challenge, tickets } = data;
  const initial: Partial<ChallengeFormValues> = {
    name: challenge.name,
    slug: challenge.slug,
    challenge_type: challenge.challenge_type,
    category: challenge.category,
    tags: challenge.tags ?? [],
    cover_image_url: challenge.cover_image_url,
    about_map_image_url: challenge.about_map_image_url,
    creative_image_url: challenge.creative_image_url,
    certificate_image_url: challenge.certificate_image_url,
    bib_image_url: challenge.bib_image_url,
    route_map_image_url: challenge.route_map_image_url,
    distance: challenge.distance,
    max_duration_days: challenge.max_duration_days,
    start_at: challenge.start_at,
    end_at: challenge.end_at,
    description: challenge.description ?? "",
    status: challenge.status,
    tickets: tickets.length
      ? tickets.map((t) => ({
          id: t.id,
          ticket_name: t.ticket_name,
          ticket_price: t.ticket_price,
          ticket_inclusions: t.ticket_inclusions ?? "",
          shipping_cost: t.shipping_cost,
          allow_certificate: t.allow_certificate,
        }))
      : undefined,
    meta_title: challenge.meta_title ?? null,
    meta_description: challenge.meta_description ?? null,
    meta_keywords: challenge.meta_keywords ?? [],
  };

  return (
    <div className="space-y-4">
      <div>
        <Link
          to="/admin/challenges"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> Back to challenges
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Edit Challenge</h1>
      </div>
      <ChallengeForm
        mode="edit"
        initialValues={initial}
        submitting={update.isPending}
        onSubmit={(values) =>
          update.mutate(
            { id, payload: values },
            { onSuccess: () => navigate("/admin/challenges") },
          )
        }
      />
    </div>
  );
}
