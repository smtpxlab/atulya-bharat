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
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  adminPageInputSchema,
  type AdminPageInput,
} from "@/schemas/page.schema";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { uploadRichTextImage } from "@/services/richTextImage.service";

type Props = {
  initial?: Partial<AdminPageInput>;
  submitting?: boolean;
  onSubmit: (values: AdminPageInput) => void;
  onCancel?: () => void;
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const defaults = (initial?: Partial<AdminPageInput>): AdminPageInput => ({
  title: "",
  slug: "",
  content: "",
  status: "enabled",
  ...initial,
});

export default function PageForm({ initial, onSubmit, submitting, onCancel }: Props) {
  const form = useForm<AdminPageInput>({
    resolver: zodResolver(adminPageInputSchema),
    defaultValues: defaults(initial),
  });

  const submit = form.handleSubmit(onSubmit);

  return (
    <Form {...form}>
      <form className="space-y-6" onSubmit={submit}>
        <section className="space-y-4 rounded-md border bg-card p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Page Title *</FormLabel>
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
                  <FormLabel>Page Slug *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      onChange={(e) => field.onChange(slugify(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>Unique URL identifier.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status *</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="enabled">Enabled</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="content"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Content *</FormLabel>
                <FormControl>
                  <RichTextEditor
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onImageUpload={(f) => uploadRichTextImage(f, "pages")}
                  />
                </FormControl>
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
            onClick={() => form.reset(defaults(initial))}
          >
            Reset
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
