import { useCallback, useEffect, useRef, useState } from 'react';
import { AccelChart } from '../components/AccelChart';
import { DashboardLayout } from '../components/DashboardLayout';
import { GpsPathView } from '../components/GpsPathView';
import { ObserveIdentifierModal } from '../components/ObserveIdentifierModal';
import { VelocityChart } from '../components/VelocityChart';
import { POLL_INTERVAL_MS } from '../config';
import { getObservedIdentifier, setObservedIdentifier } from '../lib/observe';
import { parseTelemetryResponse } from '../lib/telemetry';
import { FleetWebSocket, type WsConnectionState } from '../lib/websocket';
import type { TimeSeriesPoint } from '../types/telemetry';

type PathPoint = { lat: number; lng: number; time: number };

type TelemetryStatus = 'idle' | 'waiting' | 'found' | 'not_found';

function emptyTelemetry() {
  return {
    pathPoints: [] as PathPoint[],
    speedSeries: [] as TimeSeriesPoint[],
    currentSpeed: null as number | null,
    accelSeries: [] as TimeSeriesPoint[],
    currentAccel: null as number | null,
    hasTelemetry: false,
    telemetryStatus: 'idle' as TelemetryStatus,
  };
}

export function DashboardPage() {
  const [observedId, setObservedId] = useState<string | null>(() =>
    getObservedIdentifier()
  );
  const [modalOpen, setModalOpen] = useState(() => !getObservedIdentifier());
  const [wsState, setWsState] = useState<WsConnectionState>('disconnected');
  const [pathPoints, setPathPoints] = useState<PathPoint[]>([]);
  const [speedSeries, setSpeedSeries] = useState<TimeSeriesPoint[]>([]);
  const [currentSpeed, setCurrentSpeed] = useState<number | null>(null);
  const [accelSeries, setAccelSeries] = useState<TimeSeriesPoint[]>([]);
  const [currentAccel, setCurrentAccel] = useState<number | null>(null);
  const [hasTelemetry, setHasTelemetry] = useState(false);
  const [telemetryStatus, setTelemetryStatus] =
    useState<TelemetryStatus>('idle');
  const [logs, setLogs] = useState<string[]>([]);

  const wsRef = useRef<FleetWebSocket | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const identifierRef = useRef(observedId);

  const appendLog = useCallback((line: string) => {
    const stamp = new Date().toLocaleTimeString('ko-KR', { hour12: false });
    setLogs((prev) => [`[${stamp}] ${line}`, ...prev].slice(0, 8));
  }, []);

  const clearTelemetry = useCallback(() => {
    const empty = emptyTelemetry();
    setPathPoints(empty.pathPoints);
    setSpeedSeries(empty.speedSeries);
    setCurrentSpeed(empty.currentSpeed);
    setAccelSeries(empty.accelSeries);
    setCurrentAccel(empty.currentAccel);
    setHasTelemetry(false);
  }, []);

  const pollTelemetry = useCallback(() => {
    const id = identifierRef.current;
    if (!id || !wsRef.current) return;

    wsRef.current.getTelemetry(id);
  }, []);

  const applyObservedId = useCallback(
    (id: string) => {
      setObservedIdentifier(id);
      identifierRef.current = id;
      setObservedId(id);
      setModalOpen(false);
      clearTelemetry();
      setTelemetryStatus('waiting');
      appendLog(`Observing vehicle: ${id}`);
      void pollTelemetry();
    },
    [appendLog, clearTelemetry, pollTelemetry]
  );

  useEffect(() => {
    identifierRef.current = observedId;
  }, [observedId]);

  useEffect(() => {
    const client = new FleetWebSocket();
    wsRef.current = client;

    client.onStateChange((state) => {
      setWsState(state);
      if (state === 'connected') {
        appendLog('WebSocket linked.');
        if (identifierRef.current) {
          setTelemetryStatus((prev) =>
            prev === 'idle' ? 'waiting' : prev
          );
          void pollTelemetry();
        }
        if (!pollTimerRef.current) {
          pollTimerRef.current = setInterval(() => {
            void pollTelemetry();
          }, POLL_INTERVAL_MS);
        }
      } else if (state === 'disconnected') {
        appendLog('WebSocket disconnected — reconnecting…');
      }
    });

    client.onMessage((data) => {
      const id = identifierRef.current;
      if (!id) return;

      if (data && typeof data === 'object' && 'ok' in data && data.ok === true) {
        return;
      }

      if (
        data &&
        typeof data === 'object' &&
        'error' in data &&
        data.error === 'not found'
      ) {
        clearTelemetry();
        setTelemetryStatus('not_found');
        appendLog(`No data for vehicle: ${id}`);
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
        setTelemetryStatus('found');
      }
    });

    client.connect();

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      client.disconnect();
      wsRef.current = null;
    };
  }, [appendLog, clearTelemetry, pollTelemetry]);

  const waiting =
    !!observedId &&
    !hasTelemetry &&
    wsState === 'connected' &&
    telemetryStatus === 'waiting';

  const notFound = telemetryStatus === 'not_found' && !!observedId;

  const overlayMessage = !observedId
    ? '관찰할 차량 식별자를 선택하세요.'
    : notFound
      ? `「${observedId}」 차량의 텔레메트리 데이터가 없습니다.`
      : null;

  const displayId = observedId ?? '—';

  return (
    <>
      <DashboardLayout
        headerExtra={
          <button
            type="button"
            className="dashboard__observe-btn"
            onClick={() => setModalOpen(true)}
          >
            {observedId ? `차량: ${observedId}` : '차량 식별자 선택'}
          </button>
        }
        sidebar={
          <>
            {notFound && (
              <p className="dashboard__alert" role="status">
                「{observedId}」에 대한 데이터가 서버에 없습니다. /fleet에서
                GPS 전송이 시작되었는지 확인하세요.
              </p>
            )}
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
        }
      >
        <GpsPathView
          points={pathPoints}
          identifier={displayId}
          waiting={waiting}
          overlayMessage={overlayMessage}
        />
      </DashboardLayout>

      <ObserveIdentifierModal
        open={modalOpen}
        initialValue={observedId ?? ''}
        required={!observedId}
        onClose={() => setModalOpen(false)}
        onSubmit={applyObservedId}
      />
    </>
  );
}
