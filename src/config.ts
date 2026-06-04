const trimTrailingSlash = (url: string) => url.replace(/\/$/, '');

const explicitHttp = import.meta.env.VITE_BACKEND_HTTP_URL;
const explicitWs = import.meta.env.VITE_BACKEND_WS_URL;

/** 개발: 백엔드 직접. 프로덕션(nginx): 빈 문자열 → `/ram` same-origin */
export const BACKEND_HTTP_URL = trimTrailingSlash(
  explicitHttp ?? (import.meta.env.PROD ? '' : 'http://3.34.97.233:8000')
);

/** WebSocket URL — connect 시점에 호출 (프로덕션은 현재 호스트 기준 wss) */
export function getBackendWsUrl(): string {
  if (explicitWs) return explicitWs;
  if (import.meta.env.PROD && typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws`;
  }
  return 'ws://3.34.97.233:8000/ws';
}

export const COOKIE_NAME = 'fleet_tracker_id';
export const COOKIE_MAX_AGE_DAYS = 30;

export const GPS_SEND_INTERVAL_MS = 1000;
export const POLL_INTERVAL_MS = 1000;
