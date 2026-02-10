import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AuthPage from '@/components/auth/AuthPage';

const Index = () => {
  const { user, loading, forcePasswordChange } = useAuth();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const hashString = location.hash?.startsWith('#') ? location.hash.slice(1) : location.hash;
  const hashParams = new URLSearchParams(hashString || '');
  const isAuthFlow = (['invite','recovery','signup'].includes(searchParams.get('type') || '') || ['invite','recovery','signup'].includes(hashParams.get('type') || ''));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If user is authenticated and needs password change, ForcePasswordChange wrapper handles it
  // If user is authenticated and does NOT need password change, redirect to dashboard
  if (user && !forcePasswordChange) {
    return <Navigate to="/dashboard" replace />;
  }

  // Show auth page for unauthenticated users or during auth flows
  // (ForcePasswordChange wrapper in App.tsx handles the password change screen)
  return (
    <div className="auth-bg-animated min-h-screen flex items-center justify-center p-4">
      <AuthPage />
    </div>
  );
};

export default Index;
