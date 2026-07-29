import { getDb } from "../config/db";

export interface RefreshSessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  parent_id: string | null;
  user_agent: string | null;
  ip: string | null;
  issued_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
  revoked_reason: string | null;
}

const TABLE = "refresh_sessions";

export const sessionRepo = {
  async create(row: {
    user_id: string;
    token_hash: string;
    expires_at: Date;
    parent_id?: string | null;
    user_agent?: string | null;
    ip?: string | null;
  }): Promise<RefreshSessionRow> {
    const [inserted] = await getDb()<RefreshSessionRow>(TABLE)
      .insert({
        user_id: row.user_id,
        token_hash: row.token_hash,
        parent_id: row.parent_id ?? null,
        user_agent: row.user_agent ?? null,
        ip: row.ip ?? null,
        expires_at: row.expires_at,
      })
      .returning("*");
    return inserted;
  },

  async findByTokenHash(hash: string): Promise<RefreshSessionRow | null> {
    return (
      (await getDb()<RefreshSessionRow>(TABLE).where({ token_hash: hash }).first()) ?? null
    );
  },

  async findById(id: string): Promise<RefreshSessionRow | null> {
    return (await getDb()<RefreshSessionRow>(TABLE).where({ id }).first()) ?? null;
  },

  async revoke(id: string, reason: string): Promise<void> {
    await getDb()(TABLE)
      .where({ id })
      .whereNull("revoked_at")
      .update({ revoked_at: new Date(), revoked_reason: reason });
  },

  async revokeFamily(userId: string, reason: string): Promise<void> {
    await getDb()(TABLE)
      .where({ user_id: userId })
      .whereNull("revoked_at")
      .update({ revoked_at: new Date(), revoked_reason: reason });
  },

  async listActive(userId: string): Promise<RefreshSessionRow[]> {
    return getDb()<RefreshSessionRow>(TABLE)
      .where({ user_id: userId })
      .whereNull("revoked_at")
      .orderBy("issued_at", "desc");
  },
};
