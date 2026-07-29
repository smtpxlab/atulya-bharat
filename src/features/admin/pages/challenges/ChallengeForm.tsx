import { useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { CalendarIcon, Plus, Trash2 } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { uploadRichTextImage } from "@/services/richTextImage.service";
import ImageUploader from "@/features/admin/components/ImageUploader";
import {
  CHALLENGE_CATEGORIES,
  CHALLENGE_TYPES,
  challengeFormSchema,
  slugify,
  type ChallengeFormValues,
} from "@/features/challenges/schemas/challenge.schema";

type Props = {
  mode: "create" | "edit";
  initialValues?: Partial<ChallengeFormValues>;
  submitting?: boolean;
  onSubmit: (values: ChallengeFormValues) => void;
};

const emptyTicket = {
  ticket_name: "",
  ticket_price: 0,
  ticket_inclusions: "",
  shipping_cost: 0,
  allow_certificate: false,
};

const defaults: Partial<ChallengeFormValues> = {
  name: "",
  slug: "",
  challenge_type: "Any",
  category: "New",
  tags: [],
  cover_image_url: "",
  about_map_image_url: null,
  creative_image_url: null,
  certificate_image_url: null,
  bib_image_url: null,
  route_map_image_url: null,
  distance: 0,
  max_duration_days: undefined,
  start_at: "",
  end_at: null,
  description: "",
  status: true,
  tickets: [emptyTicket],
  meta_title: null,
  meta_description: null,
  meta_keywords: [],
};

function TagsInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const tags = value ?? [];
  const commit = (raw: string) => {
    const next = raw
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t && !tags.includes(t));
    if (next.length) onChange([...tags, ...next]);
    setDraft("");
  };
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-input bg-background px-3 py-2 min-h-10">
      {tags.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs"
        >
          {t}
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => onChange(tags.filter((x) => x !== t))}
            aria-label={`Remove ${t}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        className="flex-1 min-w-0 sm:min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        placeholder={tags.length === 0 ? "City, Heritage, Corporate, School, Social…" : ""}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            if (draft.trim()) commit(draft);
          } else if (e.key === "Backspace" && !draft && tags.length) {
            onChange(tags.slice(0, -1));
          }
        }}
        onBlur={() => draft.trim() && commit(draft)}
      />
    </div>
  );
}

function DateTimeField({
  value,
  onChange,
  placeholder = "Pick date & time",
}: {
  value: string | null | undefined;
  onChange: (iso: string | null) => void;
  placeholder?: string;
}) {
  const date = value ? new Date(value) : undefined;
  const timeStr = date
    ? `${String(date.getHours()).padStart(2, "0")}:${String(
        date.getMinutes(),
      ).padStart(2, "0")}`
    : "00:00";

  const setDatePart = (d: Date | undefined) => {
    if (!d) {
      onChange(null);
      return;
    }
    const base = date ?? new Date();
    d.setHours(base.getHours(), base.getMinutes(), 0, 0);
    onChange(d.toISOString());
  };

  const setTimePart = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const base = date ?? new Date();
    base.setHours(h || 0, m || 0, 0, 0);
    onChange(base.toISOString());
  };

  return (
    <div className="flex gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "flex-1 justify-start text-left font-normal",
              !date && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "PPP") : <span>{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDatePart}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
      <Input
        type="time"
        value={timeStr}
        onChange={(e) => setTimePart(e.target.value)}
        className="w-32"
        disabled={!date}
      />
    </div>
  );
}

export default function ChallengeForm({
  mode,
  initialValues,
  submitting,
  onSubmit,
}: Props) {
  const navigate = useNavigate();
  const merged = useMemo(
    () => ({ ...defaults, ...initialValues }) as ChallengeFormValues,
    [initialValues],
  );

  const form = useForm<ChallengeFormValues>({
    resolver: zodResolver(challengeFormSchema),
    defaultValues: merged,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "tickets",
  });

  // Auto-derive slug from name (hidden from UI)
  const nameValue = form.watch("name");
  useEffect(() => {
    if (mode === "create") {
      form.setValue("slug", slugify(nameValue || ""), { shouldValidate: false });
    }
  }, [nameValue, mode, form]);

  // Unsaved changes guard
  const isDirty = form.formState.isDirty;
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  const handleReset = () => {
    if (
      isDirty &&
      !window.confirm("Discard unsaved changes?")
    )
      return;
    form.reset(merged);
    
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6 pb-24"
      >
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Challenge Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter challenge name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="challenge_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Challenge Type *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CHALLENGE_TYPES.map((t) => (
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
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Challenge Category *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CHALLENGE_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
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
              name="tags"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Theme (Tags)</FormLabel>
                  <FormControl>
                    <TagsInput
                      value={(field.value as string[]) ?? []}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3 md:col-span-2">
                  <div>
                    <FormLabel>Status</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Active challenges are visible publicly.
                    </p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Images */}
        <Card>
          <CardHeader>
            <CardTitle>Images</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <FormField
              control={form.control}
              name="cover_image_url"
              render={({ field }) => (
                <ImageUploader
                  label="Cover Image"
                  value={field.value}
                  onChange={field.onChange}
                  folder="cover"
                />
              )}
            />
            <FormField
              control={form.control}
              name="about_map_image_url"
              render={({ field }) => (
                <ImageUploader
                  label="About Map Image"
                  value={field.value}
                  onChange={field.onChange}
                  folder="about-map"
                />
              )}
            />
            <FormField
              control={form.control}
              name="creative_image_url"
              render={({ field }) => (
                <ImageUploader
                  label="Creative Image"
                  value={field.value}
                  onChange={field.onChange}
                  folder="creative"
                />
              )}
            />
            <FormField
              control={form.control}
              name="certificate_image_url"
              render={({ field }) => (
                <ImageUploader
                  label="Certificate Image"
                  value={field.value}
                  onChange={field.onChange}
                  folder="certificate"
                />
              )}
            />
            <FormField
              control={form.control}
              name="bib_image_url"
              render={({ field }) => (
                <ImageUploader
                  label="Bib Image"
                  value={field.value}
                  onChange={field.onChange}
                  folder="bib"
                />
              )}
            />
            <FormField
              control={form.control}
              name="route_map_image_url"
              render={({ field }) => (
                <ImageUploader
                  label="Route Map"
                  value={field.value}
                  onChange={field.onChange}
                  folder="route-map"
                />
              )}
            />
          </CardContent>
        </Card>

        {/* Tickets */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Ticket Information</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append(emptyTicket)}
            >
              <Plus className="mr-2 h-4 w-4" /> Add Another Ticket
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((f, idx) => (
              <div key={f.id} className="rounded-lg border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-medium">Ticket #{idx + 1}</h4>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={fields.length === 1}
                    onClick={() => remove(idx)}
                  >
                    <Trash2 className="mr-1 h-4 w-4" /> Delete
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name={`tickets.${idx}.ticket_name`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ticket Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Ticket name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`tickets.${idx}.ticket_price`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ticket Price</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="Fee" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`tickets.${idx}.ticket_inclusions`}
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Ticket Inclusions</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="What's included"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`tickets.${idx}.shipping_cost`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Shipping Cost</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="Fee" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`tickets.${idx}.allow_certificate`}
                    render={({ field }) => (
                      <FormItem className="flex items-end gap-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="mb-1">Allow Certificate</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            ))}
            {form.formState.errors.tickets?.root && (
              <p className="text-sm text-destructive">
                {form.formState.errors.tickets.root.message}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Details */}
        <Card>
          <CardHeader>
            <CardTitle>Challenge Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="distance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Distance (km) *</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="Distance" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="max_duration_days"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Maximum Duration Days</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="Days"
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(e.target.value === "" ? null : Number(e.target.value))
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="start_at"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Date &amp; Time</FormLabel>
                  <DateTimeField
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Start date"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="end_at"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>End Date &amp; Time</FormLabel>
                  <DateTimeField
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="End date"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Description */}
        <Card>
          <CardHeader>
            <CardTitle>Challenge Description</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <RichTextEditor
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      onImageUpload={(f) => uploadRichTextImage(f, "challenges")}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* SEO */}
        <Card>
          <CardHeader>
            <CardTitle>SEO</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
                      placeholder="Optional — falls back to Challenge Name | Atulya Bharat Run"
                    />
                  </FormControl>
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
                      placeholder="Optional — falls back to first ~155 chars of the challenge description"
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
                      placeholder="running, virtual challenge, marathon"
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
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>


        {/* Sticky footer */}
        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:left-[var(--sidebar-width,16rem)]">
          <div className="mx-auto flex max-w-7xl items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => navigate("/admin/challenges")}>
              Cancel
            </Button>
            <Button type="button" variant="ghost" onClick={handleReset} disabled={submitting}>
              Reset
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save Challenge"}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
