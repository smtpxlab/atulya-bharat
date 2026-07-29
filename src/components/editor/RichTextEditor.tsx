import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  List,
  ListOrdered,
  Link as LinkIcon,
  Image as ImageIcon,
  Table as TableIcon,
  Code,
  Quote,
  Minus,
  Undo2,
  Redo2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Captions,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { editorExtensions } from "./editorExtensions";
import { cleanPastedHtml } from "./pasteSanitizer";

type Props = {
  value: string;
  onChange: (html: string) => void;
  onImageUpload?: (file: File) => Promise<string>;
  placeholder?: string;
  className?: string;
};

function Tb({
  onClick,
  active,
  label,
  disabled,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={cn("h-8 px-2", active && "bg-muted")}
    >
      {children}
    </Button>
  );
}

function Toolbar({
  editor,
  onImageUpload,
}: {
  editor: Editor;
  onImageUpload?: Props["onImageUpload"];
}) {
  const promptLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const pickImage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const url = onImageUpload
          ? await onImageUpload(file)
          : window.prompt("Image URL", "https://") || "";
        if (url) {
          editor
            .chain()
            .focus()
            .insertContent({
              type: "image",
              attrs: { src: url, align: "center", caption: "" },
            })
            .run();
        }
      } catch (e) {
        window.alert((e as Error).message);
      }
    };
    input.click();
  };

  const imageActive = editor.isActive("image");
  const setImageAlign = (align: "left" | "center" | "right") =>
    editor.chain().focus().updateAttributes("image", { align }).run();

  const editCaption = () => {
    const current = (editor.getAttributes("image").caption as string) ?? "";
    const next = window.prompt("Image caption", current);
    if (next === null) return;
    editor.chain().focus().updateAttributes("image", { caption: next }).run();
  };

  return (
    <div className="flex flex-wrap gap-1 border-b bg-muted/30 p-1">
      <Tb
        label="Undo"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
      >
        <Undo2 className="h-4 w-4" />
      </Tb>
      <Tb
        label="Redo"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
      >
        <Redo2 className="h-4 w-4" />
      </Tb>
      <span className="mx-1 w-px self-stretch bg-border" />
      <Tb
        label="H1"
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 className="h-4 w-4" />
      </Tb>
      <Tb
        label="H2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="h-4 w-4" />
      </Tb>
      <Tb
        label="H3"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="h-4 w-4" />
      </Tb>
      <Tb
        label="H4"
        active={editor.isActive("heading", { level: 4 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
      >
        <Heading4 className="h-4 w-4" />
      </Tb>
      <span className="mx-1 w-px self-stretch bg-border" />
      <Tb
        label="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-4 w-4" />
      </Tb>
      <Tb
        label="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-4 w-4" />
      </Tb>
      <Tb
        label="Underline"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="h-4 w-4" />
      </Tb>
      <span className="mx-1 w-px self-stretch bg-border" />
      <Tb
        label="Bullet list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-4 w-4" />
      </Tb>
      <Tb
        label="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-4 w-4" />
      </Tb>
      <Tb
        label="Quote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="h-4 w-4" />
      </Tb>
      <Tb
        label="Code block"
        active={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <Code className="h-4 w-4" />
      </Tb>
      <Tb
        label="Horizontal rule"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus className="h-4 w-4" />
      </Tb>
      <span className="mx-1 w-px self-stretch bg-border" />
      <Tb label="Link" active={editor.isActive("link")} onClick={promptLink}>
        <LinkIcon className="h-4 w-4" />
      </Tb>
      <Tb label="Image" onClick={pickImage}>
        <ImageIcon className="h-4 w-4" />
      </Tb>
      <Tb
        label="Table"
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run()
        }
      >
        <TableIcon className="h-4 w-4" />
      </Tb>
      {imageActive && (
        <>
          <span className="mx-1 w-px self-stretch bg-border" />
          <Tb
            label="Align left"
            active={editor.getAttributes("image").align === "left"}
            onClick={() => setImageAlign("left")}
          >
            <AlignLeft className="h-4 w-4" />
          </Tb>
          <Tb
            label="Align center"
            active={editor.getAttributes("image").align === "center"}
            onClick={() => setImageAlign("center")}
          >
            <AlignCenter className="h-4 w-4" />
          </Tb>
          <Tb
            label="Align right"
            active={editor.getAttributes("image").align === "right"}
            onClick={() => setImageAlign("right")}
          >
            <AlignRight className="h-4 w-4" />
          </Tb>
          <Tb label="Edit caption" onClick={editCaption}>
            <Captions className="h-4 w-4" />
          </Tb>
        </>
      )}
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
  onImageUpload,
  placeholder,
  className,
}: Props) {
  const editor = useEditor({
    extensions: editorExtensions,
    content: value || "<p></p>",
    editorProps: {
      attributes: {
        class: "rt-content prose-sm sm:prose max-w-none",
        "data-placeholder": placeholder ?? "",
      },
      transformPastedHTML: (html) => cleanPastedHtml(html),
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Sync external value changes (e.g. async load of form defaults)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value && value !== current) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className={cn("rounded-md border bg-background", className)}>
      <Toolbar editor={editor} onImageUpload={onImageUpload} />
      <EditorContent editor={editor} />
    </div>
  );
}

export default RichTextEditor;
