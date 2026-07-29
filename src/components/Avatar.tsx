import { UserAvatar, type UserAvatarProps } from "@/components/common/UserAvatar";

type LegacyAvatarProps = {
  name?: string | null;
  url?: string | null;
  size?: number;
  className?: string;
};

/**
 * @deprecated Use `UserAvatar` from `@/components/common/UserAvatar` instead.
 * Kept as a thin adapter for backward compatibility.
 */
export const Avatar = ({ name, url, size, className }: LegacyAvatarProps) => {
  const props: UserAvatarProps = {
    name,
    avatarUrl: url ?? null,
    size: size ?? "md",
    className,
  };
  return <UserAvatar {...props} />;
};

export default Avatar;
