import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { logUserEvent } from "@/lib/backend-api";
import { useAuth } from "@/lib/AuthContext";

export default function NavigationTracker() {
  const location = useLocation();
  const { accessToken, user } = useAuth();
  const lastTrackedPathRef = useRef("");

  useEffect(() => {
    window.__nutrifit_last_route = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    if (!user || !accessToken) return;

    const routeKey = `${location.pathname}${location.search}${location.hash}`;
    if (lastTrackedPathRef.current === routeKey) return;
    lastTrackedPathRef.current = routeKey;

    logUserEvent(accessToken, {
      eventName: "page_view",
      page: location.pathname,
      metadata: {
        search: location.search || "",
        hash: location.hash || "",
      },
    }).catch(() => {
      // Telemetry failure must never block navigation.
    });
  }, [accessToken, user, location.pathname, location.search, location.hash]);

  return null;
}
