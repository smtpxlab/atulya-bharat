import { Helmet } from "react-helmet-async";
import { SEO } from "@/components/SEO";
import { HeroSection } from "@/components/home/HeroSection";
import { VirtualAdventureSeries } from "@/components/home/VirtualAdventureSeries";
import { ClubsWithABR } from "@/components/home/ClubsWithABR";
import { HowItWorks } from "@/components/home/HowItWorks";
import { BlogSection } from "@/components/home/BlogSection";
import { RegisterWithUs } from "@/components/home/RegisterWithUs";
import { HallOfFameSection } from "@/components/home/HallOfFameSection";
import { TestimonialsSection } from "@/components/home/TestimonialsSection";
import { FaqSection } from "@/components/home/FaqSection";
import { usePublicFaqs } from "@/features/faqs/hooks/useFaqs";
import { socialLinks } from "@/config/socialLinks";
import { SITE_URL } from "@/lib/site";

const stripHtml = (html: string) =>
  html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const Index = () => {
  const { data: faqs } = usePublicFaqs();

  const organizationLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Atulya Bharat Run",
    url: SITE_URL,
    sameAs: socialLinks.map((s) => s.href),
  };

  const websiteLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Atulya Bharat Run",
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/challenges?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: SITE_URL + "/",
      },
    ],
  };

  const faqLd = faqs && faqs.length > 0
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: stripHtml(f.answer ?? ""),
          },
        })),
      }
    : null;

  return (
    <>
      <SEO
        title="Atulya Bharat Run — Virtual Running Challenges India"
        description="Virtual running, walking & cycling challenges across India. Join clubs, unlock heritage milestones, and earn rewards with Atulya Bharat Run."
        path="/"
        keywords={[
          "virtual running India",
          "cycling challenges",
          "heritage runs",
          "fitness clubs India",
          "Atulya Bharat Run",
        ]}
      />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(organizationLd)}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(websiteLd)}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbLd)}
        </script>
        {faqLd && (
          <script type="application/ld+json">{JSON.stringify(faqLd)}</script>
        )}
      </Helmet>

      <HeroSection />
      <VirtualAdventureSeries />
      <ClubsWithABR />
      <HowItWorks />
      <BlogSection />
      <RegisterWithUs />
      <HallOfFameSection />
      <TestimonialsSection />
      <FaqSection />
    </>
  );
};

export default Index;
