// Runs before `vite dev` and `vite build` via predev/prebuild npm hooks.
// Writes public/sitemap.xml with static routes plus dynamic challenges, clubs, and blog posts.

import { writeFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

const BASE_URL =
  (process.env.VITE_SITE_URL ?? "https://www.atulyabharatrun.com").replace(/\/$/, "");

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  priority?: string;
}

const staticEntries: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/challenges", changefreq: "daily", priority: "0.9" },
  { path: "/clubs", changefreq: "daily", priority: "0.9" },
  { path: "/leaderboard", changefreq: "daily", priority: "0.7" },
  { path: "/blog", changefreq: "weekly", priority: "0.8" },
  { path: "/gallery", changefreq: "weekly", priority: "0.6" },
  { path: "/about", changefreq: "monthly", priority: "0.6" },
  { path: "/contact", changefreq: "monthly", priority: "0.5" },
  { path: "/privacy-policy", changefreq: "yearly", priority: "0.3" },
  { path: "/terms-and-conditions", changefreq: "yearly", priority: "0.3" },
  { path: "/refund-return-policy", changefreq: "yearly", priority: "0.3" },
];

async function fetchDynamicEntries(): Promise<SitemapEntry[]> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn("[sitemap] Supabase env missing — skipping dynamic entries");
    return [];
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });

  const entries: SitemapEntry[] = [];
  const nowIso = new Date().toISOString();

  try {
    const { data: challenges, error: cErr } = await supabase
      .from("challenges")
      .select("slug, updated_at, end_at")
      .eq("status", true);
    if (cErr) throw cErr;
    (challenges ?? [])
      .filter((c: any) => c.slug && (!c.end_at || c.end_at >= nowIso))
      .forEach((c: any) =>
        entries.push({
          path: `/challenges/${c.slug}`,
          lastmod: c.updated_at?.slice(0, 10),
          changefreq: "weekly",
          priority: "0.8",
        }),
      );
  } catch (e) {
    console.warn("[sitemap] challenges fetch failed:", (e as Error).message);
  }

  try {
    const { data: clubs, error: clErr } = await supabase.rpc(
      "list_public_clubs" as never,
    );
    if (clErr) throw clErr;
    (clubs as any[] | null ?? [])
      .filter((c: any) => c.slug)
      .forEach((c: any) =>
        entries.push({
          path: `/clubs/${c.slug}`,
          lastmod: c.updated_at?.slice(0, 10),
          changefreq: "weekly",
          priority: "0.7",
        }),
      );
  } catch (e) {
    console.warn("[sitemap] clubs fetch failed:", (e as Error).message);
  }

  try {
    const { data: posts, error: bErr } = await supabase
      .from("blog_posts")
      .select("slug, updated_at, published_at")
      .eq("is_published", true);
    if (bErr) throw bErr;
    (posts ?? [])
      .filter((p: any) => p.slug)
      .forEach((p: any) =>
        entries.push({
          path: `/blog/${p.slug}`,
          lastmod: (p.updated_at ?? p.published_at)?.slice(0, 10),
          changefreq: "monthly",
          priority: "0.6",
        }),
      );
  } catch (e) {
    console.warn("[sitemap] blog fetch failed:", (e as Error).message);
  }

  return entries;
}

function renderSitemap(entries: SitemapEntry[]) {
  const urls = entries.map((e) =>
    [
      `  <url>`,
      `    <loc>${BASE_URL}${e.path}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n"),
  );
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
    ``,
  ].join("\n");
}

(async () => {
  const dynamicEntries = await fetchDynamicEntries();
  const all = [...staticEntries, ...dynamicEntries];
  writeFileSync(resolve("public/sitemap.xml"), renderSitemap(all));
  console.log(
    `[sitemap] wrote public/sitemap.xml (${all.length} entries: ${staticEntries.length} static, ${dynamicEntries.length} dynamic)`,
  );
})();
