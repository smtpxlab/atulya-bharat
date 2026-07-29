import { Button } from "@/components/ui/button";
import { Copy, Facebook, MessageCircle, Twitter } from "lucide-react";
import { toast } from "sonner";

type Props = {
  url?: string;
  title: string;
};

export const ShareBar = ({ url, title }: Props) => {
  const shareUrl =
    url ?? (typeof window !== "undefined" ? window.location.href : "");
  const text = `Check out ${title} on Atulya Bharat Run`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline" className="rounded-full">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(text + " " + shareUrl)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
        </a>
      </Button>
      <Button asChild variant="outline" className="rounded-full">
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Facebook className="mr-2 h-4 w-4" /> Facebook
        </a>
      </Button>
      <Button asChild variant="outline" className="rounded-full">
        <a
          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Twitter className="mr-2 h-4 w-4" /> X
        </a>
      </Button>
      <Button variant="outline" className="rounded-full" onClick={copy}>
        <Copy className="mr-2 h-4 w-4" /> Copy Link
      </Button>
    </div>
  );
};
