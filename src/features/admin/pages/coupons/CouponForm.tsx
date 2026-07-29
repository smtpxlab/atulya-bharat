import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { couponSchema, type CouponInput } from "@/schemas/coupon.schema";
import type { CouponFormData } from "@/types/coupon";

type Props = {
  initial?: Partial<CouponFormData>;
  submitting?: boolean;
  submitLabel: string;
  onSubmit: (values: CouponFormData) => void;
  onCancel: () => void;
};

const DEFAULTS: CouponInput = {
  coupon_name: "",
  coupon_type: "fixed",
  coupon_value: 0,
  minimum_order_amount: 0,
  coupon_frequency: 1,
  details: "",
  expires_at: null,
  status: true,
};

export default function CouponForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
  submitLabel,
}: Props) {
  const defaults: CouponInput = {
    ...DEFAULTS,
    ...(initial as Partial<CouponInput>),
    details: initial?.details ?? "",
    expires_at: initial?.expires_at ?? null,
    status: initial?.status ?? true,
  };

  const form = useForm<CouponInput>({
    resolver: zodResolver(couponSchema),
    defaultValues: defaults,
  });

  const handleSubmit = (values: CouponInput) => {
    onSubmit(values as CouponFormData);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="coupon_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Coupon Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter coupon name"
                  {...field}
                  onChange={(e) =>
                    field.onChange(e.target.value.toUpperCase())
                  }
                />
              </FormControl>
              <FormDescription>
                Will be saved in uppercase. Names are unique (case-insensitive).
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="coupon_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Coupon Value In</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={(next) => {
                    field.onChange(next);
                    const current = form.getValues("coupon_value");
                    if (next === "percent" && Number(current) > 100) {
                      form.setValue("coupon_value", 0 as never, {
                        shouldValidate: false,
                      });
                    }
                    // re-run validation against the new type
                    setTimeout(() => form.trigger("coupon_value"), 0);
                  }}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed</SelectItem>
                    <SelectItem value="percent">Percent</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="coupon_value"
            render={({ field }) => {
              const type = form.watch("coupon_type");
              const isPercent = type === "percent";
              return (
                <FormItem>
                  <FormLabel>
                    {isPercent
                      ? "Coupon Value in Percent"
                      : "Coupon Value in Rupees"}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step={isPercent ? "1" : "0.01"}
                      min={isPercent ? 1 : 0.01}
                      max={isPercent ? 100 : undefined}
                      placeholder={
                        isPercent ? "Enter percentage" : "Enter amount in ₹"
                      }
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              );
            }}
          />
        </div>


        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="minimum_order_amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Minimum Order Amount Coupon Applicable On</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
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
            name="coupon_frequency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Coupon Frequency</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormDescription>
                  Maximum number of times this coupon can be used.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

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
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="details"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Details</FormLabel>
              <FormControl>
                <RichTextEditor
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  placeholder="Enter coupon details"
                  onImageUpload={(f) => uploadRichTextImage(f, "coupons")}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />


        <FormField
          control={form.control}
          name="expires_at"
          render={({ field }) => {
            const date = field.value ? new Date(field.value as string) : undefined;
            return (
              <FormItem className="flex flex-col">
                <FormLabel>Coupon Expired</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[260px] justify-start text-left font-normal",
                          !date && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(d) =>
                        field.onChange(d ? d.toISOString() : null)
                      }
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                    {date && (
                      <div className="border-t p-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="w-full"
                          onClick={() => field.onChange(null)}
                        >
                          Clear
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            );
          }}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => form.reset(defaults)}
            disabled={submitting}
          >
            Reset
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
