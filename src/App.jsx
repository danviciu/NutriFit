import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

const Layout = lazy(() => import("@/Layout"));
const Home = lazy(() => import("@/pages/Home"));
const Login = lazy(() => import("@/pages/Login"));
const Signup = lazy(() => import("@/pages/Signup"));
const Wizard = lazy(() => import("@/pages/Wizard"));
const ViewPlan = lazy(() => import("@/pages/ViewPlan"));
const GeneratePlan = lazy(() => import("@/pages/GeneratePlan"));
const Discover = lazy(() => import("@/pages/Discover"));
const DiscoverArticle = lazy(() => import("@/pages/DiscoverArticle"));
const ProgressCenter = lazy(() => import("@/pages/ProgressCenter"));
const NotificationsCenter = lazy(() => import("@/pages/NotificationsCenter"));
const PageNotFound = lazy(() => import("@/lib/PageNotFound"));

function PageSkeleton() {
  return (
    <div className="glass-panel mx-auto w-full max-w-2xl animate-pulse space-y-4 rounded-2xl p-6 shadow-sm">
      <div className="h-6 w-1/3 rounded-md bg-slate-200" />
      <div className="h-32 w-full rounded-xl bg-slate-100" />
      <div className="h-4 w-2/3 rounded bg-slate-200" />
      <div className="h-4 w-1/2 rounded bg-slate-200" />
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageSkeleton />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageSkeleton />;
  if (user) return <Navigate to="/wizard" replace />;
  return children;
}

export default function App() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <Login />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/signup"
            element={
              <PublicOnlyRoute>
                <Signup />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/wizard"
            element={
              <ProtectedRoute>
                <Wizard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/plan"
            element={
              <ProtectedRoute>
                <ViewPlan />
              </ProtectedRoute>
            }
          />
          <Route
            path="/generate"
            element={
              <ProtectedRoute>
                <GeneratePlan />
              </ProtectedRoute>
            }
          />
          <Route path="/discover" element={<Discover />} />
          <Route path="/discover/:slug" element={<DiscoverArticle />} />
          <Route
            path="/progress"
            element={
              <ProtectedRoute>
                <ProgressCenter />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <NotificationsCenter />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<PageNotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
