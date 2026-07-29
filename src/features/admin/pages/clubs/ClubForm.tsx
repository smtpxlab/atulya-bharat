import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Upload, Image as ImageIcon } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { adminClubInputSchema, type AdminClubInput, slugify } from "@/schemas/club.schema";
import { CLUB_TYPES } from "@/types/club";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { uploadRichTextImage } from "@/services/richTextImage.service";

type Props = {
  initial?: Partial<AdminClubInput>;
  submitting?: boolean;
  submitLabel: string;
  hideAdminOnlyFields?: boolean; // not used here — admin form shows everything
  onSubmit: (values: AdminClubInput) => void;
};

export default function ClubForm({ initial, onSubmit, submitting, submitLabel }: Props) {
  const form = useForm<AdminClubInput>({
    resolver: zodResolver(adminClubInputSchema) as any,
    defaultValues: {
      name: "",
      slug: "",
      club_type: undefined as any,
      description: "",
      logo_url: null,
      banner_url: null,
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
      registration_code: null,
      referral_code: null,
      discount_challenge_percent: 0,
      discount_cart_percent: 0,
      social_links: [],
      tags: [],
      is_public: false,
      status: "pending",
      priority: 0,
      meta_title: null,
      meta_description: null,
      meta_keywords: [],
      ...initial,
    } as any,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "social_links" as never,
  });

  const tags = useWatch({ control: form.control, name: "tags" }) ?? [];
  const [tagInput, setTagInput] = useState("");
  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    if (!tags.includes(t)) form.setValue("tags", [...tags, t], { shouldDirty: true });
    setTagInput("");
  };
  const removeTag = (t: string) =>
    form.setValue("tags", tags.filter((x: string) => x !== t), { shouldDirty: true });

  const [uploading, setUploading] = useState(false);
  const uploadBanner = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("club-banners")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("club-banners").getPublicUrl(path);
      form.setValue("banner_url", data.publicUrl, { shouldDirty: true });
      toast({ title: "Banner uploaded" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const bannerUrl = form.watch("banner_url");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-8">
        {/* Basic Information */}
        <Section title="Basic Information">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Club Name *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        if (!form.getValues("slug")) {
                          form.setValue("slug", slugify(e.target.value));
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug *</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormDescription>Auto-generated; override if needed.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="club_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Club Type *</FormLabel>
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pick a type" />
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
              name="logo_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Logo URL</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} placeholder="https://…" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-2">
            <FormLabel>Club Banner</FormLabel>
            <div className="flex items-start gap-4 rounded-md border p-3">
              {bannerUrl ? (
                <img src={bannerUrl} alt="Banner" className="h-24 w-40 rounded object-cover" />
              ) : (
                <div className="flex h-24 w-40 items-center justify-center rounded bg-muted text-muted-foreground">
                  <ImageIcon className="h-6 w-6" />
                </div>
              )}
              <div className="flex-1 space-y-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
                  <Upload className="h-4 w-4" />
                  {uploading ? "Uploading…" : "Upload banner"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadBanner(f);
                    }}
                  />
                </label>
                <Input
                  placeholder="…or paste URL"
                  value={bannerUrl ?? ""}
                  onChange={(e) =>
                    form.setValue("banner_url", e.target.value || null, { shouldDirty: true })
                  }
                />
              </div>
            </div>
          </div>

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Club Description</FormLabel>
                <FormControl>
                  <RichTextEditor
                    value={field.value ?? ""}
                    onChange={(html) => field.onChange(html)}
                    onImageUpload={(f) => uploadRichTextImage(f, "clubs")}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </Section>

        {/* Promoter Information */}
        <Section title="Promoter Information">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name="promoter_name" label="Promoter Name *" />
            <TextField name="promoter_email" label="Promoter Email *" type="email" />
            <TextField name="promoter_phone" label="Promoter Phone *" />
            <TextField name="promoter_city" label="Promoter City" />
            <TextField name="promoter_state" label="Promoter State" />
            <FormField
              control={form.control}
              name="promoter_dob"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Promoter DOB</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="promoter_address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Promoter Address</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="promoter_description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>About Promoter</FormLabel>
                <FormControl>
                  <RichTextEditor
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onImageUpload={(f) => uploadRichTextImage(f, "clubs")}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </Section>

        {/* Club Information */}
        <Section title="Club Information">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="established_at"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Establishment Date</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <TextField name="registration_code" label="Registration Code" />
            <TextField name="referral_code" label="Referral Code" />
            <FormField
              control={form.control}
              name="member_count"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Number of Members</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} {...field} />
                  </FormControl>
                  <FormDescription>Auto-updated as users join.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </Section>

        {/* Discounts */}
        <Section title="Discounts">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="discount_challenge_percent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Club Discount % (Challenges)</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} max={100} step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="discount_cart_percent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Club Discount % (Shopping Cart)</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} max={100} step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </Section>

        {/* Social Links */}
        <Section title="Social Links">
          <div className="space-y-2 rounded-md border p-3">
            {fields.length === 0 && (
              <div className="text-sm text-muted-foreground">No links yet.</div>
            )}
            {fields.map((f, i) => (
              <div key={f.id} className="flex items-start gap-2">
                <FormField
                  control={form.control}
                  name={`social_links.${i}` as const}
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Input placeholder="https://…" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append("" as any)}
            >
              <Plus className="mr-1 h-4 w-4" /> Add link
            </Button>
          </div>
        </Section>

        {/* Tags */}
        <Section title="Tags">
          <div className="flex flex-wrap items-center gap-2 rounded-md border p-3">
            {(tags as string[]).map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
              >
                {t}
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => removeTag(t)}
                >
                  ×
                </button>
              </span>
            ))}
            <Input
              className="h-7 w-40"
              placeholder="Add tag…"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={addTag}>
              Add
            </Button>
          </div>
        </Section>

        {/* Visibility */}
        {/* SEO */}
        <Section title="SEO">
          <FormField
            control={form.control}
            name="meta_title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Meta Title</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value || null)}
                    placeholder="Optional — falls back to Club Name | Atulya Bharat Run"
                  />
                </FormControl>
                <FormDescription>Falls back to Club Name | Atulya Bharat Run.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="meta_description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Meta Description</FormLabel>
                <FormControl>
                  <Textarea
                    rows={3}
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value || null)}
                    placeholder="Optional — falls back to first ~155 chars of the club description"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="meta_keywords"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Meta Keywords</FormLabel>
                <FormControl>
                  <Input
                    value={((field.value as string[]) ?? []).join(", ")}
                    placeholder="running club, fitness, community"
                    onChange={(e) =>
                      field.onChange(
                        e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      )
                    }
                  />
                </FormControl>
                <FormDescription>Comma-separated.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </Section>

        <Section title="Visibility & Priority">
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="is_public"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <FormLabel>Public</FormLabel>
                    <FormDescription>Shown in /clubs</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} {...field} />
                  </FormControl>
                  <FormDescription>Higher shows first.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </Section>

        <div className="flex justify-end">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );

  // helper components below close over `form`
  function TextField({
    name,
    label,
    type = "text",
  }: {
    name: keyof AdminClubInput;
    label: string;
    type?: string;
  }) {
    return (
      <FormField
        control={form.control}
        name={name as any}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <FormControl>
              <Input
                type={type}
                {...field}
                value={(field.value as any) ?? ""}
                onChange={(e) =>
                  field.onChange(type === "number" ? e.target.valueAsNumber : e.target.value)
                }
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-lg border bg-background p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}
