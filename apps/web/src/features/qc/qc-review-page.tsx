import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  MIN_QC_NOTES_LENGTH,
  QC_DECISION_LABELS,
  QC_DECISIONS,
  type InspectionDetail,
  type PhotoRecord,
  type QcDecision,
} from "@c26/contracts";
import { api, isApiError } from "../../lib/api-client.ts";
import { formatDateTime } from "../../lib/format.ts";
import { ErrorBanner, StatusBadge, useToast } from "../../components/ui/feedback.tsx";
import { PhotoThumbnail, PhotoViewer } from "../../components/ui/photo-viewer.tsx";
import {
  Button,
  Card,
  Field,
  Spinner,
  Textarea,
} from "../../components/ui/primitives.tsx";

/**
 * Reviewing one inspection (PLAN/03 §7, PLAN/08 F4).
 *
 * The third option is the point of this screen. The legacy system offered Pass
 * or Drop and nothing between them, so a single blurred photograph sank the
 * whole submission and the supplier started again from zero (D-11). "Kembalikan
 * untuk Revisi" keeps the record and asks for a fix.
 *
 * A written reason is mandatory on drop and revision (V-14). Without it D-11 is
 * only half solved: the supplier learns they were rejected but not what to
 * change, and the conversation moves back to WhatsApp.
 */
export function QcReviewPage(): ReactNode {
  const { sn = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [decision, setDecision] = useState<QcDecision | "">("");
  const [notes, setNotes] = useState("");
  const [notesError, setNotesError] = useState<string | undefined>(undefined);
  const [comments, setComments] = useState<Record<number, string>>({});
  const [error, setError] = useState<unknown>(null);
  const [viewingPhotoId, setViewingPhotoId] = useState<number | null>(null);

  const detail = useQuery({
    queryKey: ["inspection", sn],
    queryFn: () => api.get<InspectionDetail>(`/api/inspections/${sn}`),
  });

  const photos = useQuery({
    queryKey: ["inspection-photos", sn],
    queryFn: () => api.get<PhotoRecord[]>(`/api/inspections/${sn}/photos`),
  });

  const decide = useMutation({
    mutationFn: (body: unknown) => api.post(`/api/qc/${sn}/decide`, body),
    onSuccess: async () => {
      toast.push({ tone: "success", message: "Keputusan QC tersimpan." });
      setDecision("");
      setNotes("");
      setComments({});
      setNotesError(undefined);
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["qc-queue"] });
      await queryClient.invalidateQueries({ queryKey: ["qc-stats"] });
      void navigate("/qc");
    },
    onError: (caught) => {
      if (isApiError(caught)) {
        const notesIssue = caught.fieldErrors.find((issue) => issue.field === "notes");
        if (notesIssue !== undefined) {
          setNotesError(notesIssue.message);
          return;
        }
      }
      setError(caught);
    },
  });

  const revert = useMutation({
    mutationFn: (reason: string) => api.post(`/api/qc/${sn}/revert`, { reason }),
    onSuccess: async () => {
      toast.push({ tone: "success", message: "Keputusan QC dibatalkan." });
      setNotes("");
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["inspection", sn] });
    },
    onError: setError,
  });

   if (detail.isLoading) {
     return (
       <div className="flex justify-center py-16 text-muted">
         <Spinner className="h-6 w-6" />
       </div>
     );
   }
  if (detail.error !== null) return <ErrorBanner error={detail.error} />;
  if (detail.data === undefined) return null;

  const inspection = detail.data;
  const photoList = photos.data ?? [];

  const submit = (): void => {
    setError(null);
    setNotesError(undefined);

    if (decision === "") {
      setError(new Error("no decision"));
      return;
    }

    if (decision !== "pass" && notes.trim().length < MIN_QC_NOTES_LENGTH) {
      setNotesError(
        `Alasan wajib diisi, minimal ${MIN_QC_NOTES_LENGTH} karakter, agar supplier tahu apa yang harus diperbaiki.`,
      );
      return;
    }

    decide.mutate({
      decision,
      notes: notes.trim() === "" ? undefined : notes.trim(),
      comments: Object.entries(comments)
        .filter(([, body]) => body.trim() !== "")
        .map(([photoId, body]) => ({ photoId: Number(photoId), body: body.trim() })),
      // Optimistic concurrency: two admins deciding at once must not silently
      // overwrite one another (PLAN/03 §7.2 rule 4).
      expectedStatus: inspection.status,
    });
  };

  return (
    <div className="space-y-4">
       <div className="flex flex-wrap items-start justify-between gap-2">
         <div>
           <h1 className="text-lg font-semibold text-body">{inspection.serialNumber}</h1>
           <p className="text-sm text-muted">
            {inspection.plateDisplay} · {inspection.cityName} · {inspection.totalTires} ban ·{" "}
            dikirim {formatDateTime(inspection.submittedAt)}
          </p>
        </div>
        <StatusBadge status={inspection.status} />
      </div>

      {error !== null ? (
        <ErrorBanner
          error={
            error instanceof Error && error.message === "no decision"
              ? { message: "Pilih keputusan terlebih dahulu." }
              : error
          }
          onDismiss={() => setError(null)}
        />
      ) : null}

       <Card title="Galeri Foto" description="Periksa setiap posisi ban sebelum memutuskan.">
         {photoList.length === 0 ? (
           <p className="text-sm text-muted">Tidak ada foto pada pengajuan ini.</p>
         ) : (
           <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
             {photoList.map((photo, index) => (
               <figure key={photo.id} className="rounded-md border border-line p-2">
                 {/*
                   Clickable, because "foto buram" is the commonest rejection
                   there is and a 160px thumbnail cannot show blur. Deciding from
                   one is guessing.
                 */}
                 <PhotoThumbnail
                   photo={photo}
                   label={photo.tirePositionLabel ?? photo.slot}
                   index={index}
                   total={photoList.length}
                   className="h-40 w-full"
                   onOpen={() => setViewingPhotoId(photo.id)}
                 />
                 <figcaption className="mt-2 text-sm font-medium text-body">
                   {photo.tirePositionLabel ?? photo.slot}
                 </figcaption>
                 <p className="text-xs text-muted">
                  {photo.capturedAt === null
                    ? "Waktu pengambilan tidak tersedia"
                    : `Diambil ${formatDateTime(photo.capturedAt)}`}
                </p>

                {/* Per-photo comments. A supplier told "foto buram" with no
                    indication of which photo is barely better off than one told
                    nothing at all. */}
                <Textarea
                  aria-label={`Komentar untuk ${photo.tirePositionLabel ?? photo.slot}`}
                  rows={2}
                  placeholder="Komentar untuk foto ini (opsional)"
                  className="mt-2 text-sm"
                  value={comments[photo.id] ?? ""}
                  onChange={(event) =>
                    setComments((current) => ({ ...current, [photo.id]: event.target.value }))
                  }
                />
              </figure>
            ))}
          </div>
        )}
      </Card>

      {/*
        No delete here, deliberately. QC judges the evidence; it does not remove
        it. A reviewer who could delete a photograph could quietly change what a
        decision was made on, and the audit trail would show the decision without
        what it rested on.
      */}
      <PhotoViewer
        photos={photoList}
        openId={viewingPhotoId}
        onOpenChange={setViewingPhotoId}
      />

       {inspection.status === "pending_qc" ? (
         <Card title="Keputusan QC">
           <fieldset className="space-y-2">
             <legend className="text-sm font-medium text-body">Pilih keputusan</legend>
             {QC_DECISIONS.map((value) => (
               <label
                 key={value}
                 className="flex cursor-pointer items-start gap-2 rounded-md border border-line p-3 hover:bg-surface-sunken/50"
               >
                 <input
                   type="radio"
                   name="decision"
                   value={value}
                   checked={decision === value}
                   onChange={() => {
                     setDecision(value);
                     setNotesError(undefined);
                   }}
                   className="mt-1"
                 />
                 <span className="text-sm text-body">{QC_DECISION_LABELS[value]}</span>
              </label>
            ))}
          </fieldset>

          <div className="mt-4">
            <Field
              label={decision === "pass" ? "Catatan (opsional)" : "Alasan"}
              htmlFor="qc-notes"
              error={notesError}
              hint={
                decision === "pass"
                  ? undefined
                  : `Minimal ${MIN_QC_NOTES_LENGTH} karakter. Supplier akan membaca teks ini.`
              }
              required={decision !== "pass" && decision !== ""}
            >
              <Textarea
                id="qc-notes"
                rows={4}
                value={notes}
                invalid={notesError !== undefined}
                onChange={(event) => {
                  setNotes(event.target.value);
                  setNotesError(undefined);
                }}
              />
            </Field>
          </div>

          <Button
            className="mt-4"
            loading={decide.isPending}
            loadingText="Menyimpan…"
            disabled={decision === ""}
            onClick={submit}
          >
            Simpan Keputusan
          </Button>
        </Card>
      ) : null}

      {inspection.status === "passed_qc" ? (
        <Card
          title="Batalkan Keputusan"
          description="Hanya mungkin selama spesifikasi ban belum mulai diisi. Pembatalan tercatat sebagai peristiwa tersendiri di riwayat."
        >
          <Field label="Alasan pembatalan" htmlFor="revert-reason" required>
            <Textarea
              id="revert-reason"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </Field>
          <Button
            variant="danger"
            className="mt-3"
            loading={revert.isPending}
            loadingText="Membatalkan…"
            disabled={notes.trim().length < MIN_QC_NOTES_LENGTH}
            onClick={() => revert.mutate(notes.trim())}
          >
            Batalkan Keputusan QC
          </Button>
        </Card>
      ) : null}
    </div>
  );
}
