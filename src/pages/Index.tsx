import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AuthPage from '@/components/auth/AuthPage';

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If user is authenticated, redirect to dashboard
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  // If not authenticated, show auth page directly
  return <AuthPage />;

};

export default Index;
