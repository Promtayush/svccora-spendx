import "./i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Claims from "./pages/Claims";
import AddClaim from "./pages/AddClaims";
import DashboardLayout from "./components/layout/DashboardLayout";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleRoute from "./components/RoleRoute";
import Approvals from "./pages/Approvals";
import Payments from "./pages/Payments";
import AdminUsers from "./pages/AdminUsers";
import AllClaims from "./pages/AllClaims";
import Settings from "./pages/Settings";
import { Toaster } from "./components/ui/sonner";
import { getToken } from "@/lib/auth";
import { AuthProvider } from "./context/AuthContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <Toaster />
        <Routes>
          <Route path="/" element={<Navigate to="/auth" replace />} />
          <Route
            path="/auth"
            element={getToken() ? <Navigate to="/dashboard" replace /> : <Auth />}
          />
          <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/claims" element={<Claims />} />
            <Route path="/addclaims" element={<AddClaim />} />
            <Route path="/claims/new" element={<AddClaim />} />
            <Route
              path="/all-claims"
              element={<RoleRoute allowedRoles={["MANAGER", "FINANCE", "ADMIN"]}><AllClaims /></RoleRoute>}
            />
            <Route
              path="/approvals"
              element={<RoleRoute allowedRoles={["MANAGER", "FINANCE", "ADMIN"]}><Approvals /></RoleRoute>}
            />
            <Route
              path="/payments"
              element={<RoleRoute allowedRoles={["FINANCE", "ADMIN"]}><Payments /></RoleRoute>}
            />
            <Route
              path="/admin/users"
              element={<RoleRoute allowedRoles={["ADMIN"]}><AdminUsers /></RoleRoute>}
            />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
