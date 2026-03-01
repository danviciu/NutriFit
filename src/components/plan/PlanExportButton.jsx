import { PDFDownloadLink } from "@react-pdf/renderer";
import { Button } from "@/components/ui/button";
import { logUserEvent } from "@/lib/backend-api";
import { useAuth } from "@/lib/AuthContext";
import PlanPdf from "@/components/plan/PlanPdf";

export default function PlanExportButton({ profile, plan }) {
  const { accessToken } = useAuth();

  return (
    <PDFDownloadLink
      document={<PlanPdf profile={profile} plan={plan} />}
      fileName="nutrifit-plan.pdf"
      onClick={() => {
        if (!accessToken) return;
        logUserEvent(accessToken, {
          eventName: "plan_export_pdf",
          page: "/plan",
          metadata: { source: "plan_export_button" },
        }).catch(() => {});
      }}
    >
      {({ loading: pdfLoading }) => (
        <Button variant="secondary" className="bg-white text-emerald-700 hover:bg-emerald-50">
          {pdfLoading ? "Pregatire PDF..." : "Export PDF vizual"}
        </Button>
      )}
    </PDFDownloadLink>
  );
}
