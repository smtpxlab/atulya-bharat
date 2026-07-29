// Central site URL used for canonical, og:url, sitemap, and JSON-LD.
// Override per environment with VITE_SITE_URL.
export const SITE_URL =
  (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, "") ||
  "https://www.atulyabharatrun.com";

export const absoluteUrl = (path = "/") => {
  if (!path.startsWith("/")) path = `/${path}`;
  return `${SITE_URL}${path}`;
};
