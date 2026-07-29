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
import { Switch } from "@/components/ui/switch";
import {
  notificationSchema,
  type NotificationInput,
} from "@/features/notifications/schemas/notification.schema";
import type { NotificationFormData } from "@/types/notification";

type Props = {
  initial?: Partial<NotificationFormData>;
  submitting?: boolean;
  submitLabel: string;
  onSubmit: (values: NotificationFormData) => void;
  onCancel: () => void;
};

const DEFAULTS: NotificationInput = {
  title: "",
  message: "",
  status: true,
};

export default function NotificationForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
  submitLabel,
}: Props) {
  const form = useForm<NotificationInput>({
    resolver: zodResolver(notificationSchema),
    defaultValues: {
      ...DEFAULTS,
      ...(initial as Partial<NotificationInput>),
      status: initial?.status ?? true,
    },
  });

  const titleValue = form.watch("title") ?? "";
  const messageValue = form.watch("message") ?? "";

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((v) => onSubmit(v as NotificationFormData))}
        className="space-y-6"
      >
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Enter Notification Title</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter notification title"
                  maxLength={150}
                  {...field}
                />
              </FormControl>
              <div className="flex justify-between">
                <FormMessage />
                <span className="text-xs text-muted-foreground">
                  {titleValue.length}/150
                </span>
              </div>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Enter Details</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter notification message"
                  rows={5}
                  maxLength={500}
                  {...field}
                />
              </FormControl>
              <div className="flex justify-between">
                <FormMessage />
                <span className="text-xs text-muted-foreground">
                  {messageValue.length}/500
                </span>
              </div>
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
