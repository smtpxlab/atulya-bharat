import argon2 from "argon2";
import bcrypt from "bcryptjs";
import { env } from "../../config/env";

const argonOptions: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: env.ARGON2_MEMORY_COST,
  timeCost: env.ARGON2_TIME_COST,
  parallelism: env.ARGON2_PARALLELISM,
};

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, argonOptions);
}

/**
 * Verify a password against either an Argon2id hash (new format) or a bcrypt
 * hash (legacy — Supabase Auth uses bcrypt). Returns:
 *   - { valid: true, needsRehash: true }  → caller should rehash with Argon2id
 *   - { valid: true, needsRehash: false } → up-to-date Argon2id hash
 *   - { valid: false }                    → wrong password
 */
export async function verifyPassword(
  hash: string,
  plain: string,
): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (!hash) return { valid: false, needsRehash: false };

  // Argon2 hashes start with "$argon2"
  if (hash.startsWith("$argon2")) {
    const valid = await argon2.verify(hash, plain);
    return { valid, needsRehash: valid ? argon2.needsRehash(hash, argonOptions) : false };
  }

  // bcrypt hashes: $2a$, $2b$, $2y$
  if (/^\$2[aby]\$/.test(hash)) {
    const valid = await bcrypt.compare(plain, hash);
    return { valid, needsRehash: valid };
  }

  return { valid: false, needsRehash: false };
}
