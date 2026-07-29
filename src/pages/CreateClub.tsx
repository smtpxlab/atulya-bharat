import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, ImagePlus, ArrowLeft } from "lucide-react";
import { userClubInputSchema, type UserClubInput } from "@/schemas/club.schema";
import { CLUB_TYPES } from "@/types/club";
import { useCreateClub } from "@/features/clubs/hooks/useClubs";
import { uploadClubBanner } from "@/services/club.service";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { SEO } from "@/components/SEO";

const defaults: UserClubInput = {
  name: "",
  club_type: undefined as any,
  promoter_name: "",
  promoter_email: "",
  promoter_phone: "",
  promoter_address: null,
  promoter_city: null,
  promoter_state: null,
  promoter_dob: null,
  promoter_description: "",
  established_at: null,
  member_count: 0,
  banner_url: null,
  description: "",
  social_links: [],
};

const CreateClub = () => {
  // ProtectedRoute guarantees `user` is present once children mount. Still
  // use optional access defensively in handlers below.
  const { user } = useAuth();
  const navigate = useNavigate();

  const createMutation = useCreateClub();
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    document.title = "Create a Club | Atulya Bharat Run";
  }, []);

  const form = useForm<UserClubInput>({
    resolver: zodResolver(userClubInputSchema) as any,
    defaultValues: defaults,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control as any,
    name: "social_links" as never,
  });

  const onPickBanner = async (file: File | null) => {
    if (!file || !user?.id) return;
    setUploading(true);
    try {
      const url = await uploadClubBanner(user.id, file);
      form.setValue("banner_url", url, { shouldDirty: true });
      setBannerPreview(url);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not upload banner");
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = (values: UserClubInput) => {
    if (!user?.id) {
      navigate("/login?redirect=/clubs/create");
      return;
    }
    createMutation.mutate(
      { input: values, userId: user.id },
      {
        onSuccess: () => {
          toast.success("Club submitted for approval");
          navigate("/clubs");
        },
        onError: (e: any) => toast.error(e?.message ?? "Could not create club"),
      },
    );
  };

  return (

    <section className="abr-container max-w-3xl py-10">
      <SEO title="Create a Club | Atulya Bharat Run" noindex />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/clubs"))}
        className="-ml-2 mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>
      <h1 className="text-navy">Create a Club</h1>
      <p className="mt-2 text-muted-foreground">
        Tell us about your club. An administrator will review and approve it before it goes live.
      </p>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="mt-8 space-y-6 rounded-2xl bg-card p-6 shadow-card"
        >
          {/* Basic */}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Club name *</FormLabel>
                  <FormControl>
                    <Input {...field} maxLength={160} placeholder="Bangalore Trail Runners" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="club_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Club type *</FormLabel>
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CLUB_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="established_at"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Established date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="member_count"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Approximate number of members</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Promoter */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Promoter details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="promoter_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Promoter name *</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="promoter_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Promoter email *</FormLabel>
                    <FormControl><Input type="email" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="promoter_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Promoter phone *</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="promoter_dob"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Promoter DOB</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="promoter_address"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Promoter address</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="promoter_city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="promoter_state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Banner */}
          <div className="space-y-2">
            <Label>Club banner</Label>
            <label
              htmlFor="club-banner"
              className="flex cursor-pointer items-center gap-4 rounded-xl border border-dashed border-border p-4 hover:bg-muted/50"
            >
              {bannerPreview || form.watch("banner_url") ? (
                <img
                  src={bannerPreview ?? (form.watch("banner_url") as string)}
                  alt="Banner preview"
                  className="h-20 w-32 rounded object-cover"
                />
              ) : (
                <span className="flex h-20 w-32 items-center justify-center rounded bg-muted text-muted-foreground">
                  <ImagePlus className="h-6 w-6" />
                </span>
              )}
              <div className="text-sm">
                <p className="font-medium text-foreground">
                  {uploading ? "Uploading…" : "Upload a banner"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Landscape image works best (16:9).
                </p>
              </div>
              <input
                id="club-banner"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onPickBanner(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          {/* About promoter */}
          <FormField
            control={form.control}
            name="promoter_description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>About the promoter</FormLabel>
                <FormControl>
                  <RichTextEditor
                    value={field.value ?? ""}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Description */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>About the club</FormLabel>
                <FormControl>
                  <RichTextEditor
                    value={field.value ?? ""}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Social links */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Social media links</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => append("https://" as any)}
              >
                <Plus className="mr-1 h-4 w-4" /> Add link
              </Button>
            </div>
            {fields.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Add Instagram, Strava, website, or any public links.
              </p>
            )}
            <div className="space-y-2">
              {fields.map((f, i) => (
                <div key={f.id} className="flex gap-2">
                  <FormField
                    control={form.control}
                    name={`social_links.${i}` as const}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input {...field} placeholder="https://instagram.com/..." />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(i)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={createMutation.isPending || uploading}
          >
            {createMutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…</>
            ) : (
              "Submit for approval"
            )}
          </Button>
        </form>
      </Form>
    </section>
  );
};

export default CreateClub;
