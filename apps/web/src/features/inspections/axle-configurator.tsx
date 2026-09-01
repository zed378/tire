import { useMemo, type ReactNode } from "react";
import {
  AXLE_TYPE_LABELS,
  AXLE_COUNTS_ALLOWING_FREE_ROLLING,
  derivePositions,
  SUPPORTED_AXLE_COUNTS,
  TIRE_MOUNTING_LABELS,
  totalTires,
  validateAxleConfiguration,
  type AxleConfig,
  type AxleType,
  type TireMounting,
} from "@c26/contracts";
import { Field, Select } from "../../components/ui/primitives.tsx";
import { Banner } from "../../components/ui/feedback.tsx";

/**
 * The axle configuration editor.
 *
 * It calls the SAME engine the server calls, imported from `@c26/contracts`
 * (PLAN/01 §4.4). That is what makes drift between client and server validation
 * structurally impossible rather than merely discouraged — and it is why the
 * engine lives in the shared package rather than only on the server: PLAN/06 §2
 * needs these photo slots generated on the device, offline, before anything can
 * be uploaded.
 *
 * The server still decides (V-06). Every write recomputes from the configuration
 * rather than trusting a tire count that arrived over the wire.
 *
 * D-04 is what this screen exists to prevent. In the legacy system, selecting
 * 6 axles and then detailing 1 + 1 + 1 was accepted in silence and produced ten
 * tire slots that were simply wrong — with no error, no log, and nothing to
 * notice until months of data had been collected on top of it.
 */

export interface AxleConfiguratorProps {
  axleCount: number;
  configs: AxleConfig[];
  onChange: (next: { axleCount: number; configs: AxleConfig[] }) => void;
  disabled?: boolean;
}

const EDITABLE_TYPES: AxleType[] = ["steer", "drive", "free_rolling"];

function configFor(configs: AxleConfig[], axleType: AxleType): AxleConfig {
  return (
    configs.find((config) => config.axleType === axleType) ?? {
      axleType,
      axleCount: 0,
      mounting: "single",
    }
  );
}

export function AxleConfigurator({
  axleCount,
  configs,
  onChange,
  disabled = false,
}: AxleConfiguratorProps): ReactNode {
  const errors = useMemo(
    () => validateAxleConfiguration({ axleCount, configs }),
    [axleCount, configs],
  );

  const positions = useMemo(
    () => (errors.length === 0 ? derivePositions(configs) : []),
    [configs, errors],
  );

  const declaredSum = configs.reduce((sum, config) => sum + config.axleCount, 0);
  const freeRollingAllowed = AXLE_COUNTS_ALLOWING_FREE_ROLLING.includes(axleCount);

  const update = (axleType: AxleType, patch: Partial<AxleConfig>): void => {
    const next = EDITABLE_TYPES.map((type) => {
      const current = configFor(configs, type);
      return type === axleType ? { ...current, ...patch } : current;
    }).filter((config) => config.axleCount > 0);

    onChange({ axleCount, configs: next });
  };

  return (
    <div className="space-y-4">
      <Field label="Jumlah Poros" htmlFor="axleCount" required>
        <Select
          id="axleCount"
          value={axleCount}
          disabled={disabled}
          onChange={(event) => onChange({ axleCount: Number(event.target.value), configs })}
        >
          {SUPPORTED_AXLE_COUNTS.map((count) => (
            <option key={count} value={count}>
              {count} Poros
            </option>
          ))}
        </Select>
      </Field>

      <div className="space-y-3 rounded-md border border-slate-200 p-3">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium text-slate-700">Rincian Poros</p>
          {/* The running total, shown before submission rather than after
              rejection. This is the number D-04 let drift unnoticed. */}
          <p
            className={
              declaredSum === axleCount
                ? "text-sm text-slate-500"
                : "text-sm font-medium text-red-700"
            }
          >
            Terinci {declaredSum} dari {axleCount}
          </p>
        </div>

        {EDITABLE_TYPES.map((axleType) => {
          const config = configFor(configs, axleType);
          const isSteer = axleType === "steer";
          const isFreeRolling = axleType === "free_rolling";
          const typeDisabled = disabled || (isFreeRolling && !freeRollingAllowed);

          return (
            <div key={axleType} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr,7rem,9rem]">
              <p className="self-center text-sm text-slate-700">{AXLE_TYPE_LABELS[axleType]}</p>

              <Select
                aria-label={`Jumlah ${AXLE_TYPE_LABELS[axleType]}`}
                value={config.axleCount}
                disabled={typeDisabled}
                onChange={(event) => update(axleType, { axleCount: Number(event.target.value) })}
              >
                {[0, 1, 2, 3, 4, 5].map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </Select>

              <Select
                aria-label={`Tipe ban ${AXLE_TYPE_LABELS[axleType]}`}
                value={config.mounting}
                // V-02: a steer axle is always single, so the control does not
                // offer a choice that would only be rejected later.
                disabled={typeDisabled || isSteer || config.axleCount === 0}
                onChange={(event) =>
                  update(axleType, { mounting: event.target.value as TireMounting })
                }
              >
                {(isSteer ? (["single"] as const) : (["single", "double"] as const)).map(
                  (mounting) => (
                    <option key={mounting} value={mounting}>
                      {TIRE_MOUNTING_LABELS[mounting]}
                    </option>
                  ),
                )}
              </Select>
            </div>
          );
        })}

        {!freeRollingAllowed ? (
          <p className="text-xs text-slate-500">
            Poros Free Rolling hanya tersedia untuk kendaraan{" "}
            {AXLE_COUNTS_ALLOWING_FREE_ROLLING.join(" atau ")} poros.
          </p>
        ) : null}
      </div>

      {errors.length > 0 ? (
        <Banner tone="error" title="Konfigurasi poros belum konsisten">
          <ul className="list-inside list-disc space-y-1">
            {errors.map((error) => (
              <li key={`${error.field}-${error.message}`}>{error.message}</li>
            ))}
          </ul>
        </Banner>
      ) : (
        <div className="rounded-md border border-green-200 bg-green-50 p-3">
          <p className="text-sm font-medium text-green-900">
            Total {totalTires(configs)} ban pada {positions.length} posisi
          </p>
          {/* The derived names, shown before submission. These same strings
              become the photo slots, the specification cards, and the storage
              keys — one source, three consumers (PLAN/03 §1). */}
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {positions.map((position) => (
              <li
                key={position.positionCode}
                className="rounded border border-green-300 bg-white px-2 py-0.5 text-xs text-green-900"
                title={position.positionCode}
              >
                {position.positionLabel}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-green-800">
            Jumlah dan nama posisi ini diturunkan sistem dari konfigurasi poros — tidak diketik
            manual, dan dipakai sama persis untuk slot foto, kartu spesifikasi, dan penyimpanan.
          </p>
        </div>
      )}
    </div>
  );
}
