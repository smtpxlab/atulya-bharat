import { useChallenges } from "@/features/challenges/hooks/useChallenges";
import { ChallengeCardLegacy } from "@/components/challenges/ChallengeCardLegacy";

type Props = {
  excludeId?: string;
  title?: string;
  limit?: number;
};

export const RelatedChallenges = ({
  excludeId,
  title = "You may also like",
  limit = 3,
}: Props) => {
  const { data, isLoading } = useChallenges();
  const items = (data ?? [])
    .filter((c) => c.id !== excludeId)
    .slice(0, limit);

  if (isLoading || items.length === 0) return null;

  return (
    <section className="abr-container py-10 md:py-14">
      <h2 className="font-display text-2xl text-navy md:text-3xl">{title}</h2>
      <div className="mt-6 grid gap-5 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((c) => (
          <ChallengeCardLegacy key={c.id} c={c} />
        ))}
      </div>
    </section>
  );
};

export default RelatedChallenges;
