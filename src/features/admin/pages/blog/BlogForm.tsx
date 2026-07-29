import { useState } from "react";
import { useForm } from "react-hook-form";
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
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload, X } from "lucide-react";
import {
  adminBlogInputSchema,
  type AdminBlogInput,
} from "@/schemas/blog.schema";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { uploadRichTextImage } from "@/services/richTextImage.service";
import { adminBlogsService } from "@/features/admin/services/blog.admin.service";
import { toast } from "@/hooks/use-toast";

type Props = {
  initial?: Partial<AdminBlogInput>;
  submitting?: boolean;
  onSubmit: (values: AdminBlogInput) => void;
  onCancel?: () => void;
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

export default function BlogForm({ initial, onSubmit, submitting, onCancel }: Props) {
  const form = useForm<AdminBlogInput>({
    resolver: zodResolver(adminBlogInputSchema),
    defaultValues: {
      title: "",
      slug: "",
      excerpt: "",
      content_html: "",
      cover_image_url: null,
      author: "",
      tags: [],
      status: "draft",
      meta_title: "",
      meta_description: "",
      meta_keywords: [],
      ...initial,
    },
  });

  const [uploading, setUploading] = useState(false);

  const uploadImage = (file: File): Promise<string> =>
    uploadRichTextImage(file, "blog");

  const handleCoverPick = async (file: File) => {
    setUploading(true);
    try {
      const url = await adminBlogsService.uploadCoverImage(file);
      form.setValue("cover_image_url", url, { shouldDirty: true });
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

  const submitWithStatus = (status: "draft" | "published") =>
    form.handleSubmit((values) => onSubmit({ ...values, status }));

  const coverUrl = form.watch("cover_image_url");

  return (
    <Form {...form}>
      <form className="space-y-8">
        {/* Content section */}
        <section className="space-y-4 rounded-md border bg-card p-5">
          <h2 className="text-lg font-semibold">Content</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title *</FormLabel>
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
                  <FormDescription>URL: /blog/{field.value || "your-slug"}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="cover_image_url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Featured image *</FormLabel>
                <div className="flex items-start gap-4">
                  {coverUrl ? (
                    <div className="relative">
                      <img
                        src={coverUrl}
                        alt="cover preview"
                        className="h-28 w-44 rounded-md border object-cover"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="absolute -right-2 -top-2 h-6 w-6"
                        onClick={() => form.setValue("cover_image_url", null, { shouldDirty: true })}
                        aria-label="Remove image"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex h-28 w-44 items-center justify-center rounded-md border border-dashed bg-muted/40 text-xs text-muted-foreground">
                      No image
                    </div>
                  )}
                  <div className="space-y-2">
                    <input
                      id="cover-file"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleCoverPick(file);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploading}
                      onClick={() => document.getElementById("cover-file")?.click()}
                    >
                      {uploading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      {coverUrl ? "Replace image" : "Upload image"}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      PNG, JPG, or WebP. Stored in Lovable Cloud.
                    </p>
                  </div>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="excerpt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Excerpt</FormLabel>
                <FormControl>
                  <Textarea rows={3} {...field} value={field.value ?? ""} />
                </FormControl>
                <FormDescription>Short summary shown on listings.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="author"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Author display name</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} placeholder="ABR Team" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="tags"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tags</FormLabel>
                <FormControl>
                  <Input
                    value={(field.value ?? []).join(", ")}
                    placeholder="running, tips, community"
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

          <FormField
            control={form.control}
            name="content_html"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description *</FormLabel>
                <FormControl>
                  <RichTextEditor
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onImageUpload={uploadImage}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        {/* SEO section */}
        <section className="space-y-4 rounded-md border bg-card p-5">
          <h2 className="text-lg font-semibold">SEO</h2>
          <FormField
            control={form.control}
            name="meta_title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Meta title</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} />
                </FormControl>
                <FormDescription>Falls back to Title.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="meta_keywords"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Meta keywords</FormLabel>
                <FormControl>
                  <Input
                    value={(field.value ?? []).join(", ")}
                    placeholder="running, india, marathon"
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
          <FormField
            control={form.control}
            name="meta_description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Meta description</FormLabel>
                <FormControl>
                  <Textarea rows={3} {...field} value={field.value ?? ""} />
                </FormControl>
                <FormDescription>Falls back to Excerpt.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        {/* Publishing section */}
        <section className="space-y-4 rounded-md border bg-card p-5">
          <h2 className="text-lg font-semibold">Publishing</h2>
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        <div className="flex flex-wrap justify-end gap-2">
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={submitWithStatus("draft")}
          >
            Save Draft
          </Button>
          <Button type="button" disabled={submitting} onClick={submitWithStatus("published")}>
            {submitting ? "Saving…" : "Publish"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
