import { Link } from "react-router-dom";
import { Award, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onClose: () => void;
  challengeName: string;
  distanceKm: number;
  registrationId: string;
};

export const ChallengeCompletionScreen = ({
  open,
  onClose,
  challengeName,
  distanceKm,
  registrationId,
}: Props) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-4"
      style={{ backgroundColor: "rgba(10, 15, 30, 0.95)" }}
      role="dialog"
      aria-modal="true"
    >
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="absolute h-48 w-48 rounded-full border-2"
            style={{
              borderColor: i % 2 ? "hsl(var(--secondary))" : "hsl(var(--primary))",
              animation: `abr-ring 3s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.6}s infinite`,
              opacity: 0,
            }}
          />
        ))}
      </div>

      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>

      <div
        className="relative z-10 w-full max-w-md animate-fade-in"
        style={{ animation: "abr-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both" }}
      >
        <div className="rounded-3xl bg-[#0a0f1e] p-8 text-center text-white">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary">
            <Award className="h-10 w-10 text-white" />
          </div>
          <p className="mt-4 text-3xl">🎉</p>
          <h2 className="mt-2 font-display text-3xl leading-tight text-white">Congratulations!</h2>
          <p className="mt-3 text-sm text-white/80">You have successfully completed</p>
          <p className="mt-1 font-display text-2xl text-secondary">
            {distanceKm} KM Challenge
          </p>
          <p className="mt-1 text-sm text-white/70">{challengeName}</p>

          <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-success/15 px-4 py-1.5 text-xs font-semibold text-success">
            <Award className="h-3.5 w-3.5" /> Certificate Unlocked
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <Button asChild className="w-full" onClick={onClose}>
              <Link to={`/my-challenges/${registrationId}#section-certificate`}>
                <Download className="mr-2 h-4 w-4" /> Download Certificate
              </Link>
            </Button>
            <Button onClick={onClose} variant="outline" className="w-full border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white">
              Close
            </Button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes abr-ring {
          0% { transform: scale(0.6); opacity: 0.7; }
          100% { transform: scale(2.6); opacity: 0; }
        }
        @keyframes abr-pop {
          0% { transform: scale(0.85); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
