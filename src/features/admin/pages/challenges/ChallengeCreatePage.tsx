import { useNavigate, Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import ChallengeForm from "./ChallengeForm";
import { useCreateChallenge } from "@/features/admin/hooks/useAdminChallenges";

export default function ChallengeCreatePage() {
  const navigate = useNavigate();
  const create = useCreateChallenge();

  return (
    <div className="space-y-4">
      <div>
        <Link
          to="/admin/challenges"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> Back to challenges
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Add Challenge</h1>
      </div>
      <ChallengeForm
        mode="create"
        submitting={create.isPending}
        onSubmit={(values) =>
          create.mutate(values, {
            onSuccess: () => navigate("/admin/challenges"),
          })
        }
      />
    </div>
  );
}
