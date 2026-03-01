import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getNotificationStats } from "@/lib/backend-api";
import NavigationTracker from "@/lib/NavigationTracker";
import { useAuth } from "@/lib/AuthContext";

export default function Layout() {
  const location = useLocation();
  const { user, signOut, accessToken } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const framelessRoutes = ["/login", "/signup"];
  const isFrameless = framelessRoutes.some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`));

  const isActive = (path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const navClass = (path) =>
    isActive(path)
      ? "relative rounded-full px-4 py-2 font-bold text-teal-900 after:absolute after:-bottom-0.5 after:left-4 after:right-4 after:h-0.5 after:rounded-full after:bg-teal-500"
      : "rounded-full px-4 py-2 text-slate-700 transition hover:bg-white/65 hover:text-teal-700";

  useEffect(() => {
    if (!user || !accessToken) return;

    let mounted = true;
    const syncUnreadCount = async () => {
      try {
        const response = await getNotificationStats(accessToken);
        if (!mounted) return;
        setUnreadCount(Number(response.unreadCount) || 0);
      } catch {
        if (!mounted) return;
        setUnreadCount(0);
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncUnreadCount();
      }
    };

    syncUnreadCount();
    const intervalId = window.setInterval(syncUnreadCount, 45000);
    window.addEventListener("focus", syncUnreadCount);
    window.addEventListener("nutrifit:notifications-changed", syncUnreadCount);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", syncUnreadCount);
      window.removeEventListener("nutrifit:notifications-changed", syncUnreadCount);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [user, accessToken, location.pathname]);

  return (
    <div className={`app-shell relative min-h-screen ${isFrameless ? "app-shell--frameless" : ""}`}>
      <NavigationTracker />
      {!isFrameless ? <div className="pointer-events-none absolute inset-0 animated-grid-bg opacity-70" /> : null}

      {!isFrameless ? (
        <header className="sticky top-0 z-30 px-3 py-3 md:px-6">
          <div className="glass-panel neo-border mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 rounded-3xl px-4 py-3">
            <Link to="/" className="group flex items-center gap-3">
              <img
                src="/logo-mark.svg"
                alt="NutriFit logo"
                className="h-11 w-11 rounded-2xl shadow-[0_12px_20px_rgba(13,148,136,0.32)]"
              />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700/90">NutriFit Lab</p>
                <p className="text-lg font-semibold text-slate-900">Nutrition Intelligence</p>
              </div>
            </Link>

            <nav className="flex flex-wrap items-center gap-2 text-sm">
              <Link to="/" className={navClass("/")}>Acasa</Link>
              <Link to="/discover" className={navClass("/discover")}>Discover</Link>
              {user ? (
                <>
                  <Link to="/wizard" className={navClass("/wizard")}>Profil</Link>
                  <Link to="/plan" className={navClass("/plan")}>Plan personalizat</Link>
                  <Link to="/progress" className={navClass("/progress")}>Progres</Link>
                  <Link to="/notifications" className={navClass("/notifications")}>
                    <span className="inline-flex items-center gap-2">
                      <span>Notificari</span>
                      {unreadCount > 0 ? (
                        <span
                          className={`grid min-w-5 place-content-center rounded-full px-1 text-[11px] font-semibold ${
                            isActive("/notifications") ? "bg-white text-emerald-700" : "bg-rose-500 text-white"
                          }`}
                        >
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                  <span className="badge-pill">Cont activ</span>
                  <Button
                    size="sm"
                    className="bg-slate-900 text-white hover:bg-slate-800"
                    onClick={async () => {
                      await signOut();
                    }}
                  >
                    Logout
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/login" className={navClass("/login")}>Login</Link>
                  <Link to="/signup" className={navClass("/signup")}>Signup</Link>
                  <span className="badge-pill">Trial mode</span>
                </>
              )}
            </nav>
          </div>
        </header>
      ) : null}

      <main className={`mx-auto w-full px-4 pb-8 pt-4 md:px-6 md:pt-6 ${isFrameless ? "max-w-none" : "max-w-6xl"}`}>
        <Outlet />
      </main>
    </div>
  );
}
