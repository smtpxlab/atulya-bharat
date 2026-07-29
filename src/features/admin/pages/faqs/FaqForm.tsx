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
import { Switch } from "@/components/ui/switch";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { uploadRichTextImage } from "@/services/richTextImage.service";
import { faqSchema, type FaqInput } from "@/schemas/faq.schema";
import type { FaqFormData } from "@/types/faq";

type Props = {
  initial?: Partial<FaqFormData>;
  submitting?: boolean;
  submitLabel: string;
  onSubmit: (values: FaqFormData) => void;
  onCancel: () => void;
};

const DEFAULTS: FaqInput = {
  question: "",
  answer: "",
  status: true,
  sort_order: 0,
};

export default function FaqForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
  submitLabel,
}: Props) {
  const form = useForm<FaqInput>({
    resolver: zodResolver(faqSchema),
    defaultValues: {
      ...DEFAULTS,
      ...(initial as Partial<FaqInput>),
      answer: initial?.answer ?? "",
      status: initial?.status ?? true,
      sort_order: initial?.sort_order ?? 0,
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((v) => onSubmit(v as FaqFormData))}
        className="space-y-6"
      >
        <FormField
          control={form.control}
          name="question"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Question</FormLabel>
              <FormControl>
                <Input placeholder="Enter question" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="answer"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Answer</FormLabel>
              <FormControl>
                <RichTextEditor
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  placeholder="Write the answer"
                  onImageUpload={(f) => uploadRichTextImage(f, "faqs")}
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
            <FormItem className="flex items-center justify-between rounded-md border p-4">
              <div>
                <FormLabel className="text-base">Status</FormLabel>
                <FormDescription>
                  {field.value ? "Enable" : "Disable"}
                </FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
