import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  sidebar: ReactNode;
  headerExtra?: ReactNode;
};

export function DashboardLayout({ children, sidebar, headerExtra }: Props) {
  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <span className="dashboard__brand">Fleet Tracker</span>
        {headerExtra && (
          <div className="dashboard__header-actions">{headerExtra}</div>
        )}
      </header>

      <div className="dashboard__body">
        <div className="dashboard__columns">
          <div className="dashboard__left">{sidebar}</div>
          <main className="dashboard__main">{children}</main>
        </div>
      </div>
    </div>
  );
}
