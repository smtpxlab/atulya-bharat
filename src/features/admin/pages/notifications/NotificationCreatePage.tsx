import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { useCreateNotification } from "../../hooks/useAdminNotifications";
import NotificationForm from "./NotificationForm";
import type { NotificationFormData } from "@/types/notification";

export default function NotificationCreatePage() {
  const navigate = useNavigate();
  const create = useCreateNotification();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Create Global Notification Message
        </h1>
        <p className="text-sm text-muted-foreground">
          Add a new platform-wide notification.
        </p>
      </div>
      <NotificationForm
        submitLabel="Save"
        submitting={create.isPending}
        onSubmit={(values: NotificationFormData) =>
          create.mutate(values, {
            onSuccess: () => {
              toast({ title: "Notification created" });
              navigate("/admin/notifications");
            },
            onError: (e) =>
              toast({
                title: "Create failed",
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
