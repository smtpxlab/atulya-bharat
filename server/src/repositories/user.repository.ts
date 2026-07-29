import type { Knex } from "knex";
import { getDb } from "../config/db";

export interface AppUserRow {
  id: string;
  email: string;
  password_hash: string | null;
  password_algo: string;
  email_verified_at: Date | null;
  is_active: boolean;
  last_login_at: Date | null;
  failed_login_count: number;
  locked_until: Date | null;
  created_at: Date;
  updated_at: Date;
}

const TABLE = "app_users";

export const userRepo = {
  db(): Knex {
    return getDb();
  },

  async findById(id: string): Promise<AppUserRow | null> {
    return (await getDb()<AppUserRow>(TABLE).where({ id }).first()) ?? null;
  },

  async findByEmail(email: string): Promise<AppUserRow | null> {
    return (
      (await getDb()<AppUserRow>(TABLE)
        .whereRaw("lower(email) = lower(?)", [email])
        .first()) ?? null
    );
  },

  async create(row: {
    id: string;
    email: string;
    password_hash: string;
    password_algo?: string;
  }): Promise<AppUserRow> {
    const [inserted] = await getDb()<AppUserRow>(TABLE)
      .insert({
        id: row.id,
        email: row.email,
        password_hash: row.password_hash,
        password_algo: row.password_algo ?? "argon2id",
      })
      .returning("*");
    return inserted;
  },

  async updatePassword(id: string, hash: string, algo = "argon2id"): Promise<void> {
    await getDb()(TABLE)
      .where({ id })
      .update({ password_hash: hash, password_algo: algo, updated_at: new Date() });
  },

  async markEmailVerified(id: string): Promise<void> {
    await getDb()(TABLE).where({ id }).update({ email_verified_at: new Date() });
  },

  async recordLoginSuccess(id: string): Promise<void> {
    await getDb()(TABLE)
      .where({ id })
      .update({ last_login_at: new Date(), failed_login_count: 0, locked_until: null });
  },

  async recordLoginFailure(id: string, lockThreshold = 10, lockMinutes = 15): Promise<void> {
    const db = getDb();
    await db.raw(
      `UPDATE public.app_users
          SET failed_login_count = failed_login_count + 1,
              locked_until = CASE
                WHEN failed_login_count + 1 >= ?
                THEN now() + (? || ' minutes')::interval
                ELSE locked_until
              END
        WHERE id = ?`,
      [lockThreshold, lockMinutes, id],
    );
  },

  async getRoles(userId: string): Promise<string[]> {
    const rows = await getDb()("user_roles")
      .select<{ role: string }[]>("role")
      .where("user_id", userId);
    return rows.map((r) => r.role);
  },
};
