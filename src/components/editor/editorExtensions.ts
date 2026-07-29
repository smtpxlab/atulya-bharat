import StarterKit from "@tiptap/starter-kit";
import { Underline } from "@tiptap/extension-underline";
import { Link } from "@tiptap/extension-link";
import { Image } from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";

/**
 * Image extension extended with `align` ("left" | "center" | "right") and `caption`.
 * Renders as <figure class="rt-img rt-img--{align}"><img/><figcaption/></figure>
 * so we have a stable, semantic structure on both editor and frontend.
 */
export const RichImage = Image.extend({
  name: "image",
  draggable: true,
  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: "center",
        parseHTML: (el: HTMLElement) =>
          el.closest("figure")?.getAttribute("data-align") ||
          el.getAttribute("data-align") ||
          "center",
        renderHTML: () => ({}),
      },
      caption: {
        default: "",
        parseHTML: (el: HTMLElement) =>
          el.closest("figure")?.querySelector("figcaption")?.textContent ||
          el.getAttribute("data-caption") ||
          "",
        renderHTML: () => ({}),
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: "figure[data-rt-image]",
        getAttrs: (el) => {
          const img = (el as HTMLElement).querySelector("img");
          if (!img) return false;
          return {
            src: img.getAttribute("src"),
            alt: img.getAttribute("alt") || null,
            title: img.getAttribute("title") || null,
          };
        },
      },
      { tag: "img[src]" },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const { align, caption, ...imgAttrs } = HTMLAttributes as Record<
      string,
      unknown
    >;
    const a = (align as string) || "center";
    const figureAttrs = {
      class: `rt-img rt-img--${a}`,
      "data-rt-image": "",
      "data-align": a,
    };
    const imgPart: [string, Record<string, unknown>] = ["img", imgAttrs];
    if (caption && typeof caption === "string" && caption.trim().length > 0) {
      return ["figure", figureAttrs, imgPart, ["figcaption", {}, caption]];
    }
    return ["figure", figureAttrs, imgPart];
  },
});

export const editorExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3, 4] },
    // We register our own Link (custom rel/target) and Underline below.
    link: false,
    underline: false,
  }),
  Underline,
  Link.configure({
    openOnClick: false,
    autolink: true,
    HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
  }),
  RichImage,
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
];
