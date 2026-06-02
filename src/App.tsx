import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { getIdentifierFromCookie } from './lib/cookies';
import { DashboardPage } from './pages/DashboardPage';
import { IdentifierPage } from './pages/IdentifierPage';

function RootRedirect() {
  const id = getIdentifierFromCookie();
  return <Navigate to={id ? '/dashboard' : '/identify'} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/identify" element={<IdentifierPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
