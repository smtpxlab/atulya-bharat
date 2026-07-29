import { Helmet } from "react-helmet-async";
import { absoluteUrl } from "@/lib/site";

interface SEOProps {
  title: string;
  description?: string;
  image?: string;
  path?: string;
  type?: "website" | "article";
  keywords?: string[];
  noindex?: boolean;
}

export const SEO = ({
  title,
  description,
  image,
  path,
  type = "website",
  keywords,
  noindex,
}: SEOProps) => {
  const pathname =
    path ?? (typeof window !== "undefined" ? window.location.pathname : "/");
  const url = absoluteUrl(pathname);
  const keywordsContent =
    keywords && keywords.length > 0 ? keywords.join(", ") : undefined;
  return (
    <Helmet>
      <title>{title}</title>
      {description && <meta name="description" content={description} />}
      {keywordsContent && <meta name="keywords" content={keywordsContent} />}
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex,nofollow" />}
      <meta property="og:title" content={title} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:site_name" content="Atulya Bharat Run" />
      {description && <meta property="og:description" content={description} />}
      {image && <meta property="og:image" content={image} />}
      <meta name="twitter:card" content={image ? "summary_large_image" : "summary"} />
      <meta name="twitter:title" content={title} />
      {description && <meta name="twitter:description" content={description} />}
      {image && <meta name="twitter:image" content={image} />}
    </Helmet>
  );
};
