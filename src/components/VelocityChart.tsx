import type { TimeSeriesPoint } from '../types/telemetry';
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
        <span className="panel__value panel__value--green">{display}</span>
      </header>
      {waiting ? (
        <p className="panel__hint">데이터 대기 중…</p>
      ) : (
        <SparklineChart
          data={series}
          color="#00ff88"
          glowColor="rgba(0, 255, 136, 0.6)"
          smooth
        />
      )}
    </section>
  );
}
