import type { Knex } from "knex";
import { z } from "zod";

export const listQuerySchema = z.object({
  q: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  status: z.string().optional(),
});
export type ListQuery = z.infer<typeof listQuerySchema>;

export async function paginate<T>(
  qb: Knex.QueryBuilder,
  page: number,
  pageSize: number,
): Promise<{ items: T[]; page: number; pageSize: number; total: number }> {
  const countQb = qb.clone().clearSelect().clearOrder().count<{ count: string }[]>("* as count");
  const [{ count }] = (await countQb) as unknown as [{ count: string }];
  const items = (await qb
    .limit(pageSize)
    .offset((page - 1) * pageSize)) as unknown as T[];
  return { items, page, pageSize, total: Number(count) };
}

export function ok<T>(data: T) {
  return { data };
}
