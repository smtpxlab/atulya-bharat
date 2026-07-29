export const landingPathForRoles = (
  isAdmin: boolean,
  requested?: string | null,
) => {
  if (isAdmin) return "/admin";
  if (
    requested &&
    requested.startsWith("/") &&
    !requested.startsWith("/admin") &&
    !requested.startsWith("//")
  ) {
    return requested;
  }
  return "/dashboard";
};
