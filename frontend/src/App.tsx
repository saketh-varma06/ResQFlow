import { Navigate, Route, Routes } from "react-router-dom";
import { Suspense, lazy } from "react";
import PublicLayout from "@/components/layout/PublicLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import CitizenLayout from "@/components/layout/CitizenLayout";
import { AdminLayout, ResponderLayout } from "@/components/layout/CommandLayout";
const LandingPage = lazy(() => import("@/pages/public/LandingPage"));
const AboutPage = lazy(() => import("@/pages/public/AboutPage"));
const LoginPage = lazy(() => import("@/pages/public/LoginPage"));
const RegisterPage = lazy(() => import("@/pages/public/RegisterPage"));
const CitizenDashboard = lazy(() => import("@/pages/citizen/CitizenDashboard"));
const SosPage = lazy(() => import("@/pages/citizen/SosPage"));
const ReportPage = lazy(() => import("@/pages/citizen/ReportPage"));
const SheltersPage = lazy(() => import("@/pages/citizen/SheltersPage"));
const CitizenMapPage = lazy(() => import("@/pages/citizen/MapPage"));
const AlertsPage = lazy(() => import("@/pages/citizen/AlertsPage"));
const RequestsPage = lazy(() => import("@/pages/citizen/RequestsPage"));
const NotificationsPage = lazy(() => import("@/pages/citizen/NotificationsPage"));
const CitizenMissingPage = lazy(() => import("@/pages/citizen/MissingPersonsPage"));
const MissingRegistryPage = lazy(() => import("@/pages/shared/MissingPersonsRegistryPage"));
const ProfilePage = lazy(() => import("@/pages/citizen/ProfilePage"));
const CommandCentre = lazy(() => import("@/pages/responder/CommandCentre"));
const AssignedPage = lazy(() => import("@/pages/responder/AssignedPage"));
const SosInboxPage = lazy(() => import("@/pages/responder/SosInboxPage"));
const ResponderMapPage = lazy(() => import("@/pages/responder/MapPage"));
const IncidentDetailsPage = lazy(() => import("@/pages/responder/IncidentDetailsPage"));
const HistoryPage = lazy(() => import("@/pages/responder/HistoryPage"));
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const IncidentManagement = lazy(() => import("@/pages/admin/IncidentManagement"));
const AdminMapPage = lazy(() => import("@/pages/admin/MapPage"));
const AlertManagement = lazy(() => import("@/pages/admin/AlertManagement"));
const ShelterManagement = lazy(() => import("@/pages/admin/ShelterManagement"));
const UserManagement = lazy(() => import("@/pages/admin/UserManagement"));
const ResponderManagement = lazy(() => import("@/pages/admin/ResponderManagement"));
const AnalyticsPage = lazy(() => import("@/pages/admin/AnalyticsPage"));
const AuditLogsPage = lazy(() => import("@/pages/admin/AuditLogsPage"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));

export default function App() {
  return (
    <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center p-8 text-sm text-muted-foreground" role="status">Loading ResQFlow…</div>}>
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
      </Route>
      <Route path="citizen" element={<ProtectedRoute role="CITIZEN"><CitizenLayout /></ProtectedRoute>}>
        <Route index element={<CitizenDashboard />} />
        <Route path="sos" element={<SosPage />} />
        <Route path="report" element={<ReportPage />} />
        <Route path="shelters" element={<SheltersPage />} />
        <Route path="map" element={<CitizenMapPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="requests" element={<RequestsPage />} />
        <Route path="missing" element={<CitizenMissingPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      <Route path="responder" element={<ProtectedRoute role="RESPONDER"><ResponderLayout /></ProtectedRoute>}>
        <Route index element={<CommandCentre />} />
        <Route path="assigned" element={<AssignedPage />} />
        <Route path="sos" element={<SosInboxPage />} />
        <Route path="missing" element={<MissingRegistryPage />} />
        <Route path="map" element={<ResponderMapPage />} />
        <Route path="incidents/:id" element={<IncidentDetailsPage />} />
        <Route path="history" element={<HistoryPage />} />
      </Route>
      <Route path="admin" element={<ProtectedRoute role="ADMIN"><AdminLayout /></ProtectedRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="incidents" element={<IncidentManagement />} />
        <Route path="map" element={<AdminMapPage />} />
        <Route path="alerts" element={<AlertManagement />} />
        <Route path="shelters" element={<ShelterManagement />} />
        <Route path="missing" element={<MissingRegistryPage />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="responders" element={<ResponderManagement />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="audit" element={<AuditLogsPage />} />
      </Route>
      <Route path="dashboard" element={<Navigate to="/citizen" replace />} />
      <Route path="*" element={<PublicLayout />}>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
    </Suspense>
  );
}
