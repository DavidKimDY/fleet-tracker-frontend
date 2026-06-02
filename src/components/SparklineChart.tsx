import type { TimeSeriesPoint } from '../types/telemetry';

type Props = {
  data: TimeSeriesPoint[];
  color: string;
  glowColor: string;
  height?: number;
  smooth?: boolean;
};

function buildPath(
  data: TimeSeriesPoint[],
  width: number,
  height: number,
  smooth: boolean
): string {
  if (data.length === 0) return '';
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 4;

  const coords = data.map((d, i) => {
    const x =
      data.length === 1
        ? width / 2
        : pad + (i / (data.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (d.value - min) / range) * (height - pad * 2);
    return { x, y };
  });

  if (!smooth || coords.length < 3) {
    return coords
      .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`)
      .join(' ');
  }

  let path = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[Math.max(0, i - 1)];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[Math.min(coords.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return path;
}

export function SparklineChart({
  data,
  color,
  glowColor,
  height = 56,
  smooth = false,
}: Props) {
  const width = 280;
  const path = buildPath(data, width, height, smooth);

  if (!path) {
    return (
      <svg
        className="sparkline sparkline--empty"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
      >
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
          awaiting data
        </text>
      </svg>
    );
  }

  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <defs>
        <filter id={`glow-${color.replace('#', '')}`}>
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="2"
        filter={`url(#glow-${color.replace('#', '')})`}
        style={{ filter: `drop-shadow(0 0 6px ${glowColor})` }}
      />
    </svg>
  );
}
