// Source of truth:
//   • Marker position is set EXCLUSIVELY by admin placement here.
//   • Never auto-generate coordinates from distance.
//   • Athlete unlock visuals derive from distance_logged_km elsewhere.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export type EditorMilestone = {
  id: string;
  spot_name: string;
  distance: number;
  x_percent: number | null;
  y_percent: number | null;
};

type Props = {
  routeImageUrl: string | null;
  milestones: EditorMilestone[];
  onSaved?: () => void;
};

type Coords = { x: number | null; y: number | null };

const clamp = (v: number) =>
  Math.round(Math.max(0, Math.min(100, v)) * 100) / 100;

function coordsEqual(a: Coords | undefined, b: Coords | undefined) {
  if (!a || !b) return false;
  return a.x === b.x && a.y === b.y;
}

export function RouteMapEditor({ routeImageUrl, milestones, onSaved }: Props) {
  const sorted = useMemo(
    () => [...milestones].sort((a, b) => a.distance - b.distance),
    [milestones],
  );

  const initial = useMemo<Record<string, Coords>>(() => {
    const map: Record<string, Coords> = {};
    for (const m of sorted) map[m.id] = { x: m.x_percent, y: m.y_percent };
    return map;
  }, [sorted]);

  const [coords, setCoords] = useState<Record<string, Coords>>(initial);
  const [saving, setSaving] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const imgWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setCoords(initial), [initial]);

  const isDirty = useMemo(
    () => sorted.some((m) => !coordsEqual(coords[m.id], initial[m.id])),
    [coords, initial, sorted],
  );

  // Browser-level unsaved-changes guard (refresh, tab close, hard nav).
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const confirmIfDirty = useCallback(() => {
    if (!isDirty) return true;
    return window.confirm(
      "You have unsaved route changes. Leave this page and discard them?",
    );
  }, [isDirty]);

  // Expose a confirm-before-navigate helper for the parent page's back link.
  useEffect(() => {
    (window as any).__routeEditorConfirmLeave = confirmIfDirty;
    return () => {
      delete (window as any).__routeEditorConfirmLeave;
    };
  }, [confirmIfDirty]);

  if (!routeImageUrl) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
        Upload a route map image on the challenge first, then come back to place
        milestones.
      </div>
    );
  }

  const updateFromPointer = (id: string, clientX: number, clientY: number) => {
    const wrap = imgWrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const x = clamp(((clientX - rect.left) / rect.width) * 100);
    const y = clamp(((clientY - rect.top) / rect.height) * 100);
    setCoords((c) => ({ ...c, [id]: { x, y } }));
  };

  const onPinPointerDown = (id: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDragId(id);
  };
  const onPinPointerMove = (id: string) => (e: React.PointerEvent) => {
    if (dragId !== id) return;
    updateFromPointer(id, e.clientX, e.clientY);
  };
  const onPinPointerUp = (id: string) => (e: React.PointerEvent) => {
    if (dragId === id) setDragId(null);
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  };

  const placeAtCenter = (id: string) => {
    setCoords((c) => ({ ...c, [id]: { x: 50, y: 50 } }));
  };

  const unplaced = sorted.filter(
    (m) => coords[m.id]?.x == null || coords[m.id]?.y == null,
  );
  const placed = sorted.filter(
    (m) => coords[m.id]?.x != null && coords[m.id]?.y != null,
  );

  const onSave = async () => {
    if (unplaced.length > 0) {
      toast({
        title: "Please place all milestones on the route map.",
        variant: "destructive",
      });
      return;
    }
    // Defence in depth: refuse out-of-bounds values before they hit the DB.
    const invalid = sorted.find((m) => {
      const c = coords[m.id];
      return (
        c.x == null ||
        c.y == null ||
        c.x < 0 ||
        c.x > 100 ||
        c.y < 0 ||
        c.y > 100
      );
    });
    if (invalid) {
      toast({
        title: "Coordinates out of range",
        description: `${invalid.spot_name} has invalid coordinates (must be 0–100).`,
        variant: "destructive",
      });
      return;
    }

    const changed = sorted.filter(
      (m) => !coordsEqual(coords[m.id], initial[m.id]),
    );
    if (changed.length === 0) {
      toast({ title: "No changes to save" });
      return;
    }

    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id ?? null;
      const stamp = new Date().toISOString();
      await Promise.all(
        changed.map((m) =>
          supabase
            .from("challenge_milestones")
            .update({
              x_percent: coords[m.id].x,
              y_percent: coords[m.id].y,
              coords_updated_at: stamp,
              coords_updated_by: uid,
            } as any)
            .eq("id", m.id),
        ),
      );
      toast({
        title: "Route saved",
        description: `${changed.length} milestone${changed.length === 1 ? "" : "s"} updated.`,
      });
      onSaved?.();
    } catch (e: any) {
      toast({
        title: "Could not save route",
        description: e?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const onReset = () => setCoords(initial);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="space-y-3">
        <div
          ref={imgWrapRef}
          className="relative w-full select-none overflow-hidden rounded-2xl border border-border bg-card"
          style={{ touchAction: "none" }}
        >
          <img
            src={routeImageUrl}
            alt="Route map"
            draggable={false}
            className="block w-full"
          />
          {placed.map((m) => {
            const c = coords[m.id];
            return (
              <div
                key={m.id}
                onPointerDown={onPinPointerDown(m.id)}
                onPointerMove={onPinPointerMove(m.id)}
                onPointerUp={onPinPointerUp(m.id)}
                onPointerCancel={onPinPointerUp(m.id)}
                className="absolute z-10 -translate-x-1/2 -translate-y-full cursor-grab touch-none active:cursor-grabbing"
                style={{ left: `${c.x}%`, top: `${c.y}%` }}
                title={`${m.distance} KM · ${m.spot_name}`}
              >
                <div className="flex flex-col items-center">
                  <span className="whitespace-nowrap rounded-md bg-background/90 px-1.5 py-0.5 text-[10px] font-semibold text-foreground shadow">
                    {m.distance} KM · {m.spot_name}
                  </span>
                  <MapPin
                    className="h-7 w-7 fill-destructive text-destructive drop-shadow"
                    strokeWidth={1.5}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Drag any pin to reposition. Coordinates are stored as percentages (0–100)
          so they stay accurate on every screen size.
          {isDirty && (
            <span className="ml-2 font-semibold text-amber-600">
              · Unsaved changes
            </span>
          )}
        </p>
      </div>

      <aside className="space-y-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <h3 className="font-display text-base text-navy">Unplaced</h3>
          {unplaced.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              All milestones are placed.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {unplaced.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-border p-2 text-xs"
                >
                  <span className="truncate">
                    <span className="font-semibold">{m.distance} KM</span> ·{" "}
                    {m.spot_name}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => placeAtCenter(m.id)}
                  >
                    Place at center
                  </Button>
                </li>
              ))}
              <li className="text-[11px] text-muted-foreground">
                Tip: click "Place at center" then drag the pin to the exact spot.
              </li>
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <h3 className="font-display text-base text-navy">Placed</h3>
          {placed.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              No milestones placed yet.
            </p>
          ) : (
            <ul className="mt-2 space-y-1 text-xs">
              {placed.map((m) => {
                const c = coords[m.id];
                const dirty = !coordsEqual(c, initial[m.id]);
                return (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="truncate">
                      <span className="font-semibold">{m.distance} KM</span> ·{" "}
                      {m.spot_name}
                    </span>
                    <span
                      className={`shrink-0 ${
                        dirty ? "font-semibold text-amber-600" : "text-muted-foreground"
                      }`}
                    >
                      {c.x!.toFixed(2)}, {c.y!.toFixed(2)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Button onClick={onSave} disabled={saving || !isDirty}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving…" : "Save Route Layout"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onReset}
            disabled={!isDirty}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset changes
          </Button>
        </div>
      </aside>
    </div>
  );
}
