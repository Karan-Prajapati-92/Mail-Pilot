import { Navigate, Route, Routes } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';
import { useAuth } from './context.jsx';
import Auth from './pages/Auth.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Workspace from './pages/Workspace.jsx';
import ClientView from './pages/ClientView.jsx';

function Splash() {
  return (
    <div className="grid min-h-screen place-items-center text-mute">
      <LoaderCircle className="animate-spin" size={28} aria-label="Loading" />
    </div>
  );
}

function Protected({ children, needsOnboarding = true }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace />;
  if (needsOnboarding && !user.onboarded) return <Navigate to="/onboarding" replace />;
  return children;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (user) return <Navigate to={user.onboarded ? '/app' : '/onboarding'} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><Auth /></PublicOnly>} />
      <Route path="/onboarding" element={<Protected needsOnboarding={false}><Onboarding /></Protected>} />
      <Route path="/app" element={<Protected><Workspace /></Protected>} />
      <Route path="/client" element={<Protected><ClientView /></Protected>} />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}
