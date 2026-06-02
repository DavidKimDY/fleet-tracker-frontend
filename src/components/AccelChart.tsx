import type { TimeSeriesPoint } from '../types/telemetry';
import { SparklineChart } from './SparklineChart';

type Props = {
  series: TimeSeriesPoint[];
  current: number | null;
  waiting?: boolean;
};

export function AccelChart({ series, current, waiting }: Props) {
  const display =
    current != null ? `${current.toFixed(1)} m/s²` : '—';

  return (
    <section className="panel panel--accel">
      <header className="panel__header">
        <span className="panel__label">ACCEL_VECTOR</span>
        <span className="panel__value panel__value--orange">{display}</span>
      </header>
      {waiting ? (
        <p className="panel__hint">데이터 대기 중…</p>
      ) : (
        <SparklineChart
          data={series}
          color="#ff8800"
          glowColor="rgba(255, 136, 0, 0.6)"
          smooth={false}
        />
      )}
    </section>
  );
}
