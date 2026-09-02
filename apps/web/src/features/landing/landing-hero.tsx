import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { TREAD_IMAGE } from "./image-credits.ts";

/**
 * The hero — the one place on this page allowed to be bold.
 *
 * Everything after it is deliberately quiet. A page where every section
 * competes has no hierarchy at all, so the boldness is spent here and nowhere
 * else (brief §14).
 *
 * The right column is a composed visual, not a photograph in a rounded box. The
 * tread runs full-bleed off the right edge of the viewport and the grooves are
 * cropped so they leave the frame diagonally; three technical callouts are
 * anchored to points on it with thin leader lines and monospace labels. The
 * reference is an engineering drawing, which is what these users actually read,
 * rather than the tooltip vocabulary of a marketing site.
 */

interface Callout {
  /** Vertical anchor, as a Tailwind class — a computed `top` would need an
   *  inline style, which the CSP forbids. */
  anchor: string;
  value: string;
  label: string;
}

const CALLOUTS: readonly Callout[] = [
  { anchor: "top-[26%]", value: "8,4 mm", label: "Kedalaman tapak" },
  { anchor: "top-[47%]", value: "120 psi", label: "Tekanan angin" },
  { anchor: "top-[68%]", value: "14 bln", label: "Umur pakai" },
];

const PLAYED_KEY = "c26_hero_played";

export function LandingHero(): ReactNode {
  /*
   * The sequence runs once per session. Coming back from a login attempt, or
   * from the browser's back button, should not replay a 1.2-second
   * performance — by the third time it is an obstacle between the reader and
   * the page.
   *
   * It starts as `false` so that the very first paint is the finished state.
   * The animation is then switched on in an effect, which also means a reader
   * whose JavaScript never runs sees a complete hero rather than an empty one.
   */
  const [play, setPlay] = useState(false);

  useEffect(() => {
    let alreadyPlayed = false;
    try {
      alreadyPlayed = window.sessionStorage.getItem(PLAYED_KEY) === "1";
    } catch {
      // Private mode, or storage disabled. Treat it as already played: a
      // missing animation is a smaller problem than a thrown exception.
      alreadyPlayed = true;
    }

    if (alreadyPlayed) return;

    setPlay(true);
    try {
      window.sessionStorage.setItem(PLAYED_KEY, "1");
    } catch {
      // Nothing to do. It will simply play again next time.
    }
  }, []);

  return (
    <section className={`relative overflow-hidden bg-canvas ${play ? "hero--play" : ""}`}>
      <div className="mx-auto grid max-w-site items-center gap-10 px-5 pb-16 pt-14 sm:px-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,6fr)] lg:gap-4 lg:pb-24 lg:pt-20">
        <div className="hero-settle max-w-prose lg:max-w-none lg:pr-10">
          <p className="text-sm text-subtle">Manajemen ban armada</p>

          <h1 className="mt-4 font-display text-2xl font-bold leading-[1.08] tracking-tight text-body sm:text-3xl">
            Setiap ban punya riwayat.
            <br />
            Pastikan Anda bisa melacaknya.
          </h1>

          <p className="mt-5 max-w-prose text-base text-muted">
            Pendataan ban bus dan truk dengan satu nomor seri per pemeriksaan, foto untuk
            setiap posisi ban, dan riwayat keputusan yang tidak bisa dihapus siapa pun.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              to="/register"
              className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-base bg-accent px-6 text-sm font-semibold text-on-accent transition-colors duration-180 ease-precision hover:bg-accent-hover active:translate-y-px"
            >
              Mulai Menggunakan
            </Link>
            <a
              href="#alur"
              className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-base border border-line-strong px-6 text-sm font-semibold text-body transition-colors duration-180 ease-precision hover:border-accent hover:text-accent-text active:translate-y-px"
            >
              Pelajari Selengkapnya
            </a>
          </div>
        </div>

        {/*
          On mobile this sits under the text at a fixed aspect ratio. On desktop
          it breaks out of the container and runs to the right edge of the
          viewport — the crop is the point, and a photograph that stops politely
          at a margin has been turned back into an illustration.
        */}
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-panel bg-graphite lg:aspect-auto lg:h-[30rem] lg:rounded-l-panel lg:rounded-r-none lg:mr-[calc(50%-50vw)]">
          <img
            src={TREAD_IMAGE.src}
            alt={TREAD_IMAGE.alt}
            width={1600}
            height={1200}
            fetchPriority="high"
            className="hero-photo absolute inset-0 h-full w-full scale-[1.35] rotate-[8deg] object-cover"
          />

          {/* A measurement rule sweeping across the image, once. */}
          <div
            aria-hidden="true"
            className="hero-sweep pointer-events-none absolute inset-y-0 left-0 w-px bg-amber/70"
          />

          {CALLOUTS.map((callout, index) => (
            <div
              key={callout.label}
              tabIndex={0}
              className={`hero-callout hero-callout-${String(index + 1)} absolute left-0 flex items-center gap-0 outline-none ${callout.anchor}`}
            >
              <span
                aria-hidden="true"
                className="hero-leader h-px w-10 bg-paper/50 sm:w-16"
              />
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 flex-none rounded-full border border-paper/70"
              />
              <span className="hero-callout-label ml-2.5 whitespace-nowrap font-data text-xs leading-tight text-paper">
                <span className="block font-medium">{callout.value}</span>
                <span className="block text-[0.6875rem] text-paper/70">{callout.label}</span>
              </span>
            </div>
          ))}

          {/*
            One fragment of the real interface, overlapping the image edge. It
            ties the photograph to the product — without it the hero is a stock
            tire and a paragraph, which describes any tire company at all.
          */}
          <div className="absolute bottom-4 right-4 rounded-base border border-paper/15 bg-graphite/85 px-3.5 py-2.5 backdrop-blur-sm sm:bottom-6 sm:right-6">
            <p className="font-data text-[0.6875rem] uppercase tracking-wide text-paper/60">
              SN2026-00148
            </p>
            <p className="mt-1 flex items-center gap-2 text-xs font-medium text-paper">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-signal-ok" />
              Pass QC
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
