import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { MAX_TOTAL_TIRES } from "@c26/contracts";
import { HERO_IMAGE } from "./image-credits.ts";

/* ── Product value — editorial, not a card grid ─────────────────────────────
 *
 * Five equal cards in a row is the shape that says "template" more loudly than
 * any other single decision. These five ideas are not equally important, so the
 * layout says so: one carries a number at display size, one carries a fragment
 * of the interface, and the rest are set as running text under a rule.
 */

export function ProductValue(): ReactNode {
  return (
    <section id="nilai" className="border-t border-line bg-canvas py-16 sm:py-24">
      <div className="mx-auto grid max-w-site gap-12 px-5 sm:px-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
        <div>
          <h2 className="max-w-prose font-display text-xl font-bold tracking-tight text-body sm:text-2xl">
            Ban adalah biaya operasional yang paling mudah dilupakan, dan paling mahal
            ketika dilupakan.
          </h2>

          <p className="mt-5 max-w-prose text-base text-muted">
            Sebuah ban keluar dari gudang, dipasang di satu posisi, dipindah ke posisi lain,
            diperiksa beberapa kali, lalu diganti. Kalau setiap langkah itu dicatat di buku
            yang berbeda — atau tidak dicatat sama sekali — tidak ada yang bisa menjawab
            pertanyaan paling sederhana: ban ini sudah berapa lama jalan, dan di kendaraan
            mana saja.
          </p>

          <p className="mt-4 max-w-prose text-base text-muted">
            Sistem ini menyatukan langkah-langkah itu ke satu catatan per ban, per posisi,
            per pemeriksaan.
          </p>

          <dl className="mt-10 grid gap-x-10 gap-y-6 border-t border-line pt-8 sm:grid-cols-2">
            <ValueItem
              term="Riwayat yang tidak bisa dihapus"
              detail="Data bisnis tidak pernah benar-benar dihapus. Perubahan status ditulis ke jejak audit bersama pelaku dan waktunya, di transaksi yang sama."
            />
            <ValueItem
              term="Terlihat sampai posisi ban"
              detail="Bukan per kendaraan, tapi per posisi — Steer 1 Kanan, Drive 2 Kiri Dalam. Nama posisinya sama di slot foto, di kartu spesifikasi, dan di berkas ekspor."
            />
            <ValueItem
              term="Pemeriksaan yang punya alur"
              detail="Draf, menunggu QC, perlu revisi, lolos, atau gugur. Statusnya hanya berpindah lewat satu pintu, jadi tidak ada catatan yang berubah diam-diam."
            />
            <ValueItem
              term="Dibuat untuk lapangan"
              detail="Foto diambil di bengkel, sering tanpa sinyal. Antrean unggah menahannya di perangkat dan mengirimkannya sendiri ketika jaringan kembali."
            />
          </dl>
        </div>

        {/* The asymmetric column: one number at display size, then a fragment
            of the real interface underneath it. */}
        <div className="lg:pt-2">
          <div className="border-l-2 border-amber pl-6">
            <p className="font-data text-3xl font-semibold tabular-nums leading-none text-body">
              {MAX_TOTAL_TIRES}
            </p>
            <p className="mt-3 max-w-prose text-sm text-muted">
              posisi ban pada kendaraan enam poros — masing-masing dengan slot fotonya
              sendiri. Nomor posisinya dihitung dari konfigurasi poros, tidak diketik
              tangan, karena satu salah ketik memindahkan foto ke ban yang salah.
            </p>
          </div>

          <div className="mt-8 rounded-panel border border-line bg-surface p-5">
            <p className="text-xs text-subtle">Contoh baris pemeriksaan</p>
            <div className="mt-3 space-y-3">
              <InspectionRow serial="SN2026-00148" plate="B 9241 UZK" status="Pass QC" tone="ok" />
              <InspectionRow
                serial="SN2026-00147"
                plate="B 7712 KDA"
                status="Perlu Revisi"
                tone="warn"
              />
              <InspectionRow
                serial="SN2026-00146"
                plate="D 1183 XLM"
                status="Pending QC"
                tone="neutral"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ValueItem({ term, detail }: { term: string; detail: string }): ReactNode {
  return (
    <div>
      <dt className="text-sm font-semibold text-body">{term}</dt>
      <dd className="mt-1.5 text-sm text-muted">{detail}</dd>
    </div>
  );
}

function InspectionRow({
  serial,
  plate,
  status,
  tone,
}: {
  serial: string;
  plate: string;
  status: string;
  tone: "ok" | "warn" | "neutral";
}): ReactNode {
  const dot =
    tone === "ok" ? "bg-signal-ok" : tone === "warn" ? "bg-warning" : "bg-subtle";

  return (
    <div className="flex items-center justify-between gap-4 border-b border-line pb-3 last:border-0 last:pb-0">
      <div className="min-w-0">
        <p className="truncate font-data text-xs font-medium text-body">{serial}</p>
        <p className="truncate font-data text-[0.6875rem] text-subtle">{plate}</p>
      </div>
      <p className="flex flex-none items-center gap-2 text-xs text-muted">
        <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        {status}
      </p>
    </div>
  );
}

/* ── Product journey — the one numbered section ─────────────────────────────*/

interface Step {
  number: string;
  title: string;
  detail: string;
}

const STEPS: readonly Step[] = [
  {
    number: "01",
    title: "Daftarkan kendaraan",
    detail:
      "Plat nomor, merek, segmen, dan konfigurasi poros. Dari konfigurasi itu sistem menghitung sendiri berapa ban yang ada dan di posisi mana saja.",
  },
  {
    number: "02",
    title: "Daftarkan ban",
    detail:
      "Ukuran, merek, dan pola tapak dipilih dari data master, bukan diketik bebas — supaya dua orang tidak menulis ukuran yang sama dengan dua cara.",
  },
  {
    number: "03",
    title: "Pasang ban",
    detail:
      "Setiap ban menempati satu posisi bernama. Namanya dipakai ulang di slot foto dan di jalur penyimpanan, jadi tidak ada foto yang nyasar.",
  },
  {
    number: "04",
    title: "Pantau pemakaian",
    detail:
      "Kedalaman tapak, tekanan, dan umur pakai terkumpul per posisi, bukan per kendaraan. Yang aus lebih cepat terlihat sebagai pola, bukan kejutan.",
  },
  {
    number: "05",
    title: "Periksa & rawat",
    detail:
      "Pemeriksaan masuk antrean QC. Peninjau meloloskan, meminta revisi, atau menggugurkannya — dan alasannya ikut tercatat.",
  },
  {
    number: "06",
    title: "Ganti & analisis",
    detail:
      "Ban yang habis diganti, riwayatnya tetap. Dari situ pertanyaan berikutnya bisa dijawab: merek mana yang bertahan lebih lama di rute mana.",
  },
];

export function ProductJourney(): ReactNode {
  const [active, setActive] = useState(1);
  const containerRef = useRef<HTMLOListElement>(null);

  /*
   * The active step follows the reader. This is the only scroll-driven motion
   * on the page, and it is allowed because it is functional: it reports
   * position inside a genuine sequence rather than decorating one.
   *
   * No scroll hijacking and no sticky takeover — the page scrolls normally and
   * the marker keeps up. On a phone that distinction is the difference between
   * a timeline and a trap.
   */
  useEffect(() => {
    const container = containerRef.current;
    if (container === null || typeof IntersectionObserver === "undefined") return;

    const items = Array.from(container.querySelectorAll("[data-step]"));

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible === undefined) return;

        const step = Number((visible.target as HTMLElement).dataset["step"]);
        if (!Number.isNaN(step)) setActive(step);
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );

    for (const item of items) observer.observe(item);
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <section id="alur" className="border-t border-line bg-surface-sunken py-16 sm:py-24">
      <div className="mx-auto max-w-site px-5 sm:px-8">
        <h2 className="max-w-prose font-display text-xl font-bold tracking-tight text-body sm:text-2xl">
          Dari kendaraan masuk sampai ban diganti
        </h2>

        <ol
          ref={containerRef}
          className={`journey--at-${String(active)} relative mt-12 space-y-10 sm:space-y-12`}
        >
          {/* The rail, and the progress line that advances along it. */}
          <span
            aria-hidden="true"
            className="absolute bottom-2 left-[0.4375rem] top-2 w-px border-l border-dashed border-line-strong"
          />
          <span
            aria-hidden="true"
            className="journey-progress absolute bottom-2 left-[0.4375rem] top-2 w-px bg-amber"
          />

          {STEPS.map((step, index) => (
            <li
              key={step.number}
              data-step={index + 1}
              className={`journey-step relative pl-10 sm:pl-14 ${
                index + 1 === active ? "journey-step--active" : ""
              }`}
            >
              <span
                aria-hidden="true"
                className="journey-marker absolute left-0 top-1.5 h-[0.9375rem] w-[0.9375rem] rounded-full border-2 border-line-strong bg-canvas"
              />
              <div className="grid gap-x-8 gap-y-2 sm:grid-cols-[3.5rem_minmax(0,1fr)]">
                <p className="journey-number font-data text-sm tabular-nums text-subtle">
                  {step.number}
                </p>
                <div>
                  <h3 className="font-display text-lg font-semibold text-body">{step.title}</h3>
                  <p className="mt-1.5 max-w-prose text-sm text-muted">{step.detail}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ── Industrial band ────────────────────────────────────────────────────────*/

export function IndustrialBand(): ReactNode {
  return (
    <section className="relative isolate overflow-hidden bg-graphite">
      <img
        src={HERO_IMAGE.src}
        alt={HERO_IMAGE.alt}
        width={1600}
        height={900}
        loading="lazy"
        className="band-parallax absolute inset-0 h-full w-full scale-105 object-cover opacity-45 saturate-[0.35]"
      />
      {/* A scrim, so the type below holds its contrast over any part of the
          photograph rather than only over the part it was checked against. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-graphite via-graphite/80 to-graphite/40"
      />

      <div className="relative mx-auto max-w-site px-5 py-20 sm:px-8 sm:py-28">
        <p className="max-w-prose font-display text-xl font-semibold leading-snug text-paper sm:text-2xl">
          Keputusan tentang ban diambil di bengkel, bukan di rapat.
        </p>
        <p className="mt-4 max-w-prose text-base text-paper/70">
          Karena itu pendataan harus selesai di tempat ban itu berada — di ponsel, dengan
          sarung tangan, sering tanpa sinyal.
        </p>
      </div>
    </section>
  );
}

/* ── Trust, built from capability ───────────────────────────────────────────
 *
 * There are no customers to name, no case studies, and no uptime figure that
 * anybody has measured. Every line below is instead something the code actually
 * does, and each was checked against the source before it was written. A logo
 * wall would have been faster and would have been a lie.
 */

const CAPABILITIES: readonly { term: string; detail: string }[] = [
  {
    term: "Empat peran dengan akses berbeda",
    detail:
      "Supplier, admin, manajer, dan operator. Menu yang tidak boleh diakses tidak ditampilkan sebagai tombol mati — ia memang tidak ada di layar itu.",
  },
  {
    term: "Jejak audit di transaksi yang sama",
    detail:
      "Setiap perpindahan status menulis siapa, kapan, dari apa, ke apa. Ditulis bersamaan dengan perubahannya, jadi tidak ada perubahan yang lolos tanpa catatan.",
  },
  {
    term: "Verifikasi dua langkah",
    detail:
      "Akun bisa dikunci dengan aplikasi authenticator, lengkap dengan kode pemulihan dan daftar sesi aktif yang bisa diputus dari jauh.",
  },
  {
    term: "Ekspor sebagai antrean, bukan unduhan buntu",
    detail:
      "Permintaan ekspor diproses di latar belakang lalu memberi tautan ketika siap — laporan besar tidak menggantung peramban sampai kedaluwarsa.",
  },
  {
    term: "Foto tahan putus sinyal",
    detail:
      "Foto dikompresi di perangkat dan disimpan di antrean lokal. Pengiriman berjalan sendiri saat jaringan kembali, tanpa perlu mengambil ulang.",
  },
  {
    term: "Data bisnis tidak dihapus permanen",
    detail:
      "Penghapusan menandai baris, bukan membuangnya. Catatan yang salah bisa dilihat kembali, dan riwayatnya tetap utuh.",
  },
];

export function TrustCapability(): ReactNode {
  return (
    <section id="tentang" className="border-t border-line bg-canvas py-16 sm:py-24">
      <div className="mx-auto max-w-site px-5 sm:px-8">
        <div className="max-w-prose">
          <h2 className="font-display text-xl font-bold tracking-tight text-body sm:text-2xl">
            Apa yang sudah ada di dalamnya
          </h2>
          <p className="mt-3 text-base text-muted">
            Daftar ini menjelaskan kemampuan sistem, bukan janji. Tidak ada logo pelanggan
            dan tidak ada angka uptime di halaman ini, karena keduanya belum ada.
          </p>
        </div>

        {/* An alternating list on a rule, not a row of badges. */}
        <dl className="mt-10 border-t border-line">
          {CAPABILITIES.map((item) => (
            <div
              key={item.term}
              className="grid gap-x-10 gap-y-1.5 border-b border-line py-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
            >
              <dt className="text-sm font-semibold text-body">{item.term}</dt>
              <dd className="text-sm text-muted">{item.detail}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ── Final call to action ───────────────────────────────────────────────────*/

export function FinalCta(): ReactNode {
  return (
    <section className="bg-graphite py-16 sm:py-24">
      <div className="mx-auto max-w-site px-5 sm:px-8">
        <div className="max-w-prose">
          <h2 className="font-display text-xl font-bold leading-tight tracking-tight text-paper sm:text-2xl">
            Setiap ban punya riwayat. Pastikan Anda bisa melacaknya.
          </h2>
          <p className="mt-4 text-base text-paper/70">
            Kelola data ban kendaraan secara lebih terstruktur, akurat, dan mudah dipantau.
          </p>
          <Link
            to="/register"
            className="mt-8 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-base bg-amber px-6 text-sm font-semibold text-graphite transition-colors duration-180 ease-precision hover:bg-amber/90 focus-visible:ring-offset-graphite active:translate-y-px"
          >
            Mulai Sekarang
          </Link>
        </div>
      </div>
    </section>
  );
}
