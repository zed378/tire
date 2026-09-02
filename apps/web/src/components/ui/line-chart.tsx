import { useId, useMemo, useState, type ReactNode } from "react";

/**
 * A small SVG line chart, written by hand rather than pulled from a library.
 *
 * TWO REASONS, both from the plan rather than from taste.
 *
 * CSP: PLAN/13 §7 decision A-07 fixes a Content-Security-Policy with no
 * 'unsafe-inline'. Recharts — and every charting library of that shape — renders
 * through injected inline styles, so it simply does not run under that policy.
 * Loosening the policy to accommodate a chart would be the wrong trade: the
 * policy is one of the few defences that holds even if an XSS gets through.
 *
 * Budget: PLAN/06 §7 caps the initial JavaScript at 180 KB compressed, measured
 * on a mid-range phone over 4G. A charting library is most of that budget on its
 * own, for two lines on one screen.
 *
 * SVG presentation attributes (`stroke`, `fill`, `d`) are attributes, not CSS,
 * so nothing here needs a style attribute at all.
 */

const SERIES_STROKE = {
  primary: "stroke-accent",
  secondary: "stroke-warning",
} as const;

const SERIES_FILL = {
  primary: "fill-accent",
  secondary: "fill-warning",
} as const;

export interface LineChartSeries {
  key: string;
  label: string;
  /** A concrete colour rather than a token: it becomes an SVG attribute. */
  /** Which of the two chart tones to draw this series in. */
  tone: "primary" | "secondary";
}

export interface LineChartProps {
  data: Record<string, number | string>[];
  /** Field holding the x-axis label. */
  categoryKey: string;
  series: LineChartSeries[];
  height?: number;
  emptyMessage?: string;
}

const PADDING = { top: 16, right: 16, bottom: 32, left: 44 };
const VIEWBOX_WIDTH = 720;

export function LineChart({
  data,
  categoryKey,
  series,
  height = 260,
  emptyMessage = "Belum ada data.",
}: LineChartProps): ReactNode {
  const titleId = useId();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const geometry = useMemo(() => {
    const values = data.flatMap((row) =>
      series.map((line) => Number(row[line.key] ?? 0)),
    );
    const maxValue = Math.max(1, ...values);

    // Round the axis up to something a person would draw.
    const step = Math.max(1, Math.ceil(maxValue / 4));
    const axisMax = step * 4;

    const plotWidth = VIEWBOX_WIDTH - PADDING.left - PADDING.right;
    const plotHeight = height - PADDING.top - PADDING.bottom;

    const xFor = (index: number): number =>
      data.length <= 1
        ? PADDING.left + plotWidth / 2
        : PADDING.left + (index / (data.length - 1)) * plotWidth;

    const yFor = (value: number): number =>
      PADDING.top + plotHeight - (value / axisMax) * plotHeight;

    return {
      axisMax,
      step,
      plotHeight,
      xFor,
      yFor,
      ticks: [0, step, step * 2, step * 3, step * 4],
    };
  }, [data, series, height]);

  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-muted">{emptyMessage}</p>;
  }

  // On a phone, labelling every day turns the axis into a smudge.
  const labelInterval = Math.ceil(data.length / 6);

  return (
    <figure className="w-full">
      <svg
        viewBox={`0 0 ${String(VIEWBOX_WIDTH)} ${String(height)}`}
        className="h-auto w-full"
        role="img"
        aria-labelledby={titleId}
        preserveAspectRatio="xMidYMid meet"
      >
        <title id={titleId}>
          Grafik {series.map((line) => line.label).join(" dan ")} per periode
        </title>

        {geometry.ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PADDING.left}
              x2={VIEWBOX_WIDTH - PADDING.right}
              y1={geometry.yFor(tick)}
              y2={geometry.yFor(tick)}
              className="stroke-line"
              strokeWidth={1}
            />
            <text
              x={PADDING.left - 8}
              y={geometry.yFor(tick) + 4}
              textAnchor="end"
              fontSize={11}
              className="fill-subtle"
            >
              {tick}
            </text>
          </g>
        ))}

        {data.map((row, index) =>
          index % labelInterval === 0 ? (
            <text
              key={`label-${String(index)}`}
              x={geometry.xFor(index)}
              y={height - 10}
              textAnchor="middle"
              fontSize={11}
              className="fill-subtle"
            >
              {String(row[categoryKey] ?? "")}
            </text>
          ) : null,
        )}

        {series.map((line) => {
          const path = data
            .map((row, index) => {
              const command = index === 0 ? "M" : "L";
              return `${command}${String(geometry.xFor(index))},${String(geometry.yFor(Number(row[line.key] ?? 0)))}`;
            })
            .join(" ");

          return (
            <g key={line.key}>
              <path
                d={path}
                fill="none"
                strokeWidth={2}
                strokeLinejoin="round"
                className={SERIES_STROKE[line.tone]}
              />
              {data.map((row, index) => (
                <circle
                  key={`${line.key}-${String(index)}`}
                  cx={geometry.xFor(index)}
                  cy={geometry.yFor(Number(row[line.key] ?? 0))}
                  r={hoverIndex === index ? 5 : 3}
                  className={SERIES_FILL[line.tone]}
                />
              ))}
            </g>
          );
        })}

        {/* One invisible strip per point, so a tap anywhere in the column
            selects it. Fingers are wider than a 3px dot. */}
        {data.map((_, index) => (
          <rect
            key={`hit-${String(index)}`}
            x={geometry.xFor(index) - 12}
            y={PADDING.top}
            width={24}
            height={geometry.plotHeight}
            fill="transparent"
            onMouseEnter={() => setHoverIndex(index)}
            onMouseLeave={() => setHoverIndex(null)}
            onFocus={() => setHoverIndex(index)}
            onBlur={() => setHoverIndex(null)}
            tabIndex={0}
            role="button"
            aria-label={String(data[index]?.[categoryKey] ?? "")}
          />
        ))}
      </svg>

      <figcaption className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted">
        {series.map((line) => (
          <span key={line.key} className="flex items-center gap-1.5">
            <svg width="12" height="12" aria-hidden="true">
              <circle cx="6" cy="6" r="5" className={SERIES_FILL[line.tone]} />
            </svg>
            {line.label}
          </span>
        ))}

        {hoverIndex !== null ? (
          <span className="font-medium text-body">
            {String(data[hoverIndex]?.[categoryKey] ?? "")}:{" "}
            {series
              .map((line) => `${line.label} ${String(data[hoverIndex]?.[line.key] ?? 0)}`)
              .join(" · ")}
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}
