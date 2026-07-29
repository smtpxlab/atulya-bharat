import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SafeHtml } from "@/components/editor/SafeHtml";
import { usePublicFaqs } from "@/features/faqs/hooks/useFaqs";
import { Skeleton } from "@/components/ui/skeleton";

export function FaqSection() {
  const { data, isLoading } = usePublicFaqs();
  const items = data ?? [];

  if (!isLoading && items.length === 0) return null;

  return (
    <section className="abr-container py-16">
      <div className="mx-auto max-w-3xl text-center mb-10">
        <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
          Help center
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">
          Frequently Asked Questions
        </h2>
        <p className="mt-3 text-muted-foreground">
          Everything you need to know about Atulya Bharat Run.
        </p>
      </div>

      <div className="mx-auto max-w-3xl">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-2xl" />
            ))}
          </div>
        ) : (
          <Accordion type="single" collapsible className="space-y-3">
            {items.map((f) => (
              <AccordionItem
                key={f.id}
                value={f.id}
                className="rounded-2xl border bg-card px-5 shadow-sm data-[state=open]:shadow-md transition-shadow"
              >
                <AccordionTrigger className="text-left text-base font-medium hover:no-underline py-5">
                  {f.question}
                </AccordionTrigger>
                <AccordionContent className="pb-5">
                  <SafeHtml html={f.answer} className="rich-content" />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>
    </section>
  );
}

export default FaqSection;
