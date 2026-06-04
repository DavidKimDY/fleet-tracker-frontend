import { getBackendWsUrl } from '../config';
import type { GpsPoint } from '../types/telemetry';

export type WsConnectionState = 'connecting' | 'connected' | 'disconnected';

type MessageHandler = (data: unknown) => void;
type StateHandler = (state: WsConnectionState) => void;

export class FleetWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;
  private messageHandler: MessageHandler | null = null;
  private stateHandler: StateHandler | null = null;

  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  onStateChange(handler: StateHandler): void {
    this.stateHandler = handler;
  }

  connect(): void {
    this.intentionalClose = false;
    this.open();
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.clearReconnect();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setState('disconnected');
  }

  send(payload: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  storeGps(identifier: string, gps: GpsPoint, time: number): void {
    this.send({
      action: 'store_gps',
      identifier,
      gps,
      time,
    });
  }

  getTelemetry(identifier: string): void {
    this.send({ action: 'get_telemetry', identifier });
  }

  private open(): void {
    this.setState('connecting');
    const ws = new WebSocket(getBackendWsUrl());
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.setState('connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        this.messageHandler?.(data);
      } catch {
        /* ignore malformed */
      }
    };

    ws.onclose = () => {
      this.ws = null;
      this.setState('disconnected');
      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  private scheduleReconnect(): void {
    this.clearReconnect();
    const delay = Math.min(1000 * 2 ** this.reconnectAttempt, 30_000);
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private setState(state: WsConnectionState): void {
    this.stateHandler?.(state);
  }
}
