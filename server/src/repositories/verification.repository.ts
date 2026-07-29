import { getDb } from "../config/db";

export interface VerificationRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  consumed_at: Date | null;
  created_at: Date;
}

export interface PasswordResetRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  consumed_at: Date | null;
  requested_ip: string | null;
  created_at: Date;
}

export const verificationRepo = {
  async create(userId: string, tokenHash: string, expiresAt: Date): Promise<VerificationRow> {
    const [row] = await getDb()<VerificationRow>("email_verifications")
      .insert({ user_id: userId, token_hash: tokenHash, expires_at: expiresAt })
      .returning("*");
    return row;
  },
  async findByTokenHash(hash: string): Promise<VerificationRow | null> {
    return (
      (await getDb()<VerificationRow>("email_verifications")
        .where({ token_hash: hash })
        .first()) ?? null
    );
  },
  async consume(id: string): Promise<void> {
    await getDb()("email_verifications")
      .where({ id })
      .whereNull("consumed_at")
      .update({ consumed_at: new Date() });
  },
};

export const passwordResetRepo = {
  async create(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    ip: string | null,
  ): Promise<PasswordResetRow> {
    const [row] = await getDb()<PasswordResetRow>("password_resets")
      .insert({
        user_id: userId,
        token_hash: tokenHash,
        expires_at: expiresAt,
        requested_ip: ip,
      })
      .returning("*");
    return row;
  },
  async findByTokenHash(hash: string): Promise<PasswordResetRow | null> {
    return (
      (await getDb()<PasswordResetRow>("password_resets")
        .where({ token_hash: hash })
        .first()) ?? null
    );
  },
  async consume(id: string): Promise<void> {
    await getDb()("password_resets")
      .where({ id })
      .whereNull("consumed_at")
      .update({ consumed_at: new Date() });
  },
};
