import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { USER_ROLE_LABELS } from "@c26/contracts";
import { useSession } from "../../lib/session.tsx";
import { ThemeToggle } from "../../components/ui/theme-toggle.tsx";
import { LandingHero } from "./landing-hero.tsx";
import { LandingPreview } from "./landing-preview.tsx";
import {
  FinalCta,
  IndustrialBand,
  ProductJourney,
  ProductValue,
  TrustCapability,
} from "./landing-sections.tsx";
import { IMAGE_CREDITS } from "./image-credits.ts";
import "./landing.css";

/**
 * The public page.
 *
 * Nine sections, and only the first of them raises its voice. Everything after
 * the hero is set quietly on purpose — a page where each section tries to be
 * the memorable one ends up with no hierarchy, which is the failure mode most
 * landing pages actually have.
 *
 * It is themed like the rest of the application, so the switch in the header
 * works here exactly as it does everywhere else. Nothing on this page is
 * painted with a literal colour.
 *
 * Motion is CSS keyframes with classes toggled from JavaScript, never an
 * animation library — the CSP carries no `unsafe-inline` (PLAN/13 §7) and gate
 * G-13 fails the build on an inline style. See `landing.css`.
 */
export function LandingPage(): ReactNode {
  return (
    <div className="min-h-dvh bg-canvas text-body">
      <SiteHeader />
      <main id="konten">
        <LandingHero />
        <ProductValue />
        <ProductJourney />
        <LandingPreview />
        <IndustrialBand />
        <TrustCapability />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}

const NAV_LINKS: readonly { href: string; label: string }[] = [
  { href: "#nilai", label: "Latar Belakang" },
  { href: "#alur", label: "Alur Kerja" },
  { href: "#produk", label: "Produk" },
  { href: "#tentang", label: "Tentang" },
];

function SiteHeader(): ReactNode {
  const { user } = useSession();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  /*
   * Over the hero the header is transparent; past 40px it takes on a surface,
   * a hairline, and slightly tighter spacing. The threshold is read once on
   * mount too, because a reload part-way down the page restores the scroll
   * position without ever firing a scroll event.
   */
  useEffect(() => {
    const onScroll = (): void => {
      setScrolled(window.scrollY > 40);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <header
      className={`sticky top-0 z-header transition-all duration-250 ease-precision ${
        scrolled
          ? "border-b border-line bg-surface/90 backdrop-blur"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      {/* The wear-indicator strip. Purely a flourish: where the browser has no
          scroll-linked animations it stays at zero width and is simply absent. */}
      <span
        aria-hidden="true"
        className="scroll-wear absolute inset-x-0 bottom-0 h-0.5 origin-left bg-amber"
      />

      <div
        className={`mx-auto flex max-w-site items-center gap-6 px-5 transition-all duration-250 ease-precision sm:px-8 ${
          scrolled ? "h-14" : "h-16"
        }`}
      >
        <Link
          to="/"
          className="flex-none font-display text-sm font-bold tracking-tight text-body"
        >
          Commercial 2026
        </Link>

        <nav aria-label="Navigasi halaman" className="hidden flex-1 gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="nav-link cursor-pointer self-center text-sm text-muted transition-colors duration-150 ease-precision hover:text-body"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <ThemeToggle />

          {/*
            Somebody already signed in does not need to be asked to sign in.
            This sends them where they were going instead.
          */}
          {user !== null ? (
            <>
              <span className="hidden text-right text-xs leading-tight text-muted sm:block">
                <span className="block font-medium text-body">{user.displayName}</span>
                {USER_ROLE_LABELS[user.role]}
              </span>
              <Link
                to="/welcome"
                className="inline-flex min-h-11 cursor-pointer items-center rounded-base bg-accent px-4 text-sm font-semibold text-on-accent transition-colors duration-180 ease-precision hover:bg-accent-hover active:translate-y-px"
              >
                Buka Beranda
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden min-h-11 cursor-pointer items-center rounded-base px-3 text-sm font-medium text-muted transition-colors duration-180 ease-precision hover:text-body sm:inline-flex"
              >
                Masuk
              </Link>
              <Link
                to="/register"
                className="hidden min-h-11 cursor-pointer items-center rounded-base bg-accent px-4 text-sm font-semibold text-on-accent transition-colors duration-180 ease-precision hover:bg-accent-hover active:translate-y-px sm:inline-flex"
              >
                Mulai Menggunakan
              </Link>
            </>
          )}

          <button
            type="button"
            aria-label="Buka menu"
            aria-expanded={menuOpen}
            onClick={() => {
              setMenuOpen(true);
            }}
            className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-base text-body md:hidden"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      </div>

      {menuOpen ? (
        <MobileMenu
          signedIn={user !== null}
          onClose={() => {
            setMenuOpen(false);
          }}
        />
      ) : null}
    </header>
  );
}

/**
 * The mobile navigation sheet.
 *
 * Full screen, 44px targets, `Esc` closes it, the page behind it does not
 * scroll, and focus cannot leave it while it is open. That last part is the one
 * usually skipped: without it, tabbing walks invisibly through the page
 * underneath and the reader loses track of where they are.
 */
function MobileMenu({
  signedIn,
  onClose,
}: {
  signedIn: boolean;
  onClose: () => void;
}): ReactNode {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const panel = panelRef.current;
    if (panel === null) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Scroll lock by class, not by a style attribute the CSP would reject.
    document.body.classList.add("overflow-hidden");

    const focusable = (): HTMLElement[] =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );

    focusable()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const items = focusable();
      const first = items[0];
      const last = items[items.length - 1];
      if (first === undefined || last === undefined) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("overflow-hidden");
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Navigasi"
      className="fixed inset-0 z-drawer flex flex-col bg-canvas md:hidden"
    >
      <div className="flex h-16 flex-none items-center justify-between px-5">
        <span className="font-display text-sm font-bold tracking-tight text-body">
          Commercial 2026
        </span>
        <button
          type="button"
          aria-label="Tutup menu"
          onClick={onClose}
          className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-base text-body"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <nav aria-label="Navigasi halaman" className="flex-1 px-5 pt-4">
        <ul className="space-y-1">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                onClick={onClose}
                className="flex min-h-11 items-center border-b border-line text-base text-body"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex-none space-y-3 px-5 pb-8">
        {signedIn ? (
          <Link
            to="/welcome"
            onClick={onClose}
            className="flex min-h-11 items-center justify-center rounded-base bg-accent px-5 text-sm font-semibold text-on-accent"
          >
            Buka Beranda
          </Link>
        ) : (
          <>
            <Link
              to="/register"
              onClick={onClose}
              className="flex min-h-11 items-center justify-center rounded-base bg-accent px-5 text-sm font-semibold text-on-accent"
            >
              Mulai Menggunakan
            </Link>
            <Link
              to="/login"
              onClick={onClose}
              className="flex min-h-11 items-center justify-center rounded-base border border-line-strong px-5 text-sm font-semibold text-body"
            >
              Masuk
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

function SiteFooter(): ReactNode {
  return (
    <footer className="border-t border-line bg-canvas">
      <div className="mx-auto max-w-site px-5 py-12 sm:px-8">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <p className="font-display text-sm font-bold tracking-tight text-body">
              Commercial 2026
            </p>
            <p className="mt-2 max-w-prose text-sm text-muted">
              Sistem pendataan ban bus dan truk.
            </p>
          </div>

          <nav aria-label="Navigasi footer">
            <p className="text-xs font-semibold text-body">Halaman</p>
            <ul className="mt-3 space-y-2">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="text-sm text-muted hover:text-body">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <p className="text-xs font-semibold text-body">Akun</p>
            <ul className="mt-3 space-y-2">
              <li>
                <Link to="/login" className="text-sm text-muted hover:text-body">
                  Masuk
                </Link>
              </li>
              <li>
                <Link to="/register" className="text-sm text-muted hover:text-body">
                  Daftar
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/*
          Attribution, because two of these photographs are CC BY / CC BY-SA and
          the licence requires the author, the licence, and a link back. Every
          credit was read from the file's own metadata rather than written from
          memory: a credit is somebody's name.
        */}
        <div className="mt-10 border-t border-line pt-6">
          <p className="text-xs text-subtle">Kredit foto</p>
          <ul className="mt-2 space-y-1">
            {IMAGE_CREDITS.map((credit) => (
              <li key={credit.src} className="text-xs text-subtle">
                {credit.alt} — {credit.author},{" "}
                {credit.licenseUrl === "" ? (
                  credit.license
                ) : (
                  <a
                    href={credit.licenseUrl}
                    rel="noreferrer noopener license"
                    target="_blank"
                    className="underline hover:text-muted"
                  >
                    {credit.license}
                  </a>
                )}
                ,{" "}
                <a
                  href={credit.sourceUrl}
                  rel="noreferrer noopener"
                  target="_blank"
                  className="underline hover:text-muted"
                >
                  sumber
                </a>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-8 text-xs text-subtle">
          © {new Date().getFullYear()} Commercial 2026. Seluruh hak dilindungi.
        </p>
      </div>
    </footer>
  );
}
