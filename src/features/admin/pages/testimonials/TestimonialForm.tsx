import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Upload, X } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { uploadRichTextImage } from "@/services/richTextImage.service";
import { testimonialService } from "@/services/testimonial.service";
import { toast } from "@/hooks/use-toast";
import { testimonialSchema, type TestimonialInput } from "@/schemas/testimonial.schema";
import type { TestimonialFormData } from "@/types/testimonial";

type Props = {
  initial?: Partial<TestimonialFormData>;
  submitting?: boolean;
  submitLabel: string;
  onSubmit: (values: TestimonialFormData) => void;
  onCancel: () => void;
};

const DEFAULTS: TestimonialInput = {
  author_name: "",
  image_url: null,
  description: "",
  sort_order: 0,
};

export default function TestimonialForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
  submitLabel,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const form = useForm<TestimonialInput>({
    resolver: zodResolver(testimonialSchema),
    defaultValues: {
      ...DEFAULTS,
      ...(initial as Partial<TestimonialInput>),
      image_url: initial?.image_url ?? null,
      description: initial?.description ?? "",
      sort_order: initial?.sort_order ?? 0,
    },
  });

  const handleImagePick = async (file: File) => {
    setUploading(true);
    try {
      const url = await testimonialService.uploadImage(file);
      form.setValue("image_url", url, { shouldValidate: true, shouldDirty: true });
    } catch (e) {
      toast({
        title: "Upload failed",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((v) => onSubmit(v as TestimonialFormData))}
        className="space-y-6"
      >
        <FormField
          control={form.control}
          name="author_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Author Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter author name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="image_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Image (optional)</FormLabel>
              <FormControl>
                <div className="space-y-3">
                  {field.value ? (
                    <div className="relative inline-block">
                      <img
                        src={field.value}
                        alt="Author"
                        className="h-32 w-32 rounded-full object-cover border"
                      />
                      <button
                        type="button"
                        onClick={() => field.onChange(null)}
                        className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground shadow"
                        aria-label="Remove image"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : null}
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm hover:bg-muted/40">
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {uploading ? "Uploading…" : field.value ? "Replace image" : "Upload image"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleImagePick(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <RichTextEditor
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  placeholder="Write the testimonial"
                  onImageUpload={(f) => uploadRichTextImage(f, "testimonials")}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || uploading}>
            {submitting ? "Saving…" : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
