import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { FleetVehicleHero } from '../components/FleetVehicleHero';
import { GPS_SEND_INTERVAL_MS } from '../config';
import {
  getIdentifierFromCookie,
  isValidIdentifier,
  setIdentifierCookie,
} from '../lib/cookies';
import {
  geoErrorMessage,
  getCurrentGeoPosition,
  type GeoErrorCode,
} from '../lib/geolocation';
import { generateIdentifier } from '../lib/identifier';
import { FleetWebSocket, type WsConnectionState } from '../lib/websocket';

type GeoStatus = 'loading' | 'ready' | 'denied' | 'error';

function FleetIdentifierForm({ onComplete }: { onComplete: (id: string) => void }) {
  const existing = getIdentifierFromCookie();
  const [value, setValue] = useState(() => existing ?? generateIdentifier(12));
  const [error, setError] = useState<string | null>(null);

  function handleChange(next: string) {
    setValue(next);
    if (next.length === 0) {
      setError('식별자는 1자 이상이어야 합니다.');
    } else if (!isValidIdentifier(next)) {
      setError('영문 대·소문자와 숫자만 사용할 수 있습니다.');
    } else {
      setError(null);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isValidIdentifier(value)) {
      setError('유효한 식별자를 입력하세요.');
      return;
    }
    setIdentifierCookie(value);
    onComplete(value);
  }

  return (
    <div className="fleet-page">
      <FleetVehicleHero />
      <div className="fleet-page__overlay">
        <form className="fleet-page__card" onSubmit={handleSubmit}>
          <h1 className="fleet-page__title">Fleet GPS</h1>
          <p className="fleet-page__desc">
            차량 식별자를 입력하면 위치 정보가 서버로 전송됩니다.
          </p>
          <label htmlFor="fleet-id" className="fleet-page__label">
            VEHICLE ID
          </label>
          <input
            id="fleet-id"
            className={`fleet-page__input${error ? ' fleet-page__input--error' : ''}`}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          {error && (
            <p className="fleet-page__error" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="fleet-page__submit"
            disabled={!!error}
          >
            START TRANSMISSION
          </button>
        </form>
      </div>
    </div>
  );
}

function FleetGpsSender({ identifier }: { identifier: string }) {
  const [wsState, setWsState] = useState<WsConnectionState>('disconnected');
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('loading');
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);

  const wsRef = useRef<FleetWebSocket | null>(null);
  const gpsSendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const identifierRef = useRef(identifier);

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
        setLastSentAt(Date.now());
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

    setGeoStatus('loading');
    void sendOnce();
    gpsSendTimerRef.current = setInterval(() => {
      void sendOnce();
    }, GPS_SEND_INTERVAL_MS);
  }, [stopGpsSend]);

  useEffect(() => {
    identifierRef.current = identifier;

    const client = new FleetWebSocket();
    wsRef.current = client;

    client.onStateChange((state) => {
      setWsState(state);
      if (state === 'connected') {
        startGpsSend();
      } else if (state === 'disconnected') {
        stopGpsSend();
      }
    });

    client.connect();

    return () => {
      stopGpsSend();
      client.disconnect();
      wsRef.current = null;
    };
  }, [identifier, startGpsSend, stopGpsSend]);

  const transmitting =
    wsState === 'connected' && geoStatus === 'ready' && lastSentAt !== null;

  return (
    <div className="fleet-page">
      <FleetVehicleHero active={transmitting} />
      <div className="fleet-page__status" role="status">
        <p className="fleet-page__status-id">{identifier}</p>
        <ul className="fleet-page__status-list">
          <li
            className={`fleet-page__status-item fleet-page__status-item--${wsState}`}
          >
            <span className="fleet-page__status-dot" aria-hidden />
            {wsState === 'connected'
              ? '서버 연결됨'
              : wsState === 'connecting'
                ? '서버 연결 중…'
                : '서버 재연결 중…'}
          </li>
          <li
            className={`fleet-page__status-item fleet-page__status-item--${geoStatus}`}
          >
            <span className="fleet-page__status-dot" aria-hidden />
            {geoStatus === 'loading' && '위치 확인 중…'}
            {geoStatus === 'ready' && 'GPS 전송 중 (1초 간격)'}
            {geoStatus === 'denied' && (geoMessage ?? '위치 권한 거부')}
            {geoStatus === 'error' && (geoMessage ?? '위치 오류')}
          </li>
        </ul>
        {geoStatus === 'denied' && (
          <button
            type="button"
            className="fleet-page__retry"
            onClick={() => startGpsSend()}
          >
            위치 권한 재시도
          </button>
        )}
      </div>
    </div>
  );
}

export function FleetPage() {
  const [identifier, setIdentifier] = useState<string | null>(() =>
    getIdentifierFromCookie()
  );

  if (!identifier) {
    return <FleetIdentifierForm onComplete={setIdentifier} />;
  }

  return <FleetGpsSender identifier={identifier} />;
}
