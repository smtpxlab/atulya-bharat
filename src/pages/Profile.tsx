import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/useAuth";
import {
  useProfile,
  useUpdateProfile,
  useChangePassword,
} from "@/features/profile/hooks/useProfile";
import {
  profileUpdateSchema,
  changePasswordSchema,
  GENDERS,
  type ProfileUpdateInput,
  type ChangePasswordInput,
} from "@/features/profile/profile.schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileImageUploader } from "@/components/profile/ProfileImageUploader";
import { SEO } from "@/components/SEO";

const Profile = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const update = useUpdateProfile();
  const change = useChangePassword();

  const form = useForm<ProfileUpdateInput>({
    resolver: zodResolver(profileUpdateSchema),
    values: {
      full_name: profile?.full_name ?? "",
      mobile: profile?.mobile ?? "",
      gender: (profile?.gender as ProfileUpdateInput["gender"]) ?? null,
      dob: profile?.dob ?? "",
      house_no: profile?.house_no ?? "",
      address: profile?.address ?? "",
      city: profile?.city ?? "",
      state: profile?.state ?? "",
      pincode: profile?.pincode ?? "",
    } as ProfileUpdateInput,
  });

  const pwForm = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { oldPassword: "", newPassword: "", confirmPassword: "" },
  });

  const onSave = form.handleSubmit((vals) => update.mutate(vals));
  const onChangePw = pwForm.handleSubmit(({ oldPassword, newPassword }) =>
    change.mutate({ oldPassword, newPassword }, { onSuccess: () => pwForm.reset() }),
  );

  if (isLoading) {
    return (
      <section className="abr-container py-10">
        <Skeleton className="h-96 w-full rounded-2xl" />
      </section>
    );
  }

  return (
    <section className="abr-container py-10 space-y-8">
      <SEO title="Profile | Atulya Bharat Run" noindex />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/dashboard"))}
        className="-ml-2"
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>
      <h1 className="text-navy">Profile</h1>

      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6 pb-6 border-b">
            <ProfileImageUploader
              name={profile?.full_name}
              avatarUrl={profile?.avatar_url}
            />
          </div>
          <form onSubmit={onSave} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input id="full_name" {...form.register("full_name")} />
                {form.formState.errors.full_name && (
                  <p className="text-sm text-destructive">{form.formState.errors.full_name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile">Mobile</Label>
                <Input id="mobile" {...form.register("mobile")} placeholder="10–15 digits" />
                {form.formState.errors.mobile && (
                  <p className="text-sm text-destructive">{form.formState.errors.mobile.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user?.email ?? ""} disabled readOnly />
              </div>
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select
                  value={form.watch("gender") ?? ""}
                  onValueChange={(v) =>
                    form.setValue("gender", (v || null) as ProfileUpdateInput["gender"], {
                      shouldDirty: true,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDERS.map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dob">Date of Birth</Label>
                <Input id="dob" type="date" {...form.register("dob")} />
              </div>
            </div>

            <div className="pt-4 border-t">
              <h3 className="font-semibold text-navy mb-4">Address Information</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="house_no">House No</Label>
                  <Input id="house_no" {...form.register("house_no")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address (Area and Street)</Label>
                  <Input id="address" {...form.register("address")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">City / District / Town</Label>
                  <Input id="city" {...form.register("city")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input id="state" {...form.register("state")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pincode">Pincode / Zipcode</Label>
                  <Input id="pincode" {...form.register("pincode")} />
                  {form.formState.errors.pincode && (
                    <p className="text-sm text-destructive">{form.formState.errors.pincode.message}</p>
                  )}
                </div>
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
          <CardTitle>Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onChangePw} className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="oldPassword">Old Password</Label>
              <Input id="oldPassword" type="password" {...pwForm.register("oldPassword")} />
              {pwForm.formState.errors.oldPassword && (
                <p className="text-sm text-destructive">{pwForm.formState.errors.oldPassword.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input id="newPassword" type="password" {...pwForm.register("newPassword")} />
              {pwForm.formState.errors.newPassword && (
                <p className="text-sm text-destructive">{pwForm.formState.errors.newPassword.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input id="confirmPassword" type="password" {...pwForm.register("confirmPassword")} />
              {pwForm.formState.errors.confirmPassword && (
                <p className="text-sm text-destructive">{pwForm.formState.errors.confirmPassword.message}</p>
              )}
            </div>
            <Button type="submit" disabled={change.isPending}>
              {change.isPending ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
};

export default Profile;
