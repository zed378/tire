import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  createVehicleSchema,
  normalizePlateDisplay,
  SEGMENTS_BY_CATEGORY,
  SUB_SEGMENTS_BY_SEGMENT,
  validateCityInProvince,
  vehicleSearchSchema,
  VEHICLE_CATEGORY_LABELS,
  VEHICLE_CATEGORIES,
  VEHICLE_SEGMENT_LABELS,
  type AxleConfig,
  type CreateVehicleInput,
  type MasterDataBundle,
  type VehicleCategory,
  type VehicleSearchInput,
  type VehicleSegment,
  type VehicleSummary,
} from "@c26/contracts";
import { api } from "../../lib/api-client.ts";
import { applyFieldErrors, hasFieldErrors } from "../../lib/form-errors.ts";
import { formatDate } from "../../lib/format.ts";
import { Banner, ErrorBanner, useToast } from "../../components/ui/feedback.tsx";
import { Button, Card, Field, Input, SearchableSelect, Select } from "../../components/ui/primitives.tsx";
import { AxleConfigurator } from "./axle-configurator.tsx";

/**
 * Starting an inspection (PLAN/11 §6).
 *
 * The flow that separating vehicle from inspection buys: the supplier types a
 * plate, the system looks for a vehicle it already knows, and a repeat
 * inspection skips the whole form. Beyond saving time in a garage, it shrinks
 * D-04's blast radius — a wrong axle configuration is only possible when a
 * vehicle is first registered, not on every visit.
 *
 * A plate match is never applied silently (rule 2). Plates get reassigned to
 * other vehicles, so treating a hit as proof of identity would create a new
 * class of error rather than remove one. The summary card exists so the supplier
 * can say "no, that is not this truck".
 */

type Step = "search" | "confirm" | "form";

const EMPTY_CONFIGS: AxleConfig[] = [
  { axleType: "steer", axleCount: 1, mounting: "single" },
  { axleType: "drive", axleCount: 1, mounting: "double" },
];

export function NewInspectionPage(): ReactNode {
  const navigate = useNavigate();
  const toast = useToast();

  const [step, setStep] = useState<Step>("search");
  const [searchedPlate, setSearchedPlate] = useState("");
  const [matches, setMatches] = useState<VehicleSummary[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleSummary | null>(null);
  const [error, setError] = useState<unknown>(null);

  const master = useQuery({
    queryKey: ["masterdata"],
    queryFn: () => api.get<MasterDataBundle>("/api/masterdata"),
    staleTime: 24 * 60 * 60 * 1000,
  });

  const plateSearch = useForm<VehicleSearchInput>({
    resolver: zodResolver(vehicleSearchSchema),
    defaultValues: { plate: "" },
  });

  const search = useMutation({
    // Matching happens on the normalised key, so whether the supplier types
    // spaces makes no difference (PLAN/11 §6 rule 1).
    mutationFn: (plate: string) =>
      api.get<VehicleSummary[]>("/api/vehicles/search", { plate }),
    onSuccess: (found) => {
      setMatches(found);
      setStep(found.length > 0 ? "confirm" : "form");
    },
    onError: setError,
  });

  const create = useMutation({
    mutationFn: (body: unknown) =>
      api.post<{ serialNumber: string; attachedToExistingVehicle: boolean }>(
        "/api/inspections",
        body,
      ),
    onSuccess: (result) => {
      toast.push({
        tone: "success",
        message: `Pemeriksaan ${result.serialNumber} dibuat. Lanjutkan dengan mengambil foto.`,
      });
      void navigate(`/inspections/${result.serialNumber}`);
    },
    // The vehicle form places field errors under its own fields; only what it
    // cannot place belongs in the page banner (PLAN/05 §5.1).
    onError: (caught) => {
      if (!hasFieldErrors(caught)) setError(caught);
    },
  });

  const resetSearch = (): void => {
    setStep("search");
    setSearchedPlate("");
    plateSearch.reset({ plate: "" });
    setMatches([]);
    setSelectedVehicle(null);
    setError(null);
  };

  const submitSearch = plateSearch.handleSubmit((values) => {
    setError(null);
    const plate = normalizePlateDisplay(values.plate ?? "");
    setSearchedPlate(plate);
    search.mutate(plate);
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-body">Pemeriksaan Baru</h1>
        {step !== "search" ? (
          <Button variant="ghost" size="sm" onClick={resetSearch}>
            ← Cari Ulang
          </Button>
        ) : null}
      </div>

      {error !== null ? <ErrorBanner error={error} onDismiss={() => setError(null)} /> : null}

      {step === "search" ? (
        <Card
          title="Cari kendaraan"
          description="Ketik plat nomor. Spasi dan huruf besar-kecil tidak berpengaruh."
        >
          {/* Too short a plate is a message under the field, not a Cari button
              that quietly refuses to work. */}
          <form noValidate onSubmit={(event) => void submitSearch(event)} className="space-y-3">
            <Field
              label="Plat Nomor"
              htmlFor="plate"
              error={plateSearch.formState.errors.plate?.message}
              required
            >
              <Input
                id="plate"
                autoFocus
                autoCapitalize="characters"
                placeholder="B 1234 ABC"
                invalid={plateSearch.formState.errors.plate !== undefined}
                {...plateSearch.register("plate")}
              />
            </Field>

            <Button type="submit" loading={search.isPending} loadingText="Mencari…">
              Cari
            </Button>
          </form>
        </Card>
      ) : null}

      {step === "confirm" ? (
        <Card
          title="Kendaraan ditemukan"
          description="Pastikan ini kendaraan yang benar sebelum melanjutkan."
        >
          <div className="space-y-3">
            {matches.map((vehicle) => (
              <div key={vehicle.id} className="rounded-md border border-line p-3">
                <p className="font-medium text-body">
                  {vehicle.plateDisplay} · {vehicle.vehicleBrandName ?? "Merk lain"} ·{" "}
                  {vehicle.category}-{VEHICLE_SEGMENT_LABELS[vehicle.segment]} ·{" "}
                  {vehicle.totalTires} Ban
                </p>
                <p className="mt-0.5 text-sm text-muted">
                  {vehicle.cityName}, {vehicle.provinceName} · {vehicle.axleCount} poros ·{" "}
                  {vehicle.subSegment}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {vehicle.lastInspectedAt === null
                    ? "Belum pernah diperiksa."
                    : `Terakhir diperiksa: ${formatDate(vehicle.lastInspectedAt)} (${vehicle.lastInspectionStatus ?? "-"})`}
                  {vehicle.inspectionCount > 0 ? ` · ${vehicle.inspectionCount} pemeriksaan` : ""}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    onClick={() => {
                      setSelectedVehicle(vehicle);
                      setError(null);
                      create.mutate({ vehicleId: vehicle.id });
                    }}
                    loading={create.isPending && selectedVehicle?.id === vehicle.id}
                    loadingText="Membuat…"
                  >
                    Ya, kendaraan ini
                  </Button>
                  <Button variant="secondary" onClick={() => setStep("form")}>
                    Bukan / data berubah
                  </Button>
                  <Button variant="ghost" onClick={resetSearch}>
                    Batal
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {step === "form" && master.data !== undefined ? (
        <NewVehicleForm
          master={master.data}
          initialPlate={searchedPlate}
          submitting={create.isPending}
          onCancel={resetSearch}
          onSubmit={(vehicle) => {
            setError(null);
            return create.mutateAsync({ newVehicle: vehicle });
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * `provinceId` is on the form but not on the wire.
 *
 * The payload carries only `cityId` — the province is derivable from it. The
 * form still asks for a province because it filters the city list, and V-11
 * exists precisely because a stale province selection can otherwise submit a
 * city from somewhere else. The schema below is the contract schema with that
 * one cross-field rule attached, using the same helper the server calls; no
 * rule is written twice.
 */
type NewVehicleFormValues = CreateVehicleInput & { provinceId: number | null };

interface NewVehicleFormProps {
  master: MasterDataBundle;
  initialPlate: string;
  submitting: boolean;
  onCancel?: () => void;
  onSubmit: (vehicle: CreateVehicleInput) => Promise<unknown>;
}

function NewVehicleForm({
  master,
  initialPlate,
  submitting,
  onCancel,
  onSubmit,
}: NewVehicleFormProps): ReactNode {
  const formSchema = useMemo(
    () =>
      createVehicleSchema.superRefine((value: CreateVehicleInput, ctx: z.RefinementCtx) => {
        // `provinceId` is stripped by the object schema, so it is read from the
        // raw input rather than from the parsed value.
        const provinceId = (value as NewVehicleFormValues).provinceId;

        // V-11, from the same helper the server uses.
        for (const cityError of validateCityInProvince(master.cities, value.cityId, provinceId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [cityError.field],
            message: cityError.message,
          });
        }
      }),
    [master.cities],
  );

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<NewVehicleFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      plateDisplay: initialPlate,
      chassisNumber: null,
      category: "TB",
      segment: "truck",
      subSegment: SUB_SEGMENTS_BY_SEGMENT.truck[0],
      vehicleBrandId: null,
      vehicleBrandOther: null,
      cargoType: "",
      provinceId: null,
      cityId: 0,
      axleCount: 2,
      axleConfigs: EMPTY_CONFIGS,
    },
  });

  const category = watch("category");
  const segment = watch("segment");
  const provinceId = watch("provinceId");
  const axleCount = watch("axleCount");
  const axleConfigs = watch("axleConfigs");

  // V-09: the segment options follow the category. In the legacy system they did
  // not, so an LT vehicle could be recorded as a bus and nothing downstream
  // could catch it (D-03).
  const allowedSegments = SEGMENTS_BY_CATEGORY[category];
  const cities = master.cities.filter(
    (city) => provinceId === null || city.provinceId === provinceId,
  );

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values);
    } catch (caught) {
      if (!applyFieldErrors(caught, setError)) {
        setError("plateDisplay", { message: "Gagal membuat pemeriksaan. Silakan coba lagi." });
      }
    }
  });

  const plateRegistration = register("plateDisplay");
  const categoryRegistration = register("category");
  const segmentRegistration = register("segment");

  return (
    <Card title="Data kendaraan baru">
      <form noValidate onSubmit={(event) => void submit(event)} className="space-y-4">
        {Object.keys(errors).length > 0 ? (
          <Banner tone="error" title="Beberapa isian belum lengkap atau tidak valid">
            Periksa kembali bagian yang ditandai merah.
          </Banner>
        ) : null}

        <Field
          label="Plat Nomor"
          htmlFor="plateDisplay"
          error={errors.plateDisplay?.message}
          hint="Contoh: B 1234 ABC"
          required
        >
          <Input
            id="plateDisplay"
            autoCapitalize="characters"
            invalid={errors.plateDisplay !== undefined}
            {...plateRegistration}
            onBlur={(event) => {
              setValue("plateDisplay", normalizePlateDisplay(event.target.value));
              void plateRegistration.onBlur(event);
            }}
          />
        </Field>

        <Field
          label="Nomor Rangka"
          htmlFor="chassisNumber"
          error={errors.chassisNumber?.message}
          // PLAN/11 §3: the plate is the wrong identity — it changes on a
          // regional transfer and can be reassigned to another vehicle. The
          // chassis number is stable, so it is collected where possible even
          // while uniqueness still rests on the plate.
          hint="Opsional untuk saat ini. Tercantum di STNK. Nomor rangka tidak berubah meski plat diganti, sehingga riwayat kendaraan tetap tersambung."
        >
          <Input
            id="chassisNumber"
            autoCapitalize="characters"
            invalid={errors.chassisNumber !== undefined}
            {...register("chassisNumber", {
              setValueAs: (value: string) => (value === "" ? null : value),
            })}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kategori TB / LT" htmlFor="category" error={errors.category?.message} required>
            <Select
              id="category"
              invalid={errors.category !== undefined}
              {...categoryRegistration}
              onChange={(event) => {
                void categoryRegistration.onChange(event);
                const segments = SEGMENTS_BY_CATEGORY[event.target.value as VehicleCategory];
                if (!segments.includes(segment)) {
                  // Every category has at least one segment, but the index
                  // signature cannot know that.
                  const fallback = segments[0] ?? "truck";
                  setValue("segment", fallback);
                  setValue("subSegment", SUB_SEGMENTS_BY_SEGMENT[fallback][0]);
                }
              }}
            >
              {VEHICLE_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {VEHICLE_CATEGORY_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Segmen Utama" htmlFor="segment" error={errors.segment?.message} required>
            <Select
              id="segment"
              invalid={errors.segment !== undefined}
              {...segmentRegistration}
              onChange={(event) => {
                void segmentRegistration.onChange(event);
                const next = event.target.value as VehicleSegment;
                setValue("subSegment", SUB_SEGMENTS_BY_SEGMENT[next][0]);
              }}
            >
              {allowedSegments.map((value) => (
                <option key={value} value={value}>
                  {VEHICLE_SEGMENT_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label={segment === "bus" ? "Kategori Bus" : "Kategori Truck"}
          htmlFor="subSegment"
          error={errors.subSegment?.message}
          required
        >
          <Select
            id="subSegment"
            invalid={errors.subSegment !== undefined}
            {...register("subSegment")}
          >
            {SUB_SEGMENTS_BY_SEGMENT[segment].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Merk Kendaraan"
            htmlFor="vehicleBrandId"
            error={errors.vehicleBrandId?.message}
          >
            <Controller
              control={control}
              name="vehicleBrandId"
              render={({ field }) => (
                <SearchableSelect
                  id="vehicleBrandId"
                  value={field.value ?? null}
                  invalid={errors.vehicleBrandId !== undefined}
                  placeholder="— Pilih merk kendaraan —"
                  searchPlaceholder="Cari merk (Hino, Mitsubishi, Scania, dll)…"
                  emptyMessage="Merk tidak ditemukan"
                  clearable
                  options={master.vehicleBrands.map((brand) => ({
                    value: brand.id,
                    label: brand.name,
                  }))}
                  onChange={(value) => field.onChange(value ?? null)}
                />
              )}
            />
          </Field>

          <Field
            label="Merk lain"
            htmlFor="vehicleBrandOther"
            error={errors.vehicleBrandOther?.message}
            hint="Isi hanya bila merk tidak ada di daftar."
          >
            <Input
              id="vehicleBrandOther"
              invalid={errors.vehicleBrandOther !== undefined}
              {...register("vehicleBrandOther", {
                setValueAs: (value: string) => (value === "" ? null : value),
              })}
            />
          </Field>
        </div>

        <Field label="Jenis Muatan" htmlFor="cargoType" error={errors.cargoType?.message} required>
          <Input
            id="cargoType"
            invalid={errors.cargoType !== undefined}
            {...register("cargoType")}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Provinsi" htmlFor="provinceId" error={errors.provinceId?.message} required>
            <Controller
              control={control}
              name="provinceId"
              render={({ field }) => (
                <SearchableSelect
                  id="provinceId"
                  value={field.value}
                  invalid={errors.provinceId !== undefined}
                  placeholder="— Pilih provinsi —"
                  searchPlaceholder="Ketik nama provinsi (Jawa Barat, DKI Jakarta, dll)…"
                  emptyMessage="Provinsi tidak ditemukan"
                  clearable
                  options={master.provinces.map((province) => ({
                    value: province.id,
                    label: province.name,
                  }))}
                  onChange={(value) => {
                    field.onChange(value ?? null);
                    // A city from the previous province would pass the foreign
                    // key and fail V-11, so it is cleared with the province.
                    setValue("cityId", 0);
                  }}
                />
              )}
            />
          </Field>

          <Field label="Kota" htmlFor="cityId" error={errors.cityId?.message} required>
            <Controller
              control={control}
              name="cityId"
              render={({ field }) => (
                <SearchableSelect
                  id="cityId"
                  value={field.value === 0 ? null : field.value}
                  disabled={provinceId === null}
                  invalid={errors.cityId !== undefined}
                  placeholder={provinceId === null ? "— Pilih provinsi terlebih dahulu —" : "— Pilih kota / kabupaten —"}
                  searchPlaceholder="Ketik nama kota atau kabupaten…"
                  emptyMessage="Kota tidak ditemukan"
                  clearable
                  options={cities.map((city) => ({
                    value: city.id,
                    label: city.name,
                  }))}
                  onChange={(value) => field.onChange(value ?? 0)}
                />
              )}
            />
          </Field>
        </div>

        <AxleConfigurator
          axleCount={axleCount}
          configs={axleConfigs}
          onChange={(next) => {
            setValue("axleCount", next.axleCount);
            setValue("axleConfigs", next.configs);
          }}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" loading={submitting} loadingText="Membuat…" className="flex-1">
            Buat Pemeriksaan
          </Button>
          {onCancel ? (
            <Button variant="secondary" type="button" onClick={onCancel}>
              Batal
            </Button>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
