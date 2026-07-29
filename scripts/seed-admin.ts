/**
 * Dev-only seed: creates a default admin account.
 *
 * Run:  bunx tsx scripts/seed-admin.ts
 *   or: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ENABLE_DEV_SEEDS=true bun scripts/seed-admin.ts
 *
 * Safety: refuses to run when NODE_ENV=production unless ENABLE_DEV_SEEDS=true.
 */
import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = "ajcorp@gmail.com";
const ADMIN_PASSWORD = "123456";

async function main() {
  const isProd = process.env.NODE_ENV === "production";
  const enabled = process.env.ENABLE_DEV_SEEDS === "true";
  if (isProd && !enabled) {
    console.error("✗ Refusing to seed admin in production. Set ENABLE_DEV_SEEDS=true to override.");
    process.exit(1);
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("✗ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Look up existing user by email (paginate defensively).
  let existing: { id: string } | null = null;
  let page = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === ADMIN_EMAIL);
    if (found) {
      existing = { id: found.id };
      break;
    }
    if (data.users.length < 200) break;
    page += 1;
  }

  let userId: string;
  if (existing) {
    userId = existing.id;
    console.log("✓ Admin user already exists");
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
    });
    if (error || !data.user) throw error ?? new Error("Failed to create user");
    userId = data.user.id;
    console.log("✓ Admin user created");
    // Give handle_new_user() trigger a moment to populate profiles + default role.
    await new Promise((r) => setTimeout(r, 500));
  }

  // 2. Ensure admin role (idempotent via unique constraint).
  const { error: roleErr } = await admin
    .from("user_roles")
    .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role", ignoreDuplicates: true });
  if (roleErr) throw roleErr;
  console.log("✓ Admin role assigned");
}

main().catch((err) => {
  console.error("✗ Seed failed:", err);
  process.exit(1);
});
