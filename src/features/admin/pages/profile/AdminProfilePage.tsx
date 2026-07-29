import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  useAdminProfile,
  useUpdateAdminProfile,
  useChangeAdminPassword,
} from "@/features/admin/profile/hooks/useAdminProfile";
import {
  adminProfileUpdateSchema,
  adminChangePasswordSchema,
  type AdminProfileUpdateInput,
  type AdminChangePasswordInput,
} from "@/features/admin/profile/adminProfile.schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminProfilePage() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useAdminProfile();
  const update = useUpdateAdminProfile();
  const change = useChangeAdminPassword();

  useEffect(() => {
    document.title = "Admin Profile | Atulya Bharat Run";
  }, []);

  const form = useForm<AdminProfileUpdateInput>({
    resolver: zodResolver(adminProfileUpdateSchema),
    values: {
      full_name: profile?.full_name ?? "",
      username: profile?.username ?? "",
      contact: profile?.mobile ?? "",
      shop_name: (profile as any)?.shop_name ?? "",
      address: profile?.address ?? "",
      state: profile?.state ?? "",
      city: profile?.city ?? "",
      pin_code: profile?.pincode ?? "",
    },
  });

  const pwForm = useForm<AdminChangePasswordInput>({
    resolver: zodResolver(adminChangePasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const onSave = form.handleSubmit(
    (vals) => update.mutate(vals),
    () => toast.error("Please fix the highlighted fields."),
  );

  const onChangePw = pwForm.handleSubmit(
    ({ newPassword }) =>
      change.mutate(newPassword, { onSuccess: () => pwForm.reset() }),
    () => toast.error("Please fix the highlighted fields."),
  );

  if (isLoading) {
    return (
      <div className="p-6">
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Admin Profile</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account details and password.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSave} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Full Name *" error={form.formState.errors.full_name?.message}>
                <Input {...form.register("full_name")} />
              </Field>
              <Field label="Username *" error={form.formState.errors.username?.message}>
                <Input {...form.register("username")} />
              </Field>
              <Field label="Email *">
                <Input value={user?.email ?? ""} disabled readOnly />
              </Field>
              <Field label="Contact *" error={form.formState.errors.contact?.message}>
                <Input {...form.register("contact")} placeholder="Phone number" />
              </Field>
            </div>

            <div className="pt-4 border-t">
              <h3 className="font-semibold mb-4">Business Information</h3>
              <Field label="Shop Name" error={form.formState.errors.shop_name?.message}>
                <Input {...form.register("shop_name")} />
              </Field>
            </div>

            <div className="pt-4 border-t">
              <h3 className="font-semibold mb-4">Address Information</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Address" error={form.formState.errors.address?.message}>
                  <Input {...form.register("address")} />
                </Field>
                <Field label="State" error={form.formState.errors.state?.message}>
                  <Input {...form.register("state")} />
                </Field>
                <Field label="City" error={form.formState.errors.city?.message}>
                  <Input {...form.register("city")} />
                </Field>
                <Field label="Pin Code" error={form.formState.errors.pin_code?.message}>
                  <Input {...form.register("pin_code")} />
                </Field>
              </div>
            </div>

            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reset Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onChangePw} className="space-y-4 max-w-md">
            <Field label="Change Password" error={pwForm.formState.errors.newPassword?.message}>
              <Input type="password" {...pwForm.register("newPassword")} />
            </Field>
            <Field label="Confirm Password" error={pwForm.formState.errors.confirmPassword?.message}>
              <Input type="password" {...pwForm.register("confirmPassword")} />
            </Field>
            <Button type="submit" disabled={change.isPending}>
              {change.isPending ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
