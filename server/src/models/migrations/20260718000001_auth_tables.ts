import type { Knex } from "knex";

/**
 * Phase 4 — Authentication Migration
 * -----------------------------------------------------------------------------
 * Introduces the Railway-native auth surface. Supabase's `auth.users` table is
 * gone; we now own identity end-to-end.
 *
 *   app_users           canonical identity row (email, password_hash, flags)
 *   refresh_sessions    rotating refresh-token family (per-device sessions)
 *   email_verifications one-time email confirmation tokens
 *   password_resets     one-time password-reset tokens
 *
 * `app_users.id` intentionally mirrors `profiles.id` (which itself mirrors the
 * historical `auth.users.id`). This keeps every existing FK — `user_roles`,
 * `orders`, `registrations`, `strava_tokens`, etc. — intact.
 *
 * `password_hash` is nullable so we can back-fill from the Supabase bcrypt
 * export in a later data-migration step without breaking the schema contract.
 * Legacy bcrypt hashes are transparently upgraded to Argon2id after the first
 * successful login (see `services/auth/password.service.ts`).
 */

export async function up(knex: Knex): Promise<void> {
  // ─── app_users ────────────────────────────────────────────────────────────
  await knex.schema.createTable("app_users", (t) => {
    t.uuid("id").primary(); // == profiles.id
    t.specificType("email", "citext").notNullable().unique();
    t.text("password_hash"); // nullable during bcrypt back-fill
    t.text("password_algo").notNullable().defaultTo("argon2id"); // 'argon2id' | 'bcrypt'
    t.timestamp("email_verified_at", { useTz: true });
    t.boolean("is_active").notNullable().defaultTo(true);
    t.timestamp("last_login_at", { useTz: true });
    t.integer("failed_login_count").notNullable().defaultTo(0);
    t.timestamp("locked_until", { useTz: true });
    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(`
    ALTER TABLE public.app_users
      ADD CONSTRAINT app_users_id_profiles_fkey
      FOREIGN KEY (id) REFERENCES public.profiles(id) ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  `);

  await knex.raw(`CREATE INDEX app_users_email_idx ON public.app_users (lower(email));`);

  // ─── refresh_sessions ────────────────────────────────────────────────────
  await knex.schema.createTable("refresh_sessions", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("user_id")
      .notNullable()
      .references("id")
      .inTable("app_users")
      .onDelete("CASCADE");
    // hash of the refresh token (sha256 hex); never store raw token
    t.text("token_hash").notNullable();
    t.uuid("parent_id"); // previous token in the rotation family
    t.text("user_agent");
    t.specificType("ip", "inet");
    t.timestamp("issued_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp("expires_at", { useTz: true }).notNullable();
    t.timestamp("revoked_at", { useTz: true });
    t.text("revoked_reason"); // 'rotated' | 'logout' | 'reuse_detected' | 'admin'
  });

  await knex.raw(`
    CREATE UNIQUE INDEX refresh_sessions_token_hash_idx
      ON public.refresh_sessions (token_hash);
  `);
  await knex.raw(`
    CREATE INDEX refresh_sessions_user_active_idx
      ON public.refresh_sessions (user_id)
      WHERE revoked_at IS NULL;
  `);

  // ─── email_verifications ─────────────────────────────────────────────────
  await knex.schema.createTable("email_verifications", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("user_id")
      .notNullable()
      .references("id")
      .inTable("app_users")
      .onDelete("CASCADE");
    t.text("token_hash").notNullable().unique();
    t.timestamp("expires_at", { useTz: true }).notNullable();
    t.timestamp("consumed_at", { useTz: true });
    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  // ─── password_resets ─────────────────────────────────────────────────────
  await knex.schema.createTable("password_resets", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("user_id")
      .notNullable()
      .references("id")
      .inTable("app_users")
      .onDelete("CASCADE");
    t.text("token_hash").notNullable().unique();
    t.timestamp("expires_at", { useTz: true }).notNullable();
    t.timestamp("consumed_at", { useTz: true });
    t.specificType("requested_ip", "inet");
    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  // ─── updated_at trigger reuse ────────────────────────────────────────────
  await knex.raw(`
    CREATE TRIGGER app_users_set_updated_at
      BEFORE UPDATE ON public.app_users
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("DROP TRIGGER IF EXISTS app_users_set_updated_at ON public.app_users;");
  await knex.schema.dropTableIfExists("password_resets");
  await knex.schema.dropTableIfExists("email_verifications");
  await knex.schema.dropTableIfExists("refresh_sessions");
  await knex.schema.dropTableIfExists("app_users");
}
