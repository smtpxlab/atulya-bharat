import { request } from "./http";

export function createFunctionsClient() {
  return {
    async invoke(name: string, opts: { body?: unknown; headers?: Record<string, string> } = {}) {
      try {
        const data = await request<any>({
          method: "POST",
          path: `/functions/${name}`,
          body: opts.body,
          headers: opts.headers,
        });
        return { data, error: null };
      } catch (err: any) {
        return {
          data: null,
          error: { message: err?.message ?? "Unknown error", status: err?.status, context: err?.payload },
        };
      }
    },
  };
}
