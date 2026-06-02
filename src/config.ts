export const BACKEND_HOST = '127.0.0.1';
export const BACKEND_PORT = 8000;
export const BACKEND_WS_URL = `ws://${BACKEND_HOST}:${BACKEND_PORT}/ws`;
export const BACKEND_HTTP_URL = `http://${BACKEND_HOST}:${BACKEND_PORT}`;

export const COOKIE_NAME = 'fleet_tracker_id';
export const COOKIE_MAX_AGE_DAYS = 30;

export const GPS_SEND_INTERVAL_MS = 1000;
export const POLL_INTERVAL_MS = 1000;
