/**
 * Express re-implementation of public.subscribe_to_newsletter.
 * Returns the same { status } contract the frontend already handles:
 * invalid | duplicate | reactivated | subscribed.
 */
import type { Knex } from "knex";
import { getDb } from "../../config/db";

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export type NewsletterStatus = "invalid" | "duplicate" | "reactivated" | "subscribed";

export async function subscribeToNewsletter(
  email: string | null | undefined,
  source: string | null = null,
  dbArg: Knex = getDb(),
): Promise<{ status: NewsletterStatus }> {
  const normalized = (email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(normalized)) return { status: "invalid" };

  return dbArg.transaction(async (trx) => {
    const existing = await trx("newsletter_subscribers")
      .where({ email: normalized })
      .first<{ id: string; status: string; source: string | null } | undefined>();

    if (existing) {
      if (existing.status === "subscribed") return { status: "duplicate" as const };
      await trx("newsletter_subscribers")
        .where({ id: existing.id })
        .update({
          status: "subscribed",
          subscribed_at: trx.fn.now(),
          unsubscribed_at: null,
          source: source ?? existing.source,
          updated_at: trx.fn.now(),
        });
      return { status: "reactivated" as const };
    }

    await trx("newsletter_subscribers")
      .insert({ email: normalized, source })
      .onConflict("email")
      .ignore();
    return { status: "subscribed" as const };
  });
}
