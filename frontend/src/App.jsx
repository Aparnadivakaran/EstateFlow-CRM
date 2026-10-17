// Decides what to show: loading → login → the app with its routes.
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useApp } from "./context.jsx";
import Layout from "./components/Layout.jsx";
import { ErrorState, Loading } from "./components/ui.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Leads from "./pages/Leads.jsx";
import LeadDetail from "./pages/LeadDetail.jsx";
import { Properties, ProjectDetail } from "./pages/Properties.jsx";
import Bookings from "./pages/Bookings.jsx";
import Team from "./pages/Team.jsx";

function NotFound() {
  const navigate = useNavigate();
  return <div className="card"><ErrorState error={{ message: "That page doesn't exist." }} onRetry={() => navigate("/")} /></div>;
}

export default function App() {
  const { user, booting, bootError } = useApp();

  if (booting) return <div className="center-page"><Loading /></div>;
  if (bootError) return <div className="center-page"><ErrorState error={bootError} onRetry={() => location.reload()} /></div>;
  if (!user) return <Login />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="leads" element={<Leads />} />
        <Route path="leads/:id" element={<LeadDetail />} />
        <Route path="properties" element={<Properties />} />
        <Route path="properties/:id" element={<ProjectDetail />} />
        <Route path="bookings" element={<Bookings />} />
        <Route path="team" element={user.role === "admin" ? <Team /> : <Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
