import { ShieldAlert } from "lucide-react";

/**
 * The IAM / security surfaces are served by the custom Express backend.
 * When that backend is not enabled for the current environment we show this
 * instead of firing requests that will always fail.
 */
export function BackendDisabledNotice({ feature }: { feature: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      <div>
        <p className="font-medium">{feature} is not available yet</p>
        <p className="text-muted-foreground">
          This screen is powered by the custom authentication backend, which is disabled in this
          environment. Enable it (VITE_BACKEND_ENABLED) to manage identity and access here.
        </p>
      </div>
    </div>
  );
}
