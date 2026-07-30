import { request } from "./http";

/**
 * Thenable PostgREST-style query builder that translates to REST calls on the
 * Express backend. Only the subset used by the current React codebase is
 * implemented; unsupported operators throw at call time so regressions surface
 * loudly during the staged cutover.
 */
type Filter = { op: string; column: string; value: unknown };

interface State {
  table: string;
  filters: Filter[];
  select?: string;
  order?: { column: string; ascending: boolean };
  limitVal?: number;
  rangeFrom?: number;
  rangeTo?: number;
  single?: boolean;
  maybeSingle?: boolean;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  returning?: boolean;
}

export function createFromBuilder(table: string) {
  const build = (state: State): any => {
    const api: any = {
      select(columns = "*") {
        state.select = columns;
        if (state.method === "GET" || state.returning) state.returning = true;
        return build(state);
      },
      insert(values: unknown) {
        return build({ ...state, method: "POST", body: values });
      },
      update(values: unknown) {
        return build({ ...state, method: "PATCH", body: values });
      },
      upsert(values: unknown, _opts?: unknown) {
        return build({ ...state, method: "POST", body: values, filters: [...state.filters, { op: "upsert", column: "", value: true }] });
      },
      delete() {
        return build({ ...state, method: "DELETE" });
      },
      eq(column: string, value: unknown) {
        state.filters.push({ op: "eq", column, value });
        return build(state);
      },
      neq(column: string, value: unknown) {
        state.filters.push({ op: "neq", column, value });
        return build(state);
      },
      gt(column: string, value: unknown) { state.filters.push({ op: "gt", column, value }); return build(state); },
      gte(column: string, value: unknown) { state.filters.push({ op: "gte", column, value }); return build(state); },
      lt(column: string, value: unknown) { state.filters.push({ op: "lt", column, value }); return build(state); },
      lte(column: string, value: unknown) { state.filters.push({ op: "lte", column, value }); return build(state); },
      like(column: string, value: unknown) { state.filters.push({ op: "like", column, value }); return build(state); },
      ilike(column: string, value: unknown) { state.filters.push({ op: "ilike", column, value }); return build(state); },
      in(column: string, values: unknown[]) { state.filters.push({ op: "in", column, value: values }); return build(state); },
      is(column: string, value: unknown) { state.filters.push({ op: "is", column, value }); return build(state); },
      order(column: string, opts: { ascending?: boolean } = {}) {
        state.order = { column, ascending: opts.ascending ?? true };
        return build(state);
      },
      limit(n: number) { state.limitVal = n; return build(state); },
      range(from: number, to: number) { state.rangeFrom = from; state.rangeTo = to; return build(state); },
      single() { state.single = true; return build(state); },
      maybeSingle() { state.maybeSingle = true; return build(state); },
      then(resolve: (v: any) => void, reject: (e: any) => void) {
        return execute(state).then(resolve, reject);
      },
      catch(reject: (e: any) => void) {
        return execute(state).catch(reject);
      },
    };
    return api;
  };

  const execute = async (state: State) => {
    try {
      const query: Record<string, unknown> = {};
      if (state.select) query.select = state.select;
      if (state.order) {
        query.order = state.order.column;
        query.direction = state.order.ascending ? "asc" : "desc";
      }
      if (state.limitVal !== undefined) query.limit = state.limitVal;
      if (state.rangeFrom !== undefined) query.offset = state.rangeFrom;
      if (state.rangeTo !== undefined && state.rangeFrom !== undefined) {
        query.limit = state.rangeTo - state.rangeFrom + 1;
      }
      for (const f of state.filters) {
        if (f.op === "upsert" || f.column === "") continue;
        query[`${f.column}.${f.op}`] = Array.isArray(f.value) ? f.value.join(",") : String(f.value);
      }

      // The Express backend exposes dedicated REST routes rather than a
      // generic PostgREST-style table endpoint for a few tables. `user_roles`
      // matters most: AuthBootstrap reads it right after sign-in, and the
      // admin-gated list route would 403 before any role is known
      // (chicken-and-egg → isAdmin false → /admin bounces to /dashboard).
      const isSelfRoleQuery =
        state.table === "user_roles" &&
        state.method === "GET" &&
        state.filters.some((f) => f.op === "eq" && f.column === "user_id");

      const path = isSelfRoleQuery ? "/user-roles/me" : `/tables/${state.table}`;


      const data = await request<any>({
        method: state.method,
        path,
        query,
        body: state.method === "GET" ? undefined : state.body,
      });

      const rows = Array.isArray(data) ? data : data?.data ?? data;
      const out =
        state.single
          ? Array.isArray(rows) ? rows[0] ?? null : rows
          : state.maybeSingle
          ? Array.isArray(rows) ? rows[0] ?? null : rows
          : rows;
      return { data: out, error: null, count: (data && data.count) ?? null, status: 200 };
    } catch (err: any) {
      return {
        data: null,
        error: { message: err?.message ?? "Unknown error", status: err?.status, details: err?.payload },
        count: null,
        status: err?.status ?? 500,
      };
    }
  };

  return build({ table, filters: [], method: "GET" });
}
