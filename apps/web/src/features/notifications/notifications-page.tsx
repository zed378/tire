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
import { Pagination } from "../../components/ui/pagination.tsx";

/**
 * The notification inbox and preferences (PLAN/12 §8).
 *
 * In-app is an archive, not an interruption, so it can never be switched off.
 * Three event types cannot be muted on any channel; `inspection.needs_revision`
 * is on that list because it is the only notification that DEMANDS an action.
 * If it could be silenced, D-11 comes back in a new shape — an inspection
 * hanging forever because nobody knew it needed fixing.
 */
const PER_PAGE = 25;

export function NotificationsPage(): ReactNode {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showPreferences, setShowPreferences] = useState(false);

  const inbox = useQuery({
    queryKey: ["notifications", page],
    queryFn: () =>
      api.get<Paginated<NotificationRecord>>("/api/notifications", { page, perPage: PER_PAGE }),
  });

  const preferences = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () => api.get<NotificationPreference[]>("/api/notifications/preferences"),
    enabled: showPreferences,
  });

  /**
   * Opening a notification is reading it.
   *
   * `POST /api/notifications/read` already existed and nothing on this screen
   * called it — the only way to clear the badge was "tandai semua dibaca",
   * which also clears the ones you have not looked at.
   */
  const markRead = useMutation({
    mutationFn: (ids: number[]) => api.post("/api/notifications/read", { ids }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      await queryClient.invalidateQueries({ queryKey: ["session"] });
    },
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
                    ? "border-l-2 border-accent bg-accent-soft/40"
                    : ""
                }
              >
                {/*
                  The whole row is the link, not a small "Buka" at the end of the
                  timestamp. A notification says something happened somewhere
                  else, so going there is the only thing anyone wants from it —
                  and a person told to click a notification clicks its title.

                  One anchor around everything, so it is one tab stop and one
                  announcement rather than a heading, a body, a date and a link
                  that read as four unrelated things.
                */}
                {notification.link === null ? (
                  <div className="py-3 pl-3">
                    <NotificationBody notification={notification} />
                  </div>
                ) : (
                  <Link
                    to={notification.link}
                    onClick={() => {
                      // Opening it is reading it. Leaving the badge counting an
                      // item the user has just acted on is its own small lie.
                      if (notification.readAt === null) markRead.mutate([notification.id]);
                    }}
                    className="block py-3 pl-3 pr-3 transition-colors hover:bg-surface-sunken focus-visible:bg-surface-sunken"
                  >
                    <NotificationBody notification={notification} />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}

        <Pagination
          page={page}
          totalPages={inbox.data?.totalPages ?? 1}
          totalItems={inbox.data?.total}
          onPageChange={setPage}
          disabled={inbox.isFetching}
        />
      </Card>
    </div>
  );
}

/**
 * A notification's text, drawn the same whether or not it leads anywhere.
 *
 * Extracted only because the row is an anchor when it has a link and a plain
 * `div` when it does not, and an anchor wrapping nothing navigable would be a
 * tab stop that goes nowhere.
 */
function NotificationBody({ notification }: { notification: NotificationRecord }): ReactNode {
  return (
    <>
      <p className="text-sm font-medium text-body">{notification.title}</p>
      <p className="mt-0.5 text-sm text-muted">{notification.body}</p>
      <p className="mt-1 text-xs text-muted">{formatRelative(notification.createdAt)}</p>
    </>
  );
}
