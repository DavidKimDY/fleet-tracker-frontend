import L from 'leaflet';
import { useEffect, useRef } from 'react';
import type { GpsPoint } from '../types/telemetry';

type PathPoint = GpsPoint & { time: number };

type Props = {
  points: PathPoint[];
  identifier: string;
  waiting?: boolean;
};

/** 서울 시청 기준 — 사용자가 서울에만 있을 때 기본 뷰 */
const SEOUL_CENTER: L.LatLngExpression = [37.5665, 126.978];
const DEFAULT_ZOOM = 12;

const PATH_STYLE: L.PolylineOptions = {
  color: '#00ff88',
  weight: 3,
  opacity: 0.9,
};

const VEHICLE_STYLE: L.CircleMarkerOptions = {
  radius: 8,
  fillColor: '#00ff88',
  fillOpacity: 1,
  color: '#ffffff',
  weight: 2,
};

export function GpsPathView({ points, identifier, waiting }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pathLayerRef = useRef<L.Polyline | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);

  const latest = points[points.length - 1];
  const vehicle = latest ?? null;

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || mapRef.current) return;

    const map = L.map(container, {
      center: SEOUL_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    const resizeId = requestAnimationFrame(() => map.invalidateSize());

    return () => {
      cancelAnimationFrame(resizeId);
      map.remove();
      mapRef.current = null;
      pathLayerRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    pathLayerRef.current?.remove();
    pathLayerRef.current = null;
    markerRef.current?.remove();
    markerRef.current = null;

    if (points.length === 0) {
      map.setView(SEOUL_CENTER, DEFAULT_ZOOM);
      return;
    }

    const latLngs: L.LatLngExpression[] = points.map((p) => [p.lat, p.lng]);

    if (points.length >= 2) {
      const line = L.polyline(latLngs, PATH_STYLE).addTo(map);
      pathLayerRef.current = line;
      map.fitBounds(line.getBounds(), { padding: [48, 48], maxZoom: 16 });
    } else {
      map.setView(latLngs[0], 15);
    }

    const last = points[points.length - 1];
    markerRef.current = L.circleMarker([last.lat, last.lng], VEHICLE_STYLE).addTo(
      map
    );
  }, [points]);

  return (
    <section className="gps-view">
      <div className="gps-view__map-wrap">
        <div ref={mapContainerRef} className="gps-view__map" aria-label="GPS path map" />
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
            <dd>{vehicle?.lat.toFixed(4) ?? '—'}</dd>
          </div>
          <div>
            <dt>LONGITUDE</dt>
            <dd>{vehicle?.lng.toFixed(4) ?? '—'}</dd>
          </div>
        </dl>
      </aside>
    </section>
  );
}
