import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { AddMeal } from './pages/AddMeal';
import { EditMeal } from './pages/EditMeal';
import { Profile } from './pages/Profile';
import { Login } from './pages/Login';
import { Onboarding } from './pages/Onboarding';
import { Success } from './pages/Success';
import { Upgrade } from './pages/Upgrade';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-gold/10 border-t-gold rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="add-meal" element={<ProtectedRoute><AddMeal /></ProtectedRoute>} />
            <Route path="edit-meal/:id" element={<ProtectedRoute><EditMeal /></ProtectedRoute>} />
            <Route path="profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
            <Route path="success" element={<ProtectedRoute><Success /></ProtectedRoute>} />
            <Route path="upgrade" element={<ProtectedRoute><Upgrade /></ProtectedRoute>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
