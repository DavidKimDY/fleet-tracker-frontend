import { BACKEND_HTTP_URL } from '../config';
import type {
  RamData,
  RamEntry,
  TimeSeriesPoint,
  TimestampedGps,
  TimestampedSpeed,
} from '../types/telemetry';

export function parseGpsResponse(
  data: unknown,
  identifier: string
): { points: Array<{ lat: number; lng: number; time: number }>; hasData: boolean } {
  if (!data || typeof data !== 'object' || 'error' in data) {
    return { points: [], hasData: false };
  }
  const record = data as Record<string, TimestampedGps>;
  const series = record[identifier];
  if (!series) return { points: [], hasData: false };

  const points = Object.entries(series)
    .map(([ts, entry]) => ({
      time: Number(ts),
      lat: entry.GPS.lat,
      lng: entry.GPS.lng,
    }))
    .sort((a, b) => a.time - b.time);

  return { points, hasData: points.length > 0 };
}

export function parseSpeedResponse(
  data: unknown,
  identifier: string
): { series: TimeSeriesPoint[]; current: number | null; hasData: boolean } {
  if (!data || typeof data !== 'object' || 'error' in data) {
    return { series: [], current: null, hasData: false };
  }
  const record = data as Record<string, TimestampedSpeed>;
  const raw = record[identifier];
  if (!raw) return { series: [], current: null, hasData: false };

  const series = Object.entries(raw)
    .map(([ts, entry]) => ({
      time: Number(ts),
      value: entry['속도'],
    }))
    .filter((p) => Number.isFinite(p.value))
    .sort((a, b) => a.time - b.time);

  const current = series.length > 0 ? series[series.length - 1].value : null;
  return { series, current, hasData: series.length > 0 };
}

export async function fetchRamData(): Promise<RamData | null> {
  try {
    const res = await fetch(`${BACKEND_HTTP_URL}/ram`);
    if (!res.ok) return null;
    return (await res.json()) as RamData;
  } catch {
    return null;
  }
}

export function parseAccelerationFromRam(
  ram: RamData | null,
  identifier: string
): { series: TimeSeriesPoint[]; current: number | null; hasData: boolean } {
  if (!ram?.[identifier]) {
    return { series: [], current: null, hasData: false };
  }

  const entries = ram[identifier] as Record<string, RamEntry>;
  const series = Object.entries(entries)
    .map(([ts, entry]) => ({
      time: Number(ts),
      value: entry['가속도'],
    }))
    .filter(
      (p): p is TimeSeriesPoint =>
        p.value != null && Number.isFinite(p.value as number)
    )
    .map((p) => ({ time: p.time, value: p.value as number }))
    .sort((a, b) => a.time - b.time);

  const current = series.length > 0 ? series[series.length - 1].value : null;
  return { series, current, hasData: series.length > 0 };
}

export function msToKmh(ms: number): number {
  return ms * 3.6;
}
