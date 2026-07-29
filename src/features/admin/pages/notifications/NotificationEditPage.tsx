import { useNavigate, useParams } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import {
  useNotification,
  useUpdateNotification,
} from "../../hooks/useAdminNotifications";
import NotificationForm from "./NotificationForm";
import type { NotificationFormData } from "@/types/notification";
import { Skeleton } from "@/components/ui/skeleton";

export default function NotificationEditPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error } = useNotification(id);
  const update = useUpdateNotification(id);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        {(error as Error)?.message ?? "Notification not found"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit Notification</h1>
        <p className="text-sm text-muted-foreground">Update notification details.</p>
      </div>
      <NotificationForm
        initial={{
          title: data.title,
          message: data.message,
          status: data.status,
        }}
        submitLabel="Update"
        submitting={update.isPending}
        onSubmit={(values: NotificationFormData) =>
          update.mutate(values, {
            onSuccess: () => {
              toast({ title: "Notification updated" });
              navigate("/admin/notifications");
            },
            onError: (e) =>
              toast({
                title: "Update failed",
                description: (e as Error).message,
                variant: "destructive",
              }),
          })
        }
        onCancel={() => navigate("/admin/notifications")}
      />
    </div>
  );
}
