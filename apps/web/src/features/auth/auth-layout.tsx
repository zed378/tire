import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn.ts";
import { ThemeToggle } from "../../components/ui/theme-toggle.tsx";
import type { ImageCredit } from "../landing/image-credits.ts";

/**
 * The frame shared by the sign-in and registration screens.
 *
 * One rounded card, split down the middle: the form on the left, a photograph
 * on the right with a couple of small cards floating over it. Inputs are softly
 * rounded and filled rather than outlined, and the whole card sits on a plain
 * page rather than fighting it.
 *
 * WHAT IS OURS AND WHAT IS BORROWED: the arrangement follows a reference the
 * owner chose. The accent stays blue rather than becoming the reference's
 * yellow — the application had just been unified on one accent, and giving two
 * screens a different one would undo that for the sake of two screens. The
 * floating cards carry real examples from this domain (a serial number, a tire
 * position) instead of a generic product's dashboard.
 *
 * The photograph is served from our own origin: the CSP is `img-src 'self' …`
 * (PLAN/13 §7), so a hot-linked image would simply not render.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  image,
  imageCaption,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
  image: ImageCredit;
  imageCaption: { label: string; detail: string }[];
}): ReactNode {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Link to="/" className="flex items-baseline gap-2">
          <span className="text-base font-semibold tracking-tight text-body">Commercial 2026</span>
          <span className="hidden text-xs text-subtle sm:inline">Data Ban Bus &amp; Truk</span>
        </Link>
        <ThemeToggle />
      </div>

      <main className="mx-auto flex w-full max-w-6xl flex-1 items-center px-5 pb-10 sm:px-8">
        <div className="grid w-full animate-scale-in overflow-hidden rounded-3xl border border-line bg-surface shadow-sm lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <div className="flex flex-col justify-center px-6 py-10 sm:px-10 sm:py-12">
            <div className="mx-auto w-full max-w-sm animate-fade-up [animation-delay:120ms]">
              <span className="inline-flex items-center rounded-full border border-line-strong px-3 py-1 text-xs font-medium text-muted">
                Commercial 2026
              </span>

              <h1 className="mt-8 text-2xl font-semibold tracking-tight text-body">{title}</h1>
              <p className="mt-1.5 text-sm text-muted">{subtitle}</p>

              <div className="mt-7">{children}</div>

              <div className="mt-6 border-t border-line pt-5 text-center">{footer}</div>
            </div>
          </div>

          {/*
            Decorative on small screens by omission rather than by hiding: it is
            not rendered at all below `lg`, so a phone never downloads it.
          */}
          <div className="relative hidden lg:block">
            <img
              src={image.src}
              alt={image.alt}
              className="h-full w-full object-cover"
              loading="lazy"
            />

            {/* A scrim so the cards below stay legible whatever the photo does. */}
            <div aria-hidden="true" className="absolute inset-0 bg-black/25" />

            <div className="absolute inset-x-6 bottom-6 animate-fade-up space-y-2.5 [animation-delay:260ms]">
              {imageCaption.map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl bg-white/90 px-3.5 py-2.5 shadow-sm backdrop-blur-sm"
                >
                  <p className="text-xs font-semibold text-slate-900">{item.label}</p>
                  <p className="mt-0.5 text-xs text-slate-600">{item.detail}</p>
                </div>
              ))}
            </div>

            <p className="absolute right-4 top-4 rounded-full bg-black/45 px-2.5 py-1 text-[11px] text-white/90">
              Foto: {image.author}
            </p>
          </div>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-5 pb-8 text-center text-xs text-subtle sm:px-8">
        {image.licenseUrl === "" ? (
          <span>
            Foto: {image.author}, {image.license}, via{" "}
            <a
              href={image.sourceUrl}
              rel="noopener noreferrer"
              target="_blank"
              className="underline underline-offset-2 hover:text-body"
            >
              Wikimedia Commons
            </a>
            .
          </span>
        ) : (
          <span>
            Foto: {image.author},{" "}
            <a
              href={image.licenseUrl}
              rel="license noopener noreferrer"
              target="_blank"
              className="underline underline-offset-2 hover:text-body"
            >
              {image.license}
            </a>
            , via{" "}
            <a
              href={image.sourceUrl}
              rel="noopener noreferrer"
              target="_blank"
              className="underline underline-offset-2 hover:text-body"
            >
              Wikimedia Commons
            </a>
            .
          </span>
        )}
      </footer>
    </div>
  );
}

/**
 * Filled, softly rounded controls, following the reference.
 *
 * Passed to `Input` as `className`; `cn()` lets these win over the primitive's
 * own border and radius without the primitive having to know about them.
 */
export const AUTH_FIELD = "rounded-xl border-transparent bg-surface-sunken";

export function authFieldClass(extra?: string): string {
  return cn(AUTH_FIELD, extra);
}
