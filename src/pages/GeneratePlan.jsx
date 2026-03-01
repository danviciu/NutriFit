import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { generatePlan, logUserEvent } from "@/lib/backend-api";
import { useAuth } from "@/lib/AuthContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function GeneratePlan() {
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    if (!accessToken) return;

    setLoading(true);
    setError("");

    try {
      await generatePlan(accessToken);
      logUserEvent(accessToken, {
        eventName: "generate_plan_debug",
        page: "/generate",
        metadata: { status: "success" },
      }).catch(() => {});
      navigate("/plan", { replace: true });
    } catch (err) {
      setError(err.message || "Nu s-a putut genera planul");
      logUserEvent(accessToken, {
        eventName: "generate_plan_debug",
        page: "/generate",
        metadata: { status: "failed", message: err.message || "unknown_error" },
      }).catch(() => {});
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate Plan (debug)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-slate-600">Endpoint backend: /generate-plan.</p>
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Eroare</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <Button onClick={run} disabled={loading}>
          {loading ? "Se genereaza..." : "Genereaza"}
        </Button>
      </CardContent>
    </Card>
  );
}

