import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Authorize from "./pages/Authorize";
import Token from "./pages/Token";
import Profile from "./pages/Profile";
import Docs from "./pages/Docs";
import NotFound from "./pages/NotFound";
import { Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { Loader2 } from "lucide-react";

function HomeRoute() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0d0f14" }}>
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/profile" replace />;
  }

  return <Landing />;
}

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0d0f14" }}>
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function GuestRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0d0f14" }}>
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  if (user) {
    const params = new URLSearchParams(location.search);
    if (params.has("client_id") && params.has("redirect_uri")) {
      return <Navigate to={`/authorize${location.search}`} replace />;
    }
    return <Navigate to="/profile" replace />;
  }

  return children;
}

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
          <Route path="/signup" element={<GuestRoute><Signup /></GuestRoute>} />
          <Route path="/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/authorize" element={<Authorize />} />
          <Route path="/token" element={<Token />} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/docs" element={<Docs />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
