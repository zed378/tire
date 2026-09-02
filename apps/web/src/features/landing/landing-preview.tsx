import { useEffect, useRef, useState, type ReactNode } from "react";
import { derivePositions, type TirePosition } from "@c26/contracts";

/**
 * A working slice of the actual product, not a marketing mockup.
 *
 * THE POSITION NAMES ARE NOT TYPED HERE. They come out of `derivePositions`,
 * the same axle engine the application and the API use — `PLAN/03` §1 is
 * explicit that nothing else in the system may build a tire position name, and
 * a landing page that invented its own would be the first place the naming
 * drifted. Feeding it a real configuration also means the preview cannot show a
 * layout the product could not actually produce.
 *
 * The measurements are demonstration values and the section says so in
 * Indonesian. The structure is real; the numbers are not claims.
 */

// A three-axle truck: one single-mounted steer axle, two double-mounted drive
// axles. Ten tires — an ordinary rigid truck, not a showcase configuration.
const POSITIONS: readonly TirePosition[] = derivePositions([
  { axleType: "steer", axleCount: 1, mounting: "single" },
  { axleType: "drive", axleCount: 2, mounting: "double" },
]);

type Condition = "baik" | "perhatian" | "ganti";

const CONDITION_LABEL: Record<Condition, string> = {
  baik: "Baik",
  perhatian: "Perlu perhatian",
  ganti: "Jadwalkan ganti",
};

interface Demo {
  treadDepth: string;
  pressure: string;
  ageMonths: number;
  condition: Condition;
}

/*
 * Deterministic demonstration values, derived from the position's own sort
 * order. Deterministic matters: the preview must render identically on every
 * visit, and a `Math.random()` here would make two readers looking at the same
 * screen see different numbers.
 */
function demoFor(position: TirePosition): Demo {
  const step = position.sortOrder % 5;
  const depth = 12.4 - step * 1.6;
  const condition: Condition = depth < 7 ? "ganti" : depth < 9 ? "perhatian" : "baik";

  return {
    treadDepth: `${depth.toFixed(1).replace(".", ",")} mm`,
    pressure: `${String(115 + step * 2)} psi`,
    ageMonths: 8 + step * 3,
    condition,
  };
}

const CONDITION_DOT: Record<Condition, string> = {
  baik: "bg-signal-ok",
  perhatian: "bg-warning",
  ganti: "bg-signal-danger",
};

export function LandingPreview(): ReactNode {
  const [selected, setSelected] = useState(POSITIONS[0]?.positionCode ?? "");

  const active = POSITIONS.find((p) => p.positionCode === selected) ?? POSITIONS[0];
  if (active === undefined) return null;

  const demo = demoFor(active);
  const needsAttention = POSITIONS.filter((p) => demoFor(p).condition !== "baik").length;

  return (
    <section id="produk" className="border-t border-line bg-canvas py-16 sm:py-24">
      <div className="mx-auto max-w-site px-5 sm:px-8">
        <div className="max-w-prose">
          <h2 className="font-display text-xl font-bold tracking-tight text-body sm:text-2xl">
            Satu kendaraan, setiap posisi ban terlihat
          </h2>
          <p className="mt-3 text-base text-muted">
            Pilih posisi ban untuk membuka rinciannya. Susunan posisi di bawah dihasilkan
            mesin konfigurasi poros yang sama dengan yang dipakai aplikasi — angkanya contoh,
            strukturnya nyata.
          </p>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          {/* ── Vehicle and positions ─────────────────────────────────────── */}
          <div className="rounded-panel border border-line bg-surface p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-line pb-4">
              <div>
                <p className="font-data text-sm font-medium text-body">B 9241 UZK</p>
                <p className="mt-0.5 text-xs text-muted">Truk rigid · 3 poros</p>
              </div>
              <dl className="flex gap-6">
                <Counter label="Total ban" value={POSITIONS.length} />
                <Counter label="Perlu diperiksa" value={needsAttention} />
              </dl>
            </div>

            <ul className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {POSITIONS.map((position) => {
                const isActive = position.positionCode === active.positionCode;
                return (
                  <li key={position.positionCode}>
                    <button
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => {
                        setSelected(position.positionCode);
                      }}
                      className={`surface-interactive flex w-full cursor-pointer items-center gap-2 rounded-base border px-3 py-2.5 text-left ${
                        isActive
                          ? "border-accent bg-accent-soft"
                          : "border-line bg-surface hover:border-accent"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`h-1.5 w-1.5 flex-none rounded-full ${CONDITION_DOT[demoFor(position).condition]}`}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-medium text-body">
                          {position.positionLabel}
                        </span>
                        <span className="block truncate font-data text-[0.6875rem] text-subtle">
                          {position.positionCode}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* ── Detail, swapped on click ──────────────────────────────────── */}
          <div className="rounded-panel border border-line bg-surface p-5 sm:p-6">
            {/*
              Keyed on the position code so React remounts the panel and the
              entrance animation replays. Without the key the numbers would
              change in place and the swap would be easy to miss.
            */}
            <div key={active.positionCode} className="detail-swap">
              <p className="text-xs text-subtle">Rincian posisi</p>
              <p className="mt-1 font-display text-lg font-semibold text-body">
                {active.positionLabel}
              </p>
              <p className="mt-0.5 font-data text-xs text-muted">{active.positionCode}</p>

              <dl className="mt-5 space-y-3 border-t border-line pt-5">
                <Row label="Kedalaman tapak" value={demo.treadDepth} />
                <Row label="Tekanan angin" value={demo.pressure} />
                <Row label="Umur pakai" value={`${String(demo.ageMonths)} bulan`} />
                <Row
                  label="Kondisi"
                  value={CONDITION_LABEL[demo.condition]}
                  dot={CONDITION_DOT[demo.condition]}
                />
              </dl>

              <p className="mt-5 border-t border-line pt-4 text-xs text-muted">
                Di aplikasi, setiap posisi juga menyimpan foto dan riwayat perubahan
                statusnya.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({
  label,
  value,
  dot,
}: {
  label: string;
  value: string;
  dot?: string;
}): ReactNode {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="flex items-center gap-2 font-data text-sm font-medium text-body">
        {dot !== undefined ? (
          <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        ) : null}
        {value}
      </dd>
    </div>
  );
}

/**
 * Counts up once, the first time it scrolls into view.
 *
 * The accessible value is the final one from the very first render — the
 * count-up is written into a `aria-hidden` span. A screen reader announcing
 * "one, two, three, four…" is not a nice touch, it is noise.
 */
function Counter({ label, value }: { label: string; value: number }): ReactNode {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);
  const [counted, setCounted] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (node === null || counted) return;

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced || typeof IntersectionObserver === "undefined") {
      setCounted(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        setCounted(true);

        let current = 0;
        setShown(0);
        const timer = window.setInterval(() => {
          current += 1;
          setShown(current);
          if (current >= value) window.clearInterval(timer);
        }, 60);
      },
      { threshold: 0.4 },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [counted, value]);

  return (
    <div>
      <dd className="font-data text-lg font-semibold tabular-nums text-body">
        <span className="sr-only">{value}</span>
        <span ref={ref} aria-hidden="true">
          {shown}
        </span>
      </dd>
      <dt className="mt-0.5 text-xs text-muted">{label}</dt>
    </div>
  );
}
