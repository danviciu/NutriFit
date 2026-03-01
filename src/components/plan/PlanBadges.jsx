import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default function PlanBadges({ hasLabs }) {
  return (
    <Card className="neo-border rounded-3xl">
      <CardContent className="flex flex-wrap items-center gap-2 pt-6">
        <Badge variant="soft" className="bg-emerald-100 text-emerald-800">Profil personal</Badge>
        <Badge variant="soft" className="bg-sky-100 text-sky-800">Preferinte aplicate</Badge>
        <Badge variant="soft" className="bg-amber-100 text-amber-800">
          {hasLabs ? "Analize folosite" : "Analize folosite (auto)"}
        </Badge>
      </CardContent>
    </Card>
  );
}
