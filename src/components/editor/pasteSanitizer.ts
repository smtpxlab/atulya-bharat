/**
 * Clean HTML pasted from Word, Google Docs, and arbitrary web pages.
 * Strips MS Office cruft, inline styles, fonts, colors, classes, and empty spans.
 */
export function cleanPastedHtml(html: string): string {
  if (!html) return html;
  return (
    html
      // comments incl. Office conditional comments
      .replace(/<!--[\s\S]*?-->/g, "")
      // Word-specific tags
      .replace(/<o:p>[\s\S]*?<\/o:p>/gi, "")
      .replace(/<\/?o:p[^>]*>/gi, "")
      .replace(/<\/?w:[^>]*>/gi, "")
      .replace(/<\/?m:[^>]*>/gi, "")
      // <style>, <meta>, <link>, <script>
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<(meta|link)[^>]*>/gi, "")
      // <font>
      .replace(/<font[^>]*>/gi, "")
      .replace(/<\/font>/gi, "")
      // inline style, class, id, lang, dir attributes
      .replace(/\s(style|class|id|lang|dir|align|width|height|bgcolor|color|face|size)="[^"]*"/gi, "")
      .replace(/\s(style|class|id|lang|dir|align|width|height|bgcolor|color|face|size)='[^']*'/gi, "")
      // mso-* attributes / namespaces
      .replace(/\sxmlns(:[a-z]+)?="[^"]*"/gi, "")
      // empty spans
      .replace(/<span>\s*<\/span>/gi, "")
      .replace(/<span[^>]*>(\s*)<\/span>/gi, "$1")
      // unwrap remaining spans (keep inner text)
      .replace(/<span[^>]*>/gi, "")
      .replace(/<\/span>/gi, "")
      // collapse Word "MsoNormal" empty paragraphs
      .replace(/<p[^>]*>(&nbsp;|\s)*<\/p>/gi, "")
  );
}
