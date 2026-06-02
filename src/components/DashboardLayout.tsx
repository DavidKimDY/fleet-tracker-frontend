import type { ReactNode } from 'react';
import type { WsConnectionState } from '../lib/websocket';

type Props = {
  children: ReactNode;
  sidebar: ReactNode;
  wsState: WsConnectionState;
};

function connectionLabel(state: WsConnectionState): string {
  switch (state) {
    case 'connecting':
      return 'CONNECTING…';
    case 'connected':
      return 'LINKED';
    default:
      return 'RECONNECTING…';
  }
}

export function DashboardLayout({ children, sidebar, wsState }: Props) {
  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <span className="dashboard__brand">VIGILANT_OS_v1.0</span>
        <nav className="dashboard__tabs" aria-label="Main navigation">
          <span className="dashboard__tab dashboard__tab--active">
            TELEMETRY
          </span>
          <span className="dashboard__tab dashboard__tab--disabled">
            DIAGNOSTICS
          </span>
          <span className="dashboard__tab dashboard__tab--disabled">
            MISSION
          </span>
        </nav>
        <div className="dashboard__header-actions">
          <span
            className={`dashboard__link-status dashboard__link-status--${wsState}`}
          >
            {connectionLabel(wsState)}
          </span>
        </div>
      </header>

      <div className="dashboard__body">
        <aside className="dashboard__sidebar" aria-label="Tools">
          <div className="sidebar-icon sidebar-icon--active" title="Dashboard">
            ◫
          </div>
          <div className="sidebar-icon sidebar-icon--muted" title="Path">
            ↝
          </div>
          <div className="sidebar-icon sidebar-icon--muted" title="Network">
            ⬡
          </div>
        </aside>

        <div className="dashboard__columns">
          <div className="dashboard__left">{sidebar}</div>
          <main className="dashboard__main">{children}</main>
        </div>
      </div>
    </div>
  );
}
