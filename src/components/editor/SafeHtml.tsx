import DOMPurify from "dompurify";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

type Props = {
  html: string | null | undefined;
  className?: string;
};

/**
 * Single trusted renderer for rich-text HTML.
 * Wraps content in `.rt-content` so the shared stylesheet applies.
 */
export const SafeHtml = ({ html, className }: Props) => {
  const sanitized = useMemo(() => {
    if (!html) return "";
    return DOMPurify.sanitize(html, {
      ADD_ATTR: ["target", "rel", "data-align", "data-rt-image"],
      ADD_TAGS: ["figure", "figcaption"],
      FORBID_TAGS: ["script", "style", "iframe", "object", "embed"],
      FORBID_ATTR: ["onerror", "onclick", "onload", "onmouseover"],
    });
  }, [html]);

  if (!sanitized) return null;
  return (
    <div
      className={cn("rt-content", className)}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
};

export default SafeHtml;
