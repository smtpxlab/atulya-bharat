import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { SafeHtml } from "@/components/SafeHtml";
import { toast } from "sonner";
import type { MilestoneRow } from "@/services/registration-detail.service";

type Props = {
  open: boolean;
  onClose: () => void;
  milestone: MilestoneRow;
};

export function PostcardModal({ open, onClose, milestone }: Props) {
  const handleDownload = async () => {
    if (!milestone.postcard_url) return;
    try {
      const res = await fetch(milestone.postcard_url, { mode: "cors" });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${milestone.spot_name.replace(/\s+/g, "-")}-postcard.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error("Could not download postcard");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-navy">{milestone.spot_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {milestone.postcard_url && (
            <img src={milestone.postcard_url} alt={milestone.spot_name} className="w-full rounded-xl" />
          )}
          {milestone.description && (
            <div className="prose prose-sm max-w-none text-foreground">
              <SafeHtml html={milestone.description} />
            </div>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button onClick={handleDownload} disabled={!milestone.postcard_url}>
              <Download className="mr-2 h-4 w-4" /> Download Postcard
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
