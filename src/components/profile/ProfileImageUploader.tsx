import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { UserAvatar } from "@/components/common/UserAvatar";
import { Button } from "@/components/ui/button";
import { resizeImageToSquareWebp } from "@/lib/image/resizeImage";
import {
  profileImageConstraints,
  removeProfileImage,
  uploadProfileImage,
} from "@/services/profile.service";
import { qk } from "@/lib/queryKeys";

type Props = {
  name?: string | null;
  avatarUrl?: string | null;
};

const invalidateAvatarQueries = (qc: ReturnType<typeof useQueryClient>, userId: string) => {
  qc.invalidateQueries({ queryKey: qk.profile.me(userId) });
  qc.invalidateQueries({ queryKey: ["club-members"] });
  qc.invalidateQueries({ queryKey: ["dashboard"] });
  qc.invalidateQueries({ queryKey: ["leaderboard"] });
  qc.invalidateQueries({ queryKey: ["hall-of-fame"] });
  qc.invalidateQueries({ queryKey: ["clubs"] });
};

export const ProfileImageUploader = ({ name, avatarUrl }: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!user?.id) throw new Error("Not signed in");
      if (!profileImageConstraints.ALLOWED_MIME.has(file.type)) {
        throw new Error("Only JPG, PNG, or WEBP images are allowed.");
      }
      if (file.size > profileImageConstraints.MAX_BYTES) {
        throw new Error("Image must be 5 MB or smaller.");
      }
      const blob = await resizeImageToSquareWebp(file, 512, 0.85);
      return uploadProfileImage(user.id, blob, avatarUrl);
    },
    onSuccess: () => {
      if (user?.id) invalidateAvatarQueries(qc, user.id);
      toast.success("Profile photo updated.");
      setPreview(null);
    },
    onError: (e: Error) => {
      toast.error(e.message || "Could not upload photo.");
      setPreview(null);
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not signed in");
      await removeProfileImage(user.id, avatarUrl);
    },
    onSuccess: () => {
      if (user?.id) invalidateAvatarQueries(qc, user.id);
      toast.success("Profile photo removed.");
    },
    onError: (e: Error) => toast.error(e.message || "Could not remove photo."),
  });

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    upload.mutate(file);
  };

  const busy = upload.isPending || remove.isPending;
  const displayUrl = preview ?? avatarUrl ?? null;

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <UserAvatar name={name} avatarUrl={displayUrl} size="xl" />
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={onPick}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="rounded-full"
        >
          <Camera className="mr-1.5 h-4 w-4" />
          {avatarUrl ? "Replace photo" : "Upload photo"}
        </Button>
        {avatarUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => remove.mutate()}
            disabled={busy}
            className="rounded-full text-destructive hover:text-destructive"
          >
            <Trash2 className="mr-1.5 h-4 w-4" /> Remove
          </Button>
        )}
        <p className="text-xs text-muted-foreground sm:ml-2 sm:self-center">
          JPG, PNG or WEBP. Max 5 MB.
        </p>
      </div>
    </div>
  );
};

export default ProfileImageUploader;
