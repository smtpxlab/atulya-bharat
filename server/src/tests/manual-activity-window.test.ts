import { describe, expect, it } from "vitest";
import { logManualActivity } from "../services/challenges/progress.service";

/**
 * Regression: the loggable-date window must be compared/reported as ISO dates
 * (YYYY-MM-DD), not as stringified JS Date objects ("Tue Aug 04 2026 ...").
 */
const ctx = {
  id: "reg-1",
  user_id: "user-1",
  challenge_id: "ch-1",
  status: "active",
  registered_at: new Date("2026-08-04T05:57:32.580Z"),
  activity_mode: "run",
  target: 62,
  window_start: "2026-08-04",
  window_end_ts: new Date("2026-09-03T05:57:32.580Z"),
  window_end_date: "2026-08-04",
  reg_date: "2026-08-04",
  window_end_full: "2026-09-03",
  days_left: 30,
};

function fakeDb(onInsert: () => never) {
  const trx: any = (table: string) => {
    if (table === "activity_logs") {
      const qb: any = {
        where: () => qb,
        andWhereRaw: () => qb,
        first: async () => undefined,
        insert: () => onInsert(),
      };
      return qb;
    }
    throw new Error(`unexpected table ${table}`);
  };
  trx.raw = async (sql: string) => (/from public.registrations/.test(sql) ? { rows: [ctx] } : { rows: [] });
  return { transaction: (cb: any) => cb(trx) } as any;
}

const base = {
  registration_id: "reg-1",
  distance_km: 8,
  activity_type: "run",
};

describe("logManualActivity date window", () => {
  it("rejects out-of-window dates with ISO bounds in the message", async () => {
    await expect(
      logManualActivity("user-1", { ...base, activity_date: "2026-09-04" }, fakeDb(() => {
        throw new Error("should not insert");
      })),
    ).rejects.toThrow("Pick a date between 2026-08-04 and 2026-09-03.");
  });

  it("accepts a date inside the window (reaches the insert)", async () => {
    await expect(
      logManualActivity("user-1", { ...base, activity_date: "2026-08-20" }, fakeDb(() => {
        throw new Error("INSERT_REACHED");
      })),
    ).rejects.toThrow("INSERT_REACHED");
  });
});
