import { useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  createVehicleSchema,
  normalizePlateDisplay,
  SEGMENTS_BY_CATEGORY,
  SUB_SEGMENTS_BY_SEGMENT,
  validateCityInProvince,
  VEHICLE_CATEGORY_LABELS,
  VEHICLE_CATEGORIES,
  VEHICLE_SEGMENT_LABELS,
  type AxleConfig,
  type CreateVehicleInput,
  type MasterDataBundle,
  type VehicleCategory,
  type VehicleSegment,
  type VehicleSummary,
} from "@c26/contracts";
import { api } from "../../lib/api-client.ts";
import { formatDate } from "../../lib/format.ts";
import { Banner, ErrorBanner, useToast } from "../../components/ui/feedback.tsx";
import { Button, Card, Field, Input, Select } from "../../components/ui/primitives.tsx";
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
  const [plateInput, setPlateInput] = useState("");
  const [matches, setMatches] = useState<VehicleSummary[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleSummary | null>(null);
  const [error, setError] = useState<unknown>(null);

  const master = useQuery({
    queryKey: ["masterdata"],
    queryFn: () => api.get<MasterDataBundle>("/api/masterdata"),
    staleTime: 24 * 60 * 60 * 1000,
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
    onError: setError,
  });

  return (
     <div className="mx-auto max-w-2xl space-y-4">
       <h1 className="text-lg font-semibold text-body">Pemeriksaan Baru</h1>

      {error !== null ? <ErrorBanner error={error} onDismiss={() => setError(null)} /> : null}

      {step === "search" ? (
        <Card
          title="Cari kendaraan"
          description="Ketik plat nomor. Spasi dan huruf besar-kecil tidak berpengaruh."
        >
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);
              search.mutate(normalizePlateDisplay(plateInput));
            }}
            className="space-y-3"
          >
            <Field label="Plat Nomor" htmlFor="plate" required>
              <Input
                id="plate"
                value={plateInput}
                autoFocus
                autoCapitalize="characters"
                placeholder="B 1234 ABC"
                onChange={(event) => setPlateInput(event.target.value)}
              />
            </Field>

            <Button
              type="submit"
              loading={search.isPending}
              loadingText="Mencari…"
              disabled={plateInput.trim().length < 2}
            >
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
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {step === "form" && master.data !== undefined ? (
        <NewVehicleForm
          master={master.data}
          initialPlate={normalizePlateDisplay(plateInput)}
          submitting={create.isPending}
          onSubmit={(vehicle) => {
            setError(null);
            create.mutate({ newVehicle: vehicle });
          }}
        />
      ) : null}
    </div>
  );
}

interface NewVehicleFormProps {
  master: MasterDataBundle;
  initialPlate: string;
  submitting: boolean;
  onSubmit: (vehicle: CreateVehicleInput) => void;
}

function NewVehicleForm({
  master,
  initialPlate,
  submitting,
  onSubmit,
}: NewVehicleFormProps): ReactNode {
  const [plateDisplay, setPlateDisplay] = useState(initialPlate);
  const [chassisNumber, setChassisNumber] = useState("");
  const [category, setCategory] = useState<VehicleCategory>("TB");
  const [segment, setSegment] = useState<VehicleSegment>("truck");
  const [subSegment, setSubSegment] = useState<string>(SUB_SEGMENTS_BY_SEGMENT.truck[0]);
  const [vehicleBrandId, setVehicleBrandId] = useState<number | null>(null);
  const [vehicleBrandOther, setVehicleBrandOther] = useState("");
  const [cargoType, setCargoType] = useState("");
  const [provinceId, setProvinceId] = useState<number | null>(null);
  const [cityId, setCityId] = useState<number | null>(null);
  const [axleCount, setAxleCount] = useState(2);
  const [configs, setConfigs] = useState<AxleConfig[]>(EMPTY_CONFIGS);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // V-09: the segment options follow the category. In the legacy system they did
  // not, so an LT vehicle could be recorded as a bus and nothing downstream
  // could catch it (D-03).
  const allowedSegments = SEGMENTS_BY_CATEGORY[category];
  const cities = master.cities.filter(
    (city) => provinceId === null || city.provinceId === provinceId,
  );

  const submit = (): void => {
    const errors: Record<string, string> = {};

    // V-11, from the same helper the server uses.
    for (const cityError of validateCityInProvince(master.cities, cityId, provinceId)) {
      errors[cityError.field] = cityError.message;
    }

    const candidate = {
      plateDisplay,
      chassisNumber: chassisNumber === "" ? null : chassisNumber,
      category,
      segment,
      subSegment,
      vehicleBrandId,
      vehicleBrandOther: vehicleBrandOther === "" ? null : vehicleBrandOther,
      cargoType,
      cityId: cityId ?? 0,
      axleCount,
      axleConfigs: configs,
    };

    const parsed = createVehicleSchema.safeParse(candidate);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path.join(".");
        errors[field] ??= issue.message;
      }
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      // Scroll and focus to the first field in error (PLAN/05 §5.2 rule 4).
      const first = Object.keys(errors)[0];
      document.getElementById(first ?? "")?.scrollIntoView({ behavior: "smooth", block: "center" });
      document.getElementById(first ?? "")?.focus();
      return;
    }

    onSubmit(candidate);
  };

  return (
    <Card title="Data kendaraan baru">
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="space-y-4"
      >
        {Object.keys(fieldErrors).length > 0 ? (
          <Banner tone="error" title="Beberapa isian belum lengkap atau tidak valid">
            Periksa kembali bagian yang ditandai merah.
          </Banner>
        ) : null}

        <Field
          label="Plat Nomor"
          htmlFor="plateDisplay"
          error={fieldErrors.plateDisplay}
          hint="Contoh: B 1234 ABC"
          required
        >
          <Input
            id="plateDisplay"
            value={plateDisplay}
            autoCapitalize="characters"
            invalid={fieldErrors.plateDisplay !== undefined}
            onChange={(event) => setPlateDisplay(event.target.value)}
            onBlur={(event) => setPlateDisplay(normalizePlateDisplay(event.target.value))}
          />
        </Field>

        <Field
          label="Nomor Rangka"
          htmlFor="chassisNumber"
          error={fieldErrors.chassisNumber}
          // PLAN/11 §3: the plate is the wrong identity — it changes on a
          // regional transfer and can be reassigned to another vehicle. The
          // chassis number is stable, so it is collected where possible even
          // while uniqueness still rests on the plate.
          hint="Opsional untuk saat ini. Tercantum di STNK. Nomor rangka tidak berubah meski plat diganti, sehingga riwayat kendaraan tetap tersambung."
        >
          <Input
            id="chassisNumber"
            value={chassisNumber}
            autoCapitalize="characters"
            invalid={fieldErrors.chassisNumber !== undefined}
            onChange={(event) => setChassisNumber(event.target.value)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kategori TB / LT" htmlFor="category" error={fieldErrors.category} required>
            <Select
              id="category"
              value={category}
              onChange={(event) => {
                const next = event.target.value as VehicleCategory;
                setCategory(next);
                const segments = SEGMENTS_BY_CATEGORY[next];
                if (!segments.includes(segment)) {
                  // Every category has at least one segment, but the index
                  // signature cannot know that.
                  const fallback = segments[0] ?? "truck";
                  setSegment(fallback);
                  setSubSegment(SUB_SEGMENTS_BY_SEGMENT[fallback][0]);
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

          <Field label="Segmen Utama" htmlFor="segment" error={fieldErrors.segment} required>
            <Select
              id="segment"
              value={segment}
              invalid={fieldErrors.segment !== undefined}
              onChange={(event) => {
                const next = event.target.value as VehicleSegment;
                setSegment(next);
                setSubSegment(SUB_SEGMENTS_BY_SEGMENT[next][0]);
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
          error={fieldErrors.subSegment}
          required
        >
          <Select
            id="subSegment"
            value={subSegment}
            invalid={fieldErrors.subSegment !== undefined}
            onChange={(event) => setSubSegment(event.target.value)}
          >
            {SUB_SEGMENTS_BY_SEGMENT[segment].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Merk Kendaraan" htmlFor="vehicleBrandId" error={fieldErrors.vehicleBrandId}>
            <Select
              id="vehicleBrandId"
              value={vehicleBrandId ?? ""}
              invalid={fieldErrors.vehicleBrandId !== undefined}
              onChange={(event) =>
                setVehicleBrandId(event.target.value === "" ? null : Number(event.target.value))
              }
            >
              <option value="">— Pilih merk —</option>
              {master.vehicleBrands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Merk lain"
            htmlFor="vehicleBrandOther"
            hint="Isi hanya bila merk tidak ada di daftar."
          >
            <Input
              id="vehicleBrandOther"
              value={vehicleBrandOther}
              onChange={(event) => setVehicleBrandOther(event.target.value)}
            />
          </Field>
        </div>

        <Field label="Jenis Muatan" htmlFor="cargoType" error={fieldErrors.cargoType} required>
          <Input
            id="cargoType"
            value={cargoType}
            invalid={fieldErrors.cargoType !== undefined}
            onChange={(event) => setCargoType(event.target.value)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Provinsi" htmlFor="provinceId" error={fieldErrors.provinceId} required>
            <Select
              id="provinceId"
              value={provinceId ?? ""}
              invalid={fieldErrors.provinceId !== undefined}
              onChange={(event) => {
                setProvinceId(event.target.value === "" ? null : Number(event.target.value));
                setCityId(null);
              }}
            >
              <option value="">— Pilih provinsi —</option>
              {master.provinces.map((province) => (
                <option key={province.id} value={province.id}>
                  {province.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Kota" htmlFor="cityId" error={fieldErrors.cityId} required>
            <Select
              id="cityId"
              value={cityId ?? ""}
              disabled={provinceId === null}
              invalid={fieldErrors.cityId !== undefined}
              onChange={(event) =>
                setCityId(event.target.value === "" ? null : Number(event.target.value))
              }
            >
              <option value="">— Pilih kota —</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <AxleConfigurator
          axleCount={axleCount}
          configs={configs}
          onChange={(next) => {
            setAxleCount(next.axleCount);
            setConfigs(next.configs);
          }}
        />

        <Button type="submit" loading={submitting} loadingText="Membuat…" className="w-full">
          Buat Pemeriksaan
        </Button>
      </form>
    </Card>
  );
}
