import { useClubs } from "@/features/clubs/hooks/useClubs";
import { ClubCardLegacy } from "@/components/clubs/ClubCardLegacy";

type Props = {
  excludeId?: string;
  title?: string;
  limit?: number;
};

export const RelatedClubs = ({
  excludeId,
  title = "Other clubs to explore",
  limit = 3,
}: Props) => {
  const { data, isLoading } = useClubs();
  const items = (data ?? [])
    .filter((c) => c.id !== excludeId)
    .slice(0, limit);

  if (isLoading || items.length === 0) return null;

  return (
    <section className="abr-container py-10 md:py-14">
      <h2 className="font-display text-2xl text-navy md:text-3xl">{title}</h2>
      <div className="mt-6 grid gap-5 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((c) => (
          <ClubCardLegacy key={c.id} club={c} />
        ))}
      </div>
    </section>
  );
};

export default RelatedClubs;
