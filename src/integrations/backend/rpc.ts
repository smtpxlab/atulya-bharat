import { request } from "./http";

export async function rpc(fn: string, args: Record<string, unknown> = {}) {
  try {
    const data = await request<any>({
      method: "POST",
      path: `/rpc/${fn}`,
      body: args,
    });
    return { data, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: { message: err?.message ?? "Unknown error", status: err?.status, details: err?.payload },
    };
  }
}
