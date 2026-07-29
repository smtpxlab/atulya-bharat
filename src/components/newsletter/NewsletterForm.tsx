import { useState, FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { newsletterEmailSchema } from "@/schemas/newsletter.schema";
import { newsletterService } from "@/services/newsletter.service";
import { cn } from "@/lib/utils";

type Variant = "dark" | "light";

interface Props {
  source?: string;
  variant?: Variant;
  className?: string;
  buttonLabel?: string;
  placeholder?: string;
}

export function NewsletterForm({
  source = "footer",
  variant = "light",
  className,
  buttonLabel = "Subscribe",
  placeholder = "you@example.com",
}: Props) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const inputCls =
    variant === "dark"
      ? "bg-white/10 border-white/20 text-white placeholder:text-white/50"
      : "";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const parsed = newsletterEmailSchema.safeParse(email);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please enter a valid email");
      return;
    }
    setSubmitting(true);
    try {
      const result = await newsletterService.subscribe(parsed.data, source);
      if (result.ok) {
        toast.success(result.message);
        setEmail("");
      } else if ("duplicate" in result && result.duplicate) {
        toast.message(result.message);
      } else {
        toast.error(result.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className={cn("space-y-2", className)} noValidate>
      <Input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={placeholder}
        aria-label="Email address"
        disabled={submitting}
        className={cn("min-h-11", inputCls)}
      />
      <Button
        type="submit"
        disabled={submitting}
        className="w-full min-h-11 rounded-full"
      >
        {submitting ? "Subscribing…" : buttonLabel}
      </Button>
    </form>
  );
}
