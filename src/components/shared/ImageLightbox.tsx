import { Dialog, DialogContent } from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  src: string | null;
  alt: string;
};

export const ImageLightbox = ({ open, onOpenChange, src, alt }: Props) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-5xl border-none bg-transparent p-0 shadow-none">
      {src && (
        <img
          src={src}
          alt={alt}
          className="mx-auto max-h-[85vh] w-auto rounded-2xl object-contain"
        />
      )}
    </DialogContent>
  </Dialog>
);
