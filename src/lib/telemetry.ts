import type { RamEntry, TimeSeriesPoint } from '../types/telemetry';

export type TelemetrySnapshot = {
  points: Array<{ lat: number; lng: number; time: number }>;
  speedSeries: TimeSeriesPoint[];
  currentSpeed: number | null;
  accelSeries: TimeSeriesPoint[];
  currentAccel: number | null;
  hasData: boolean;
};

const emptySnapshot = (): TelemetrySnapshot => ({
  points: [],
  speedSeries: [],
  currentSpeed: null,
  accelSeries: [],
  currentAccel: null,
  hasData: false,
});

function buildSeries(
  entries: Record<string, RamEntry>,
  field: '속도' | '가속도'
): { series: TimeSeriesPoint[]; current: number | null } {
  const series = Object.entries(entries)
    .map(([ts, entry]) => ({
      time: Number(ts),
      value: entry[field],
    }))
    .filter(
      (p): p is TimeSeriesPoint =>
        p.value != null && Number.isFinite(p.value as number)
    )
    .map((p) => ({ time: p.time, value: p.value as number }))
    .sort((a, b) => a.time - b.time);

  const current = series.length > 0 ? series[series.length - 1].value : null;
  return { series, current };
}

export function parseTelemetryResponse(
  data: unknown,
  identifier: string
): TelemetrySnapshot {
  if (!data || typeof data !== 'object' || 'error' in data) {
    return emptySnapshot();
  }

  const entries = (data as Record<string, Record<string, RamEntry>>)[identifier];
  if (!entries) return emptySnapshot();

  const points = Object.entries(entries)
    .flatMap(([ts, entry]) => {
      if (!entry.GPS) return [];
      return [
        {
          time: Number(ts),
          lat: entry.GPS.lat,
          lng: entry.GPS.lng,
        },
      ];
    })
    .sort((a, b) => a.time - b.time);

  const speed = buildSeries(entries, '속도');
  const accel = buildSeries(entries, '가속도');

  return {
    points,
    speedSeries: speed.series,
    currentSpeed: speed.current,
    accelSeries: accel.series,
    currentAccel: accel.current,
    hasData:
      points.length > 0 || speed.series.length > 0 || accel.series.length > 0,
  };
}

export function msToKmh(ms: number): number {
  return ms * 3.6;
}
