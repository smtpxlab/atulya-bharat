# Blog content storage

## Decision

Blog post bodies are stored as **HTML** in `blog_posts.content_html`, produced by the Tiptap rich-text editor in the admin form.

## Rationale

- Tiptap's canonical output format is HTML. Round-tripping HTML ↔ Markdown for every save/load adds complexity and silently drops markup that Markdown can't represent (tables with merged cells, inline styles, custom classes, images with attributes).
- The public renderer sanitizes HTML with **DOMPurify** before injection, preventing XSS while preserving Tiptap's output verbatim.
- Existing posts written in Markdown remain in `blog_posts.content_md`. `BlogPost.tsx` prefers `content_html` when present and falls back to `content_md` (rendered via `react-markdown`) for legacy rows.

## Tiptap extensions enabled

`StarterKit`, `Underline`, `Link`, `Image`, `Table`, `TableRow`, `TableHeader`, `TableCell`.

## Image handling

Images inserted via the toolbar are uploaded to the `blog-images` storage bucket through `adminBlogsService.uploadCoverImage`, and the returned public URL is inserted into the editor.

## Migration path

If we ever need Markdown back (e.g. for RSS or static export), convert at read time with `turndown` rather than re-architecting storage.
