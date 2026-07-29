import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { MapPin, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  checkoutAddressSchema,
  type CheckoutAddressInput,
} from "@/schemas/checkout.schema";
import type { Profile } from "@/types/profile";
import { updateProfile } from "@/services/profile.service";
import { useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/queryKeys";

type Props = {
  profile: Profile | null;
  userId: string;
  onSaved: () => void;
};

const isComplete = (p: Profile | null) =>
  !!(p?.full_name && p.mobile && p.house_no && p.address && p.city && p.state && p.pincode);

export const AddressPanel = ({ profile, userId, onSaved }: Props) => {
  const [open, setOpen] = useState(false);
  const complete = isComplete(profile);
  const queryClient = useQueryClient();

  const form = useForm<CheckoutAddressInput>({
    resolver: zodResolver(checkoutAddressSchema),
    defaultValues: {
      full_name: profile?.full_name ?? "",
      mobile: profile?.mobile ?? "",
      house_no: profile?.house_no ?? "",
      address: profile?.address ?? "",
      city: profile?.city ?? "",
      state: profile?.state ?? "",
      pincode: profile?.pincode ?? "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        full_name: profile?.full_name ?? "",
        mobile: profile?.mobile ?? "",
        house_no: profile?.house_no ?? "",
        address: profile?.address ?? "",
        city: profile?.city ?? "",
        state: profile?.state ?? "",
        pincode: profile?.pincode ?? "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onSubmit = async (values: CheckoutAddressInput) => {
    try {
      await updateProfile(userId, values);
      await queryClient.invalidateQueries({ queryKey: qk.profile.me(userId) });
      toast.success("Address saved.");
      setOpen(false);
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save address");
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <h2 className="font-display text-lg text-navy">Billing Address</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className="rounded-full min-h-11"
        >
          {complete ? (
            <>
              <Pencil className="mr-1 h-4 w-4" /> Change
            </>
          ) : (
            <>
              <Plus className="mr-1 h-4 w-4" /> Add New
            </>
          )}
        </Button>
      </header>

      {complete && profile ? (
        <div className="mt-3 rounded-xl bg-muted/40 p-4 text-sm">
          <p className="font-semibold text-foreground">{profile.full_name}</p>
          <p className="text-muted-foreground">
            {profile.house_no}, {profile.address}
          </p>
          <p className="text-muted-foreground">
            {profile.city}, {profile.state} {profile.pincode}
          </p>
          <p className="mt-1 text-muted-foreground">Mobile: {profile.mobile}</p>
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          No addresses available. Add a billing address to continue.
        </div>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {complete ? "Edit billing address" : "Add billing address"}
            </SheetTitle>
          </SheetHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4">
            {(
              [
                ["full_name", "Full name", "text"],
                ["mobile", "Mobile", "tel"],
                ["house_no", "House / Flat / Building", "text"],
                ["address", "Street address", "text"],
                ["city", "City", "text"],
                ["state", "State", "text"],
                ["pincode", "Pincode", "text"],
              ] as const
            ).map(([name, label, type]) => (
              <div key={name} className="space-y-1.5">
                <Label htmlFor={name}>{label}</Label>
                <Input
                  id={name}
                  type={type}
                  {...form.register(name)}
                  className="rounded-xl"
                />
                {form.formState.errors[name]?.message && (
                  <p className="text-xs text-destructive">
                    {String(form.formState.errors[name]?.message)}
                  </p>
                )}
              </div>
            ))}

            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="w-full rounded-full min-h-11"
            >
              Save address
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </section>
  );
};
