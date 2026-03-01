import { Card, CardContent } from "@/components/ui/card";

export default function UserNotRegisteredError() {
  return (
    <Card className="border-red-100 bg-red-50">
      <CardContent className="pt-6 text-sm text-red-700">Profil lipsa. Completeaza wizard-ul pentru a continua.</CardContent>
    </Card>
  );
}
