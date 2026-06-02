import { useMemo } from 'react';
import type { GpsPoint } from '../types/telemetry';

type PathPoint = GpsPoint & { time: number };

type Props = {
  points: PathPoint[];
  identifier: string;
  waiting?: boolean;
};

const VIEW_SIZE = 400;
const PAD = 40;

function projectPoints(points: PathPoint[]) {
  if (points.length === 0) return { pathD: '', vehicle: null as GpsPoint | null, heading: 0 };

  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = maxLat - minLat || 0.0001;
  const lngSpan = maxLng - minLng || 0.0001;

  const inner = VIEW_SIZE - PAD * 2;
  const toXY = (p: GpsPoint) => ({
    x: PAD + ((p.lng - minLng) / lngSpan) * inner,
    y: PAD + (1 - (p.lat - minLat) / latSpan) * inner,
  });

  const projected = points.map((p) => ({ ...toXY(p), raw: p }));
  const pathD = projected
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  const last = projected[projected.length - 1];
  const prev = projected[Math.max(0, projected.length - 2)];
  const heading =
    Math.atan2(last.y - prev.y, last.x - prev.x) * (180 / Math.PI);

  return {
    pathD,
    vehicle: { lat: last.raw.lat, lng: last.raw.lng },
    vehicleXY: { x: last.x, y: last.y },
    heading,
  };
}

export function GpsPathView({ points, identifier, waiting }: Props) {
  const latest = points[points.length - 1];
  const { pathD, vehicle, vehicleXY, heading } = useMemo(
    () => projectPoints(points),
    [points]
  );

  return (
    <section className="gps-view">
      <div className="gps-view__canvas-wrap">
        <svg
          className="gps-view__canvas"
          viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
          role="img"
          aria-label="GPS path"
        >
          <defs>
            <pattern
              id="grid"
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 20 0 L 0 0 0 20"
                fill="none"
                stroke="rgba(0, 255, 136, 0.08)"
                strokeWidth="0.5"
              />
            </pattern>
            <radialGradient id="radarGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(0, 255, 136, 0.06)" />
              <stop offset="100%" stopColor="rgba(0, 0, 0, 0)" />
            </radialGradient>
          </defs>
          <rect width="100%" height="100%" fill="#0d1210" />
          <rect width="100%" height="100%" fill="url(#grid)" />
          <circle
            cx={VIEW_SIZE / 2}
            cy={VIEW_SIZE / 2}
            r={VIEW_SIZE / 2 - 10}
            fill="url(#radarGlow)"
            stroke="rgba(0, 255, 136, 0.15)"
            strokeWidth="1"
          />
          <circle
            cx={VIEW_SIZE / 2}
            cy={VIEW_SIZE / 2}
            r={(VIEW_SIZE / 2 - 10) * 0.66}
            fill="none"
            stroke="rgba(0, 255, 136, 0.08)"
            strokeWidth="1"
          />
          <circle
            cx={VIEW_SIZE / 2}
            cy={VIEW_SIZE / 2}
            r={(VIEW_SIZE / 2 - 10) * 0.33}
            fill="none"
            stroke="rgba(0, 255, 136, 0.08)"
            strokeWidth="1"
          />
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke="#00ff88"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                filter: 'drop-shadow(0 0 8px rgba(0, 255, 136, 0.5))',
              }}
            />
          )}
          {vehicleXY && (
            <g
              transform={`translate(${vehicleXY.x} ${vehicleXY.y}) rotate(${heading})`}
            >
              <rect
                x="-10"
                y="-6"
                width="20"
                height="12"
                rx="2"
                fill="#00ff88"
                style={{
                  filter: 'drop-shadow(0 0 10px rgba(0, 255, 136, 0.8))',
                }}
              />
              <polygon points="0,-14 4,-8 -4,-8" fill="#ffffff" />
            </g>
          )}
        </svg>
        {waiting && (
          <div className="gps-view__overlay">데이터 대기 중…</div>
        )}
      </div>

      <aside className="gps-view__identity">
        <h3 className="gps-view__identity-title">VEHICLE IDENTITY</h3>
        <dl className="gps-view__meta">
          <div>
            <dt>ID_KEY</dt>
            <dd>{identifier}</dd>
          </div>
          <div>
            <dt>LATITUDE</dt>
            <dd>{vehicle?.lat.toFixed(4) ?? latest?.lat.toFixed(4) ?? '—'}</dd>
          </div>
          <div>
            <dt>LONGITUDE</dt>
            <dd>{vehicle?.lng.toFixed(4) ?? latest?.lng.toFixed(4) ?? '—'}</dd>
          </div>
          <div>
            <dt>SAT_LOCKED</dt>
            <dd>—/12</dd>
          </div>
        </dl>
      </aside>

      <footer className="gps-view__footer">
        <span className="gps-view__signal">
          SIGNAL_STRENGTH
          <span className="gps-view__bars" aria-hidden>
            <i className="on" />
            <i className="on" />
            <i className="on" />
            <i />
          </span>
        </span>
        <span className="gps-view__kalman">KALMAN_FILTER</span>
        <span className="gps-view__toggle" aria-hidden>
          ON
        </span>
      </footer>
    </section>
  );
}
