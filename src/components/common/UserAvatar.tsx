import { cn } from "@/lib/utils";

export type UserAvatarSize = "sm" | "md" | "lg" | "xl";

const SIZE_PX: Record<UserAvatarSize, number> = {
  sm: 28,
  md: 40,
  lg: 56,
  xl: 84,
};

export type UserAvatarProps = {
  name?: string | null;
  avatarUrl?: string | null;
  size?: UserAvatarSize | number;
  className?: string;
};

const initialsFrom = (name?: string | null) => {
  const src = (name || "U").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "U";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
};

/**
 * Single source of truth for user avatars across the app.
 * Renders the uploaded profile photo when present, otherwise initials.
 */
export const UserAvatar = ({
  name,
  avatarUrl,
  size = "md",
  className,
}: UserAvatarProps) => {
  const px = typeof size === "number" ? size : SIZE_PX[size];

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name ?? "User avatar"}
        width={px}
        height={px}
        loading="lazy"
        decoding="async"
        className={cn("rounded-full object-cover", className)}
        style={{ width: px, height: px }}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary",
        className,
      )}
      style={{ width: px, height: px, fontSize: Math.max(11, px * 0.38) }}
      aria-label={name ?? "User avatar"}
    >
      {initialsFrom(name)}
    </div>
  );
};

export default UserAvatar;
