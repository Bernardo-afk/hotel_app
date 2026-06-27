import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 10_000 } },
});

// Lazy placeholders (W2/W3/W4/W5 will fill these)
const CoordinatorDashboard = () => <div className="p-8 text-gray-500">Coordinator Dashboard (em construção)</div>;
const AdmDashboard = () => <div className="p-8 text-gray-500">ADM Dashboard (em construção)</div>;

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/coordinator/*"
            element={
              <ProtectedRoute allowedRoles={['COORDINATOR', 'ADM', 'MANAGER', 'SUPER_ADMIN']}>
                <CoordinatorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/adm/*"
            element={
              <ProtectedRoute allowedRoles={['ADM', 'MANAGER', 'SUPER_ADMIN']}>
                <AdmDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
