import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  Handshake,
  Mail,
  MapPin,
  Navigation,
  Phone,
  Users,
} from "lucide-react";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHero } from "@/components/shared/PageHero";
import { submitEnquiry } from "@/services/contact.service";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Invalid email").max(255),
  phone: z.string().trim().max(20).optional().default(""),
  subject: z.string().trim().min(1, "Subject is required").max(150),
  message: z.string().trim().min(1, "Message is required").max(3000),
});


const MAPS_URL =
  "https://www.google.com/maps?q=26.910826,75.797776&z=18";
const MAPS_EMBED =
  "https://www.google.com/maps?q=26.910826,75.797776&z=18&output=embed";

const TRUST = [
  {
    icon: Clock,
    title: "Fast Response",
    body: "Our team typically replies within one business day.",
  },
  {
    icon: Users,
    title: "Community Support",
    body: "Connect with fellow runners, riders, and club leaders.",
  },
  {
    icon: Handshake,
    title: "Partnership Opportunities",
    body: "Brands, clubs, and organisers — let's build something together.",
  },
];

const Contact = () => {
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "", website: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const update = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    try {
      await submitEnquiry({ ...parsed.data, website: form.website });
      setDone(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to send your message. Please try again later.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <>
      <SEO
        title="Contact Us | Atulya Bharat Run"
        description="Have questions about challenges, clubs, partnerships, or registrations? Get in touch with the Atulya Bharat Run team."
      />

      <PageHero
        eyebrow="Contact"
        title="Let's Start Your Journey"
        subtitle="Have questions about challenges, clubs, partnerships, or registrations? We're here to help."
        heightClassName="pt-16 pb-6 md:pt-20 md:pb-8"
      />

      <section className="mx-auto w-full max-w-7xl px-6 md:px-8 pt-4 md:pt-6 pb-12 md:pb-16">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-stretch">
          {/* Form — LEFT */}
          <div className="flex h-full flex-col rounded-3xl border border-border bg-card p-7 shadow-sm md:p-9">
            {done ? (
              <div className="py-10 text-center">
                <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
                <h2 className="mt-4 font-display text-2xl text-navy">Thanks for reaching out!</h2>
                <p className="mt-2 text-muted-foreground">
                  We've received your message and will get back to you soon.
                </p>
                <Button
                  className="mt-6 rounded-full"
                  onClick={() => {
                    setForm({ name: "", email: "", phone: "", subject: "", message: "", website: "" });
                    setDone(false);
                  }}
                >
                  Send another message
                </Button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-5">
                <div>
                  <h2 className="font-display text-xl font-bold text-navy">Send us a message</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Fill in the details below and we'll respond within one business day.
                  </p>
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={form.name}
                      onChange={(e) => update("name", e.target.value)}
                      required
                      maxLength={100}
                      className="mt-1.5 h-11"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => update("email", e.target.value)}
                      required
                      maxLength={255}
                      className="mt-1.5 h-11"
                    />
                  </div>
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <Label htmlFor="phone">Phone Number <span className="text-muted-foreground">(optional)</span></Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={form.phone}
                      onChange={(e) => update("phone", e.target.value)}
                      maxLength={20}
                      className="mt-1.5 h-11"
                    />
                  </div>
                  <div>
                    <Label htmlFor="subject">Subject</Label>
                    <Input
                      id="subject"
                      value={form.subject}
                      onChange={(e) => update("subject", e.target.value)}
                      required
                      maxLength={150}
                      className="mt-1.5 h-11"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    rows={6}
                    value={form.message}
                    onChange={(e) => update("message", e.target.value)}
                    required
                    maxLength={3000}
                    className="mt-1.5"
                  />
                </div>
                {/* Honeypot — must remain empty for real users */}
                <div aria-hidden="true" className="sr-only" style={{ position: "absolute", left: "-10000px", height: 0, width: 0, overflow: "hidden" }}>
                  <label htmlFor="website">Website</label>
                  <input
                    id="website"
                    name="website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={form.website}
                    onChange={(e) => update("website", e.target.value)}
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full rounded-full"
                  disabled={submitting}
                >
                  {submitting ? "Sending..." : "Send Message"}
                </Button>
              </form>
            )}
          </div>

          {/* Get In Touch — RIGHT */}
          <div className="flex h-full flex-col rounded-3xl border border-border bg-card p-7 shadow-sm md:p-9">
            <h2 className="font-display text-xl font-bold text-navy">Get in touch</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Reach us directly through any of the channels below.
            </p>

            <ul className="mt-6 space-y-5">
              <li className="flex items-start gap-4">
                <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Phone className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Phone
                  </p>
                  <a
                    href="tel:+919084501008"
                    className="mt-0.5 block text-base font-medium text-navy hover:text-primary"
                  >
                    +91 9084501008
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Mail className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Email
                  </p>
                  <a
                    href="mailto:info@atulyabharatrun.com"
                    className="mt-0.5 block text-base font-medium text-navy hover:text-primary break-all"
                  >
                    info@atulyabharatrun.com
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <MapPin className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Address
                  </p>
                  <a
                    href={MAPS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 block text-base font-medium text-navy hover:text-primary leading-relaxed"
                  >
                    H-2, Chitranjan Marg,<br />
                    C-Scheme, Jaipur – 302001,<br />
                    Rajasthan, India
                  </a>
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Map — full-width below both cards */}
        <div className="mt-8 md:mt-10">
          <div className="w-full overflow-hidden rounded-3xl border border-border shadow-sm">
            <iframe
              title="Atulya Bharat Run office location"
              src={MAPS_EMBED}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="block w-full border-0"
              style={{ height: "400px" }}
              allowFullScreen
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Button asChild variant="outline" className="rounded-full">
              <a href={MAPS_URL} target="_blank" rel="noopener noreferrer">
                <Navigation className="mr-2 h-4 w-4" />
                Get Directions
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="bg-muted/40 py-12 md:py-16">
        <div className="mx-auto w-full max-w-7xl px-6 md:px-8">
          <div className="mx-auto max-w-[55ch] text-center">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-navy">
              Why people love working with us
            </h2>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {TRUST.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-3xl border border-border bg-card p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold text-navy">{title}</h3>
                <p className="mt-1.5 text-sm text-foreground/70 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};

export default Contact;
