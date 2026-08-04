/**
 * Express re-implementation of public.register_for_challenge and
 * public.cancel_active_registration. The caller's id is always passed in
 * explicitly — no auth.uid(), no database function.
 */
import type { Knex } from "knex";
import { getDb } from "../../config/db";
import { expireRegistrations } from "./progress.service";

export type RegisterInput = {
  challenge_id: string;
  ticket_id?: string | null;
  activity_mode?: string | null;
  target_days?: number | null;
};

export type RegisterResult =
  | { ok: true; registration_id: string }
  | { ok: false; error: string; registration_id?: string; challenge_name?: string };

/** Mirrors the challenge_type → activity_mode defaulting in the SQL function. */
export function defaultActivityMode(
  requested: string | null | undefined,
  challengeType: string | null | undefined,
): string {
  const mode = (requested ?? "").trim().toLowerCase();
  if (mode && mode !== "any") return mode;
  const t = (challengeType ?? "").toLowerCase();
  if (t === "ride" || t.includes("cycling")) return "ride";
  if (t === "run/walk" || t.startsWith("walk")) return "walk";
  if (t === "run") return "run";
  return "any";
}

export async function registerForChallenge(
  userId: string,
  input: RegisterInput,
  dbArg: Knex = getDb(),
): Promise<RegisterResult> {
  return dbArg.transaction(async (trx) => {
    await expireRegistrations(userId, trx);

    const existing = await trx("registrations as r")
      .join("challenges as c", "c.id", "r.challenge_id")
      .where({ "r.user_id": userId, "r.status": "active" })
      .first<{ id: string; name: string } | undefined>("r.id", "c.name");
    if (existing) {
      return {
        ok: false as const,
        error: "active_challenge_exists",
        registration_id: existing.id,
        challenge_name: existing.name,
      };
    }

    const challenge = await trx("challenges")
      .where({ id: input.challenge_id })
      .first<{ id: string; challenge_type: string | null } | undefined>("id", "challenge_type");
    if (!challenge) return { ok: false as const, error: "challenge_not_found" };

    const [row] = await trx("registrations")
      .insert({
        user_id: userId,
        challenge_id: input.challenge_id,
        ticket_id: input.ticket_id ?? null,
        activity_mode: defaultActivityMode(input.activity_mode, challenge.challenge_type),
        target_days: input.target_days ?? null,
        status: "active",
        registered_at: trx.fn.now(),
        total_km_logged: 0,
      })
      .returning("id");

    return { ok: true as const, registration_id: (row as any).id ?? row };
  });
}

export async function cancelActiveRegistration(
  userId: string,
  registrationId?: string | null,
  dbArg: Knex = getDb(),
): Promise<{ ok: true; registration_id: string } | { ok: false; error: string }> {
  const qb = dbArg("registrations").where({ user_id: userId, status: "active" });
  if (registrationId) qb.andWhere({ id: registrationId });
  const rows = await qb.update({ status: "cancelled" }).returning("id");
  const id = (rows as any[])[0]?.id ?? (rows as any[])[0];
  if (!id) return { ok: false as const, error: "no_active_registration" };
  return { ok: true as const, registration_id: String(id) };
}
