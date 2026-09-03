import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type Ref,
} from "react";
import { cn } from "../../lib/cn.ts";
import { useFieldWiring, controlTone } from "./primitives.tsx";

export interface SearchableOption<T = string | number> {
  value: T;
  label: string;
  sublabel?: string;
  disabled?: boolean;
}

export interface SearchableSelectProps<T extends string | number = string | number> {
  id?: string;
  name?: string;
  value?: T | null;
  onChange?: (value: T | null) => void;
  options: Array<SearchableOption<T>>;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  invalid?: boolean;
  clearable?: boolean;
  className?: string;
  "aria-describedby"?: string;
}

/**
 * A searchable select dropdown component (combobox).
 *
 * Features:
 * - Live filtering with substring search.
 * - Full keyboard navigation (ArrowUp, ArrowDown, Enter, Escape).
 * - Click-outside detection to dismiss popover.
 * - Integration with Field error / invalid state.
 * - Clean dark & light mode styling matching the design system.
 */
/**
 * `forwardRef` erases generics: its own signature is not generic, so the type
 * parameter has nowhere to live and the usual workaround is to reach for
 * `any` — which then leaks out to every call site. `SearchableSelectProps<T>`
 * is declared once on the inner function and re-attached below by asserting
 * the wrapper's type, so `T` survives and callers keep theirs.
 */
const SearchableSelectInner = forwardRef(
  function SearchableSelect<T extends string | number>(
    {
      id,
      name,
      value,
      onChange,
      options,
      placeholder = "— Pilih opsi —",
      searchPlaceholder = "Ketik untuk mencari…",
      emptyMessage = "Tidak ada hasil yang cocok",
      disabled = false,
      invalid,
      clearable = false,
      className,
      "aria-describedby": ariaDescribedBy,
    }: SearchableSelectProps<T>,
    ref: Ref<HTMLButtonElement>,
  ) {
    const generatedId = useId();
    const triggerId = id || generatedId;
    const wiring = useFieldWiring(invalid);

    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [highlightedIndex, setHighlightedIndex] = useState(0);

    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    // Find the currently selected option
    const selectedOption = options.find((opt) => opt.value === value) || null;

    // Filtered options based on search query
    const filteredOptions = options.filter((opt) => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      const labelMatch = opt.label.toLowerCase().includes(query);
      const sublabelMatch = opt.sublabel?.toLowerCase().includes(query);
      return labelMatch || sublabelMatch;
    });

    // Close when clicking outside
    useEffect(() => {
      if (!isOpen) return;

      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
          setSearchQuery("");
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [isOpen]);

    // Focus search input when popover opens
    useEffect(() => {
      if (isOpen) {
        setHighlightedIndex(0);
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 10);
      }
    }, [isOpen]);

    // Scroll highlighted option into view
    useEffect(() => {
      if (isOpen && listRef.current) {
        const highlightedEl = listRef.current.children[highlightedIndex] as HTMLElement;
        if (highlightedEl) {
          highlightedEl.scrollIntoView({ block: "nearest" });
        }
      }
    }, [highlightedIndex, isOpen]);

    const handleSelect = (option: SearchableOption<T>): void => {
      if (option.disabled) return;
      onChange?.(option.value);
      setIsOpen(false);
      setSearchQuery("");
    };

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange?.(null);
      setSearchQuery("");
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;

      if (!isOpen) {
        if (e.key === "Enter" || e.key === "ArrowDown" || e.key === " " || e.key === "ArrowUp") {
          e.preventDefault();
          setIsOpen(true);
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < filteredOptions.length - 1 ? prev + 1 : prev,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case "Enter":
          e.preventDefault();
          if (filteredOptions[highlightedIndex]) {
            handleSelect(filteredOptions[highlightedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          setSearchQuery("");
          break;
        case "Tab":
          setIsOpen(false);
          setSearchQuery("");
          break;
      }
    };

    return (
      <div
        ref={containerRef}
        onKeyDown={handleKeyDown}
        className="relative w-full text-left select-none"
      >
        {/* Hidden input for standard form serialization if needed */}
        {name ? (
          <input
            type="hidden"
            name={name}
            value={value !== null && value !== undefined ? String(value) : ""}
          />
        ) : null}

        {/* Trigger Button */}
        <button
          ref={ref}
          id={triggerId}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-invalid={wiring.invalid}
          aria-describedby={ariaDescribedBy ?? wiring.describedBy}
          onClick={() => {
            if (!disabled) {
              setIsOpen((prev) => !prev);
              setSearchQuery("");
            }
          }}
          className={cn(
            "flex w-full min-h-11 items-center justify-between gap-2 rounded-md border py-2 pl-3 text-left text-sm transition-colors",
            // Room for the chevron, plus room for the clear control when it is
            // there — it sits over the trigger rather than inside it.
            clearable && selectedOption !== null && !disabled ? "pr-9" : "pr-3",
            "focus:outline-none focus:ring-2 focus:ring-accent/30",
            controlTone(wiring.invalid),
            disabled ? "bg-surface-sunken text-subtle cursor-not-allowed opacity-75" : "hover:border-line-strong cursor-pointer",
            className,
          )}
        >
          <span className={cn("block truncate", selectedOption ? "text-body font-medium" : "text-subtle")}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>

          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={cn(
              "flex-shrink-0 text-muted transition-transform duration-200",
              isOpen ? "rotate-180 text-accent-text" : "",
            )}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/*
          The clear control is a SIBLING of the trigger, not a child of it.
          It used to be a `role="button"` span inside the trigger button — a
          control nested in a control, which axe reports as `nested-interactive`
          and which browsers and screen readers do not agree on how to expose.
          In practice the inner one was announced as part of the outer button's
          name and could not be operated on its own.

          Absolutely positioned so the layout is unchanged, and the trigger
          reserves room for it with `pr-9`.
        */}
        {clearable && selectedOption !== null && !disabled ? (
          <button
            type="button"
            aria-label={`Hapus pilihan ${selectedOption.label}`}
            onClick={handleClear}
            className="absolute right-8 top-1/2 -translate-y-1/2 rounded p-1 text-muted transition-colors hover:bg-surface-sunken hover:text-body"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        ) : null}

        {/* Popover Dropdown Panel */}
        {isOpen ? (
          <div
            className={cn(
              "absolute left-0 top-full z-50 mt-1 w-full rounded-lg border border-line bg-surface p-1.5 shadow-xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95",
            )}
          >
            {/* Search Input */}
            <div className="relative mb-1.5">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-muted">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>

              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                placeholder={searchPlaceholder}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setHighlightedIndex(0);
                }}
                className="w-full rounded-md border border-line bg-surface-sunken/60 py-1.5 pl-8 pr-7 text-xs text-body placeholder:text-subtle focus:border-accent focus:bg-surface focus:outline-none focus:ring-1 focus:ring-accent"
              />

              {searchQuery ? (
                <button
                  type="button"
                  aria-label="Bersihkan pencarian"
                  onClick={() => {
                    setSearchQuery("");
                    searchInputRef.current?.focus();
                  }}
                  className="absolute inset-y-0 right-0 flex items-center pr-2 text-muted hover:text-body"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              ) : null}
            </div>

            {/* Options List */}
            <ul
              ref={listRef}
              role="listbox"
              aria-label={placeholder}
              className="max-h-60 overflow-y-auto space-y-0.5 scroll-py-1 focus:outline-none"
            >
              {filteredOptions.length === 0 ? (
                <li className="py-3 px-3 text-center text-xs text-muted">
                  {emptyMessage}
                </li>
              ) : (
                filteredOptions.map((option, index) => {
                  const isSelected = option.value === value;
                  const isHighlighted = index === highlightedIndex;

                  return (
                    <li
                      key={String(option.value)}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={option.disabled}
                      onClick={() => handleSelect(option)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-xs transition-colors cursor-pointer",
                        isSelected
                          ? "bg-accent-soft text-accent-text font-semibold"
                          : isHighlighted
                            ? "bg-surface-sunken text-body font-medium"
                            : "text-body",
                        option.disabled ? "opacity-50 cursor-not-allowed" : "",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <span className="block truncate">{option.label}</span>
                        {option.sublabel ? (
                          <span className="block truncate text-[10px] text-muted font-normal">
                            {option.sublabel}
                          </span>
                        ) : null}
                      </div>

                      {isSelected ? (
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="flex-shrink-0 text-accent-text"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : null}
                    </li>
                  );
                })
              )}
            </ul>

            {/* Footer summary counter */}
            {filteredOptions.length > 0 ? (
              <div className="mt-1 pt-1.5 border-t border-line/60 px-2 flex items-center justify-between text-[10px] text-muted">
                <span>{filteredOptions.length} opsi tersedia</span>
                {searchQuery ? <span>Disaring dari {options.length}</span> : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  },
);

export const SearchableSelect = SearchableSelectInner as <T extends string | number>(
  props: SearchableSelectProps<T> & { ref?: Ref<HTMLButtonElement> },
) => ReactElement;
