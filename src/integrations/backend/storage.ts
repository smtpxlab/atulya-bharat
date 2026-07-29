import { request } from "./http";
import { BACKEND_URL, BACKEND_API_PREFIX } from "./config";

function wrap<T>(fn: () => Promise<T>) {
  return fn().then(
    (data) => ({ data, error: null }),
    (err) => ({ data: null, error: { message: err?.message ?? "Unknown error", status: err?.status } }),
  );
}

export function createStorageClient() {
  return {
    from(bucket: string) {
      return {
        async upload(path: string, file: Blob | File | ArrayBuffer, opts: { upsert?: boolean; contentType?: string } = {}) {
          return wrap(async () => {
            const form = new FormData();
            const blob =
              file instanceof Blob ? file : new Blob([file as ArrayBuffer], { type: opts.contentType });
            form.append("file", blob, path.split("/").pop() ?? "upload");
            form.append("bucket", bucket);
            form.append("path", path);
            if (opts.upsert) form.append("upsert", "true");
            const res = await request<any>({
              method: "POST",
              path: "/storage/upload",
              body: form,
            });
            return { path: res.path ?? path, id: res.id, fullPath: `${bucket}/${path}` };
          });
        },

        async remove(paths: string[]) {
          return wrap(async () => {
            const res = await request<any>({
              method: "POST",
              path: "/storage/deleteMany",
              body: { bucket, paths },
            });
            return res?.deleted ?? paths.map((p) => ({ name: p }));
          });
        },

        getPublicUrl(path: string) {
          return {
            data: {
              publicUrl: `${BACKEND_URL}${BACKEND_API_PREFIX}/storage/public/${bucket}/${path.replace(/^\/+/, "")}`,
            },
          };
        },

        async createSignedUrl(path: string, expiresIn = 3600) {
          return wrap(async () => {
            const res = await request<{ signedUrl: string }>({
              method: "POST",
              path: "/storage/createSignedUrl",
              body: { bucket, path, expiresIn },
            });
            return { signedUrl: res.signedUrl };
          });
        },

        async list(prefix = "", opts: { limit?: number; offset?: number } = {}) {
          return wrap(async () => {
            const res = await request<any>({
              path: "/storage/list",
              query: { bucket, prefix, limit: opts.limit, offset: opts.offset },
            });
            return res?.data ?? res ?? [];
          });
        },
      };
    },
  };
}
