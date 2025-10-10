import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AuthPage from '@/components/auth/AuthPage';

const Index = () => {
  const { user, loading } = useAuth();
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

  // Show password setup/auth flows when coming from invite/recovery links
  if (isAuthFlow) {
    return <AuthPage />;
  }

  // If user is authenticated, redirect to dashboard
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  // If not authenticated, show auth page directly
  return <AuthPage />;

};

export default Index;
