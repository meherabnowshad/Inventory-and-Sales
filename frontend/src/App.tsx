import { CategoriesPage } from './pages/CategoriesPage';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { MainLayout } from './components/layout/MainLayout';
import { DashboardPage } from './pages/DashboardPage';
import { InventoryPage } from './pages/InventoryPage';
import { SalesPage } from './pages/SalesPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { NoAccessPage } from './pages/NoAccessPage';
import { StaffPage } from './pages/StaffPage';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Authentication Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Core Authenticated Routes (Protected by Auth & RBAC) */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<MainLayout />}>
              {/* Administrator Only: Dashboard (FR-AUTH-07) */}
              <Route element={<ProtectedRoute allowedRoles={['Administrator']} />}>
                <Route index element={<DashboardPage />} />
                <Route path="staff" element={<StaffPage />} />
              </Route>

              {/* All Roles: Inventory (Admin, Sales Staff, Store Staff) */}
              <Route
                element={
                  <ProtectedRoute allowedRoles={['Administrator', 'Sales Staff', 'Store Staff']} />
                }
              >
                <Route path="inventory" element={<InventoryPage />} />
              </Route>

              {/* All Roles: Categories (read-only list for everyone; write buttons come in 09.2/09.3) */}
              <Route
                element={
                  <ProtectedRoute allowedRoles={['Administrator', 'Sales Staff', 'Store Staff']} />
                }
              >
                <Route path="categories" element={<CategoriesPage />} />
              </Route>

              {/* Administrator & Sales Staff: Sales */}
              <Route element={<ProtectedRoute allowedRoles={['Administrator', 'Sales Staff']} />}>
                <Route path="sales" element={<SalesPage />} />
              </Route>

              {/* Standalone No-Access Page */}
              <Route path="no-access" element={<NoAccessPage />} />

              {/* Catch-all 404 Route */}
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>

          {/* Root fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
