import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  NOTIFICATION_TEMPLATES,
  type NotificationPreference,
  type NotificationRecord,
  type Paginated,
} from "@c26/contracts";
import { api } from "../../lib/api-client.ts";
import { formatRelative } from "../../lib/format.ts";
import { ErrorBanner, useToast } from "../../components/ui/feedback.tsx";
import { Button, Card, EmptyState, Spinner } from "../../components/ui/primitives.tsx";

/**
 * The notification inbox and preferences (PLAN/12 §8).
 *
 * In-app is an archive, not an interruption, so it can never be switched off.
 * Three event types cannot be muted on any channel; `inspection.needs_revision`
 * is on that list because it is the only notification that DEMANDS an action.
 * If it could be silenced, D-11 comes back in a new shape — an inspection
 * hanging forever because nobody knew it needed fixing.
 */
export function NotificationsPage(): ReactNode {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showPreferences, setShowPreferences] = useState(false);

  const inbox = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get<Paginated<NotificationRecord>>("/api/notifications", { perPage: 50 }),
  });

  const preferences = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () => api.get<NotificationPreference[]>("/api/notifications/preferences"),
    enabled: showPreferences,
  });

  const markAllRead = useMutation({
    mutationFn: () => api.post("/api/notifications/read-all"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      await queryClient.invalidateQueries({ queryKey: ["session"] });
    },
  });

  const updatePreference = useMutation({
    mutationFn: (preference: NotificationPreference) =>
      api.put("/api/notifications/preferences", {
        preferences: [
          {
            eventType: preference.eventType,
            channel: preference.channel,
            enabled: !preference.enabled,
          },
        ],
      }),
    onSuccess: async () => {
      toast.push({ tone: "success", message: "Preferensi notifikasi diperbarui." });
      await queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
    },
  });

  return (
    <div className="space-y-4">
       <div className="flex flex-wrap items-center justify-between gap-2">
         <h1 className="text-lg font-semibold text-body">Notifikasi</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowPreferences((open) => !open)}>
            {showPreferences ? "Tutup Preferensi" : "Preferensi"}
          </Button>
          <Button onClick={() => markAllRead.mutate()} loading={markAllRead.isPending}>
            Tandai semua terbaca
          </Button>
        </div>
      </div>

      {inbox.error !== null ? <ErrorBanner error={inbox.error} /> : null}

      {showPreferences ? (
        <Card title="Preferensi Notifikasi">
           {preferences.data === undefined ? (
             <div className="flex justify-center py-6 text-muted">
               <Spinner className="h-5 w-5" />
             </div>
           ) : (
             <ul className="divide-y divide-line">
              {preferences.data.map((preference) => (
                <li
                  key={`${preference.eventType}-${preference.channel}`}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                   <div className="min-w-0">
                     <p className="text-sm text-body">
                       {NOTIFICATION_TEMPLATES[preference.eventType].title}
                     </p>
                     <p className="text-xs text-muted">
                       {preference.channel === "in_app" ? "Dalam aplikasi" : "Email"}
                       {preference.lockedReason !== null ? ` · ${preference.lockedReason}` : ""}
                     </p>
                   </div>
                   <label className="flex items-center gap-2 text-sm text-body">
                    <input
                      type="checkbox"
                      checked={preference.enabled}
                      disabled={preference.locked}
                      onChange={() => updatePreference.mutate(preference)}
                    />
                    Aktif
                  </label>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

       <Card>
         {inbox.isLoading ? (
           <div className="flex justify-center py-10 text-muted">
             <Spinner className="h-5 w-5" />
           </div>
         ) : inbox.data === undefined || inbox.data.items.length === 0 ? (
           <EmptyState
             title="Belum ada notifikasi"
             description="Kabar tentang pengajuan dan export Anda akan muncul di sini."
           />
         ) : (
           <ul className="divide-y divide-line">
            {inbox.data.items.map((notification) => (
               <li
                 key={notification.id}
                 className={
                   notification.readAt === null
                     ? "border-l-2 border-accent bg-accent-soft/40 py-3 pl-3"
                     : "py-3 pl-3"
                 }
               >
                 <p className="text-sm font-medium text-body">{notification.title}</p>
                 <p className="mt-0.5 text-sm text-muted">{notification.body}</p>
                 <p className="mt-1 text-xs text-muted">
                  {formatRelative(notification.createdAt)}
                  {notification.link !== null ? " · " : ""}
                  {notification.link !== null ? (
                    <Link to={notification.link} className="text-accent-text underline">
                      Buka
                    </Link>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
