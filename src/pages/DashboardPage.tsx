import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AccelChart } from '../components/AccelChart';
import { DashboardLayout } from '../components/DashboardLayout';
import { GpsPathView } from '../components/GpsPathView';
import { VelocityChart } from '../components/VelocityChart';
import { GPS_SEND_INTERVAL_MS, POLL_INTERVAL_MS } from '../config';
import { getIdentifierFromCookie } from '../lib/cookies';
import {
  geoErrorMessage,
  getCurrentGeoPosition,
  type GeoErrorCode,
} from '../lib/geolocation';
import { parseTelemetryResponse } from '../lib/telemetry';
import { FleetWebSocket, type WsConnectionState } from '../lib/websocket';
import type { TimeSeriesPoint } from '../types/telemetry';

type PathPoint = { lat: number; lng: number; time: number };

export function DashboardPage() {
  const identifier = getIdentifierFromCookie();
  const [wsState, setWsState] = useState<WsConnectionState>('disconnected');
  const [pathPoints, setPathPoints] = useState<PathPoint[]>([]);
  const [speedSeries, setSpeedSeries] = useState<TimeSeriesPoint[]>([]);
  const [currentSpeed, setCurrentSpeed] = useState<number | null>(null);
  const [accelSeries, setAccelSeries] = useState<TimeSeriesPoint[]>([]);
  const [currentAccel, setCurrentAccel] = useState<number | null>(null);
  const [hasTelemetry, setHasTelemetry] = useState(false);
  const [geoStatus, setGeoStatus] = useState<
    'loading' | 'ready' | 'denied' | 'error'
  >('loading');
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const wsRef = useRef<FleetWebSocket | null>(null);
  const gpsSendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const identifierRef = useRef(identifier);

  const appendLog = useCallback((line: string) => {
    const stamp = new Date().toLocaleTimeString('ko-KR', { hour12: false });
    setLogs((prev) => [`[${stamp}] ${line}`, ...prev].slice(0, 8));
  }, []);

  const stopGpsSend = useCallback(() => {
    if (gpsSendTimerRef.current) {
      clearInterval(gpsSendTimerRef.current);
      gpsSendTimerRef.current = null;
    }
  }, []);

  const startGpsSend = useCallback(() => {
    stopGpsSend();
    if (!identifierRef.current) return;

    const sendOnce = async () => {
      if (wsRef.current === null) return;
      try {
        const pos = await getCurrentGeoPosition();
        setGeoStatus('ready');
        setGeoMessage(null);
        wsRef.current.storeGps(identifierRef.current!, {
          lat: pos.lat,
          lng: pos.lng,
        }, pos.time);
      } catch (err) {
        const code = (err as { code?: GeoErrorCode }).code;
        if (code === 'permission_denied') {
          setGeoStatus('denied');
          setGeoMessage(geoErrorMessage(code));
          stopGpsSend();
        } else if (code) {
          setGeoStatus('error');
          setGeoMessage(geoErrorMessage(code));
        }
      }
    };

    void sendOnce();
    gpsSendTimerRef.current = setInterval(() => {
      void sendOnce();
    }, GPS_SEND_INTERVAL_MS);
  }, [stopGpsSend]);

  const pollTelemetry = useCallback(() => {
    const id = identifierRef.current;
    if (!id || !wsRef.current) return;

    wsRef.current.getTelemetry(id);
  }, []);

  useEffect(() => {
    if (!identifier) return;
    identifierRef.current = identifier;

    setGeoStatus('loading');
    appendLog('Requesting geolocation…');

    const client = new FleetWebSocket();
    wsRef.current = client;

    client.onStateChange((state) => {
      setWsState(state);
      if (state === 'connected') {
        appendLog('WebSocket linked.');
        startGpsSend();
        void pollTelemetry();
        if (!pollTimerRef.current) {
          pollTimerRef.current = setInterval(() => {
            void pollTelemetry();
          }, POLL_INTERVAL_MS);
        }
      } else if (state === 'disconnected') {
        stopGpsSend();
        appendLog('WebSocket disconnected — reconnecting…');
      }
    });

    client.onMessage((data) => {
      const id = identifierRef.current;
      if (!id) return;

      if (data && typeof data === 'object' && 'ok' in data && data.ok === true) {
        return;
      }

      const telemetry = parseTelemetryResponse(data, id);
      if (telemetry.hasData) {
        setPathPoints(telemetry.points);
        setSpeedSeries(telemetry.speedSeries);
        setCurrentSpeed(telemetry.currentSpeed);
        setAccelSeries(telemetry.accelSeries);
        setCurrentAccel(telemetry.currentAccel);
        setHasTelemetry(true);
      }

      if (
        data &&
        typeof data === 'object' &&
        'error' in data &&
        data.error === 'not found'
      ) {
        /* waiting for first store_gps */
      }
    });

    client.connect();

    return () => {
      stopGpsSend();
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      client.disconnect();
      wsRef.current = null;
    };
  }, [identifier, appendLog, pollTelemetry, startGpsSend, stopGpsSend]);

  if (!identifier) {
    return <Navigate to="/" replace />;
  }

  const waiting = !hasTelemetry && wsState === 'connected';
  const geoBlocked = geoStatus === 'denied';

  return (
    <DashboardLayout sidebar={
      <>
        <VelocityChart
          series={speedSeries}
          currentMs={currentSpeed}
          waiting={waiting}
        />
        <AccelChart
          series={accelSeries}
          current={currentAccel}
          waiting={waiting}
        />
        {(geoMessage || geoStatus === 'loading') && (
          <p className={`panel__geo panel__geo--${geoStatus}`} role="status">
            {geoStatus === 'loading'
              ? '위치 권한 확인 중…'
              : geoMessage}
          </p>
        )}
        {geoBlocked && (
          <button
            type="button"
            className="panel__retry"
            onClick={() => {
              setGeoStatus('loading');
              startGpsSend();
            }}
          >
            위치 권한 재시도
          </button>
        )}
        <section className="panel panel--log">
          <header className="panel__header">
            <span className="panel__label">System_Log_Stream</span>
          </header>
          <ul className="log-stream">
            {logs.length === 0 ? (
              <li className="log-stream__line log-stream__line--muted">
                awaiting events…
              </li>
            ) : (
              logs.map((line) => (
                <li key={line} className="log-stream__line">
                  {line}
                </li>
              ))
            )}
          </ul>
        </section>
      </>
    }>
      <GpsPathView
        points={pathPoints}
        identifier={identifier}
        waiting={waiting}
      />
    </DashboardLayout>
  );
}
