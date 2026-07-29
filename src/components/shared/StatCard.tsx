type Props = {
  value: string;
  label: string;
};

export const StatCard = ({ value, label }: Props) => (
  <div className="rounded-3xl border border-border bg-card p-6 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-md">
    <div className="font-display text-4xl md:text-5xl font-bold text-primary">{value}</div>
    <div className="mt-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
      {label}
    </div>
  </div>
);

export default StatCard;
