import type { Knex } from "knex";

/**
 * Phase 9 — Custom Identity & Access Management
 * -----------------------------------------------------------------------------
 * Completes the auth surface that Supabase GoTrue used to provide internally:
 *
 *   login_attempts   every login attempt (success or failure) for brute-force
 *                    detection and the admin "security log" view
 *   user_devices     one row per recognised device/user-agent fingerprint
 *   audit_logs       append-only trail of auth + authorization events
 *
 * Also extends `refresh_sessions` with device linkage and last-seen tracking so
 * the "Active sessions" screen can show real per-device sessions and revoke
 * them individually.
 */

export async function up(knex: Knex): Promise<void> {
  // ─── login_attempts ───────────────────────────────────────────────────────
  await knex.schema.createTable("login_attempts", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("user_id").nullable(); // null when the email doesn't resolve
    t.text("email").notNullable();
    t.boolean("success").notNullable().defaultTo(false);
    t.text("reason"); // 'invalid_password' | 'locked' | 'disabled' | 'no_password' | null
    t.specificType("ip", "inet");
    t.text("user_agent");
    t.timestamp("attempted_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
  await knex.raw(
    `CREATE INDEX login_attempts_email_time_idx ON public.login_attempts (lower(email), attempted_at DESC);`,
  );
  await knex.raw(
    `CREATE INDEX login_attempts_user_time_idx ON public.login_attempts (user_id, attempted_at DESC);`,
  );

  // ─── user_devices ─────────────────────────────────────────────────────────
  await knex.schema.createTable("user_devices", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("user_id")
      .notNullable()
      .references("id")
      .inTable("app_users")
      .onDelete("CASCADE");
    // sha256(user_agent + platform hint) — stable per browser/app install
    t.text("fingerprint").notNullable();
    t.text("label"); // "Chrome on Windows", "ABR iOS app"
    t.text("user_agent");
    t.specificType("last_ip", "inet");
    t.boolean("trusted").notNullable().defaultTo(false);
    t.timestamp("first_seen_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp("last_seen_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
  await knex.raw(
    `CREATE UNIQUE INDEX user_devices_user_fingerprint_idx ON public.user_devices (user_id, fingerprint);`,
  );

  // ─── audit_logs ───────────────────────────────────────────────────────────
  await knex.schema.createTable("audit_logs", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("actor_id"); // who performed the action (null = system)
    t.uuid("target_user_id"); // who it was performed on, when applicable
    t.text("action").notNullable(); // 'login', 'logout', 'role.granted', ...
    t.text("category").notNullable().defaultTo("auth"); // 'auth' | 'security' | 'admin'
    t.jsonb("metadata").notNullable().defaultTo(knex.raw("'{}'::jsonb"));
    t.specificType("ip", "inet");
    t.text("user_agent");
    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
  await knex.raw(`CREATE INDEX audit_logs_created_idx ON public.audit_logs (created_at DESC);`);
  await knex.raw(`CREATE INDEX audit_logs_actor_idx ON public.audit_logs (actor_id, created_at DESC);`);
  await knex.raw(`CREATE INDEX audit_logs_action_idx ON public.audit_logs (action, created_at DESC);`);

  // ─── refresh_sessions extensions ──────────────────────────────────────────
  await knex.schema.alterTable("refresh_sessions", (t) => {
    t.uuid("device_id").references("id").inTable("user_devices").onDelete("SET NULL");
    t.timestamp("last_used_at", { useTz: true });
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("refresh_sessions", (t) => {
    t.dropColumn("device_id");
    t.dropColumn("last_used_at");
  });
  await knex.schema.dropTableIfExists("audit_logs");
  await knex.schema.dropTableIfExists("user_devices");
  await knex.schema.dropTableIfExists("login_attempts");
}
