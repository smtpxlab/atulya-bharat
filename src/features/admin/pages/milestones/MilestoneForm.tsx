import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRef, useState } from "react";
import { Upload, X, Loader2, Music } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { uploadRichTextImage } from "@/services/richTextImage.service";
import { toast } from "@/hooks/use-toast";
import {
  milestoneFormSchema,
  type MilestoneFormSchema,
} from "@/schemas/milestone.schema";
import type { MilestoneFormValues } from "@/types/milestone";
import { useAdminChallenges } from "@/features/admin/hooks/useAdminChallenges";
import {
  uploadMilestoneAudio,
  uploadMilestoneImage,
} from "@/services/challengeMilestone.service";

type Props = {
  initial?: Partial<MilestoneFormValues>;
  submitting?: boolean;
  submitLabel: string;
  lockChallenge?: boolean;
  onSubmit: (values: MilestoneFormValues) => void;
};

export default function MilestoneForm({
  initial,
  onSubmit,
  submitting,
  submitLabel,
  lockChallenge,
}: Props) {
  const challenges = useAdminChallenges({ pageSize: 100, status: "active" });
  const [audioBusy, setAudioBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<MilestoneFormSchema>({
    resolver: zodResolver(milestoneFormSchema),
    defaultValues: {
      challenge_id: initial?.challenge_id ?? "",
      spot_name: initial?.spot_name ?? "",
      distance: initial?.distance ?? 0,
      spot_image_url: initial?.spot_image_url ?? null,
      audio_url: initial?.audio_url ?? null,
      description: initial?.description ?? "",
      status: initial?.status ?? true,
    },
  });

  const handleAudio = async (file: File) => {
    setAudioBusy(true);
    try {
      const url = await uploadMilestoneAudio(file);
      form.setValue("audio_url", url, { shouldDirty: true });
    } catch (e: any) {
      toast({
        title: "Upload failed",
        description: e?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setAudioBusy(false);
    }
  };

  const handleImage = async (file: File) => {
    setImageBusy(true);
    try {
      const url = await uploadMilestoneImage(file);
      form.setValue("spot_image_url", url, { shouldDirty: true });
    } catch (e: any) {
      toast({
        title: "Upload failed",
        description: e?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setImageBusy(false);
    }
  };

  const audioUrl = form.watch("audio_url");
  const imageUrl = form.watch("spot_image_url");

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((v) => onSubmit(v as MilestoneFormValues))}
        className="space-y-6"
      >
        <FormField
          control={form.control}
          name="spot_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Spot Name *</FormLabel>
              <FormControl>
                <Input placeholder="Enter spot name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="challenge_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Choose Challenge *</FormLabel>
                {challenges.isLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Select
                    value={field.value || undefined}
                    onValueChange={field.onChange}
                    disabled={lockChallenge}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a challenge" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(challenges.data?.items ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="distance"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Distance (km) *</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="Distance from start"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Spot Image</label>
            <span className="text-xs text-muted-foreground">JPG, PNG, WEBP · max 5 MB</span>
          </div>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleImage(f);
              e.target.value = "";
            }}
          />
          {imageUrl ? (
            <div className="relative inline-block overflow-hidden rounded-lg border bg-muted">
              <img src={imageUrl} alt="Spot" className="h-40 w-auto object-cover" />
              <div className="absolute right-2 top-2 flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={imageBusy}
                >
                  Replace
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => form.setValue("spot_image_url", null, { shouldDirty: true })}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={imageBusy}
              className="flex h-32 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border text-sm text-muted-foreground hover:border-primary/50 hover:bg-muted/40"
            >
              {imageBusy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" /> Click to upload spot image
                </>
              )}
            </button>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Challenge Audio</label>
            <span className="text-xs text-muted-foreground">MP3, WAV, M4A · max 20 MB</span>
          </div>
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/m4a,.mp3,.wav,.m4a"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleAudio(f);
              e.target.value = "";
            }}
          />
          {audioUrl ? (
            <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
              <Music className="h-5 w-5 text-muted-foreground" />
              <audio src={audioUrl} controls className="h-9 flex-1" />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => form.setValue("audio_url", null, { shouldDirty: true })}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => audioInputRef.current?.click()}
              disabled={audioBusy}
              className="flex h-20 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border text-sm text-muted-foreground hover:border-primary/50 hover:bg-muted/40"
            >
              {audioBusy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" /> Click to upload audio
                </>
              )}
            </button>
          )}
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description *</FormLabel>
              <FormControl>
                <RichTextEditor
                  value={field.value}
                  onChange={field.onChange}
                  onImageUpload={(f) => uploadRichTextImage(f, "milestones")}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <FormLabel className="text-base">Status</FormLabel>
                <p className="text-sm text-muted-foreground">
                  {field.value ? "Enabled" : "Disabled"}
                </p>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex justify-end">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
