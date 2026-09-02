import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import type { MasterDataBundle, TireSpecRecord, TireSpecSheet } from "@c26/contracts";
import { api } from "../../lib/api-client.ts";
import { Banner, ErrorBanner, useToast } from "../../components/ui/feedback.tsx";
import { Button, Card, Field, Input, Select, Spinner } from "../../components/ui/primitives.tsx";

/**
 * Tire specifications per position (PLAN/02 §8.2, PLAN/03 §7.3).
 *
 * The gate is real here. The legacy system filtered its dropdown to Serial
 * Numbers marked Pass QC — a display filter, not enforcement, which a direct
 * request walked straight past. Every write below is refused by the server
 * unless the inspection is `passed_qc`.
 *
 * Partial entry is supported because it is real work practice: an admin fills in
 * what the photographs show and comes back later. Completeness is derived, never
 * stored as a status.
 */
export function TireSpecPage(): ReactNode {
  const { sn = "" } = useParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [rows, setRows] = useState<TireSpecRecord[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [copySource, setCopySource] = useState<number | null>(null);

  const sheet = useQuery({
    queryKey: ["tire-specs", sn],
    queryFn: () => api.get<TireSpecSheet>(`/api/inspections/${sn}/tire-specs`),
  });

  const master = useQuery({
    queryKey: ["masterdata"],
    queryFn: () => api.get<MasterDataBundle>("/api/masterdata"),
    staleTime: 24 * 60 * 60 * 1000,
  });

  useEffect(() => {
    if (sheet.data !== undefined) setRows(sheet.data.specs);
  }, [sheet.data]);

  const save = useMutation({
    mutationFn: () =>
      api.put(`/api/inspections/${sn}/tire-specs`, {
        specs: rows.map((row) => ({
          tirePositionId: row.tirePositionId,
          tireBrandId: row.tireBrandId,
          brandOther: row.brandOther,
          pattern: row.pattern,
          size: row.size,
          plyRating: row.plyRating,
          isRetread: row.isRetread,
        })),
      }),
    onSuccess: async () => {
      toast.push({ tone: "success", message: "Spesifikasi ban tersimpan." });
      await queryClient.invalidateQueries({ queryKey: ["tire-specs", sn] });
    },
    onError: setError,
  });

  const copy = useMutation({
    mutationFn: (fromTirePositionId: number) =>
      api.post(`/api/inspections/${sn}/tire-specs/copy`, {
        fromTirePositionId,
        toTirePositionIds: rows
          .map((row) => row.tirePositionId)
          .filter((id) => id !== fromTirePositionId),
        fields: ["tireBrandId", "brandOther", "pattern", "size", "plyRating", "isRetread"],
      }),
    onSuccess: async () => {
      toast.push({ tone: "success", message: "Spesifikasi disalin ke posisi lain." });
      await queryClient.invalidateQueries({ queryKey: ["tire-specs", sn] });
    },
    onError: setError,
  });

  if (sheet.isLoading) {
    return (
      <div className="flex justify-center py-16 text-muted">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  if (sheet.error !== null) return <ErrorBanner error={sheet.error} />;
  if (sheet.data === undefined) return null;

  const update = (tirePositionId: number, patch: Partial<TireSpecRecord>): void => {
    setRows((current) =>
      current.map((row) => (row.tirePositionId === tirePositionId ? { ...row, ...patch } : row)),
    );
  };

  const filled = rows.filter(
    (row) =>
      row.pattern !== null &&
      row.pattern !== "" &&
      row.size !== null &&
      row.size !== "" &&
      (row.tireBrandId !== null || (row.brandOther !== null && row.brandOther !== "")),
  ).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-body">
          Spesifikasi Ban · {sheet.data.serialNumber}
        </h1>
        <p className="text-sm text-muted">
          {sheet.data.plateDisplay} · terisi {filled} dari {rows.length} posisi
        </p>
      </div>

      {error !== null ? <ErrorBanner error={error} onDismiss={() => setError(null)} /> : null}

      {!sheet.data.editable ? (
        <Banner tone="warning">
          Spesifikasi ban hanya dapat diisi untuk pengajuan berstatus Pass QC. Status saat ini:{" "}
          {sheet.data.status}.
        </Banner>
      ) : null}

      {/* New in the rewrite. On a 22-position vehicle whose tires are all the
          same model, retyping five fields twenty-two times is the friction that
          stops people filling the form properly at all. */}
      {sheet.data.editable && rows.length > 1 ? (
        <Card title="Salin ke semua posisi">
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Salin dari posisi" htmlFor="copy-source">
              <Select
                id="copy-source"
                value={copySource ?? ""}
                onChange={(event) =>
                  setCopySource(event.target.value === "" ? null : Number(event.target.value))
                }
              >
                <option value="">— Pilih posisi —</option>
                {rows.map((row) => (
                  <option key={row.tirePositionId} value={row.tirePositionId}>
                    {row.positionLabel}
                  </option>
                ))}
              </Select>
            </Field>
            <Button
              variant="secondary"
              disabled={copySource === null}
              loading={copy.isPending}
              loadingText="Menyalin…"
              onClick={() => {
                if (copySource !== null) copy.mutate(copySource);
              }}
            >
              Salin ke {rows.length - 1} posisi lain
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => (
          <Card key={row.tirePositionId}>
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-body">{row.positionLabel}</p>
                <p className="font-mono text-xs text-subtle">{row.positionCode}</p>
              </div>
              {row.isComplete ? (
                <span className="rounded-full border border-success-line bg-success-soft px-2 py-0.5 text-xs text-success-text">
                  Lengkap
                </span>
              ) : null}
            </div>

            <div className="space-y-3">
              <Field label="Merk Ban" htmlFor={`brand-${row.tirePositionId}`}>
                <Select
                  id={`brand-${row.tirePositionId}`}
                  value={row.tireBrandId ?? ""}
                  disabled={!sheet.data.editable}
                  onChange={(event) =>
                    update(row.tirePositionId, {
                      tireBrandId: event.target.value === "" ? null : Number(event.target.value),
                    })
                  }
                >
                  <option value="">— Pilih merk —</option>
                  {(master.data?.tireBrands ?? []).map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="Merk lain"
                htmlFor={`brand-other-${row.tirePositionId}`}
                hint="Isi hanya bila merk tidak ada di daftar. Admin akan meninjaunya untuk ditambahkan ke master data."
              >
                <Input
                  id={`brand-other-${row.tirePositionId}`}
                  value={row.brandOther ?? ""}
                  disabled={!sheet.data.editable}
                  onChange={(event) =>
                    update(row.tirePositionId, {
                      brandOther: event.target.value === "" ? null : event.target.value,
                    })
                  }
                />
              </Field>

              <Field label="Pattern" htmlFor={`pattern-${row.tirePositionId}`}>
                <Input
                  id={`pattern-${row.tirePositionId}`}
                  value={row.pattern ?? ""}
                  disabled={!sheet.data.editable}
                  onChange={(event) =>
                    update(row.tirePositionId, {
                      pattern: event.target.value === "" ? null : event.target.value,
                    })
                  }
                />
              </Field>

              <Field
                label="Ukuran"
                htmlFor={`size-${row.tirePositionId}`}
                hint="Contoh: 1000-20 atau 295/80R22.5"
              >
                <Input
                  id={`size-${row.tirePositionId}`}
                  value={row.size ?? ""}
                  disabled={!sheet.data.editable}
                  onChange={(event) =>
                    update(row.tirePositionId, {
                      size: event.target.value === "" ? null : event.target.value,
                    })
                  }
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="PR" htmlFor={`ply-${row.tirePositionId}`}>
                  <Input
                    id={`ply-${row.tirePositionId}`}
                    value={row.plyRating ?? ""}
                    disabled={!sheet.data.editable}
                    onChange={(event) =>
                      update(row.tirePositionId, {
                        plyRating: event.target.value === "" ? null : event.target.value,
                      })
                    }
                  />
                </Field>

                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-sm text-body">
                    <input
                      type="checkbox"
                      checked={row.isRetread}
                      disabled={!sheet.data.editable}
                      onChange={(event) =>
                        update(row.tirePositionId, { isRetread: event.target.checked })
                      }
                    />
                    Vulkanisir
                  </label>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {sheet.data.editable ? (
        <div className="sticky bottom-0 border-t border-line bg-surface/95 py-3 safe-bottom">
          <Button
            className="w-full"
            loading={save.isPending}
            loadingText="Menyimpan…"
            onClick={() => save.mutate()}
          >
            Simpan Spesifikasi
          </Button>
        </div>
      ) : null}
    </div>
  );
}
