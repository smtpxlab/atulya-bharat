import { Facebook, Instagram, Youtube, Globe } from "lucide-react";

type Props = { links: string[] };

const iconFor = (host: string) => {
  if (host.includes("facebook")) return { Icon: Facebook, label: "Facebook" };
  if (host.includes("instagram")) return { Icon: Instagram, label: "Instagram" };
  if (host.includes("youtube") || host.includes("youtu.be"))
    return { Icon: Youtube, label: "YouTube" };
  return { Icon: Globe, label: "Website" };
};

export const SocialIcons = ({ links }: Props) => {
  const valid = (links ?? []).filter(Boolean);
  if (!valid.length) return null;
  return (
    <ul className="flex flex-wrap items-center gap-2">
      {valid.map((url) => {
        let host = "";
        try {
          host = new URL(url).hostname.replace(/^www\./, "");
        } catch {
          return null;
        }
        const { Icon, label } = iconFor(host);
        return (
          <li key={url}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${label} (opens in new tab)`}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
            >
              <Icon className="h-4 w-4" />
            </a>
          </li>
        );
      })}
    </ul>
  );
};
