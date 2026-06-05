import type { TimeSeriesPoint } from '../types/telemetry';
import { ACCENT_PRIMARY, ACCENT_PRIMARY_RGB } from '../lib/theme';
import { msToKmh } from '../lib/telemetry';
import { SparklineChart } from './SparklineChart';

type Props = {
  series: TimeSeriesPoint[];
  currentMs: number | null;
  waiting?: boolean;
};

export function VelocityChart({ series, currentMs, waiting }: Props) {
  const display =
    currentMs != null ? `${msToKmh(currentMs).toFixed(1)} km/h` : '—';

  return (
    <section className="panel panel--velocity">
      <header className="panel__header">
        <span className="panel__label">VELOCITY PROFILE</span>
        <span className="panel__value panel__value--accent">{display}</span>
      </header>
      {waiting ? (
        <p className="panel__hint">데이터 대기 중…</p>
      ) : (
        <SparklineChart
          data={series}
          color={ACCENT_PRIMARY}
          glowColor={`rgba(${ACCENT_PRIMARY_RGB}, 0.6)`}
          smooth
        />
      )}
    </section>
  );
}
