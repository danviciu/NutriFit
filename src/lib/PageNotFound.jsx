import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PageNotFound() {
  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle>Pagina nu exista</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600">Ruta cautata nu a fost gasita.</p>
        <Link to="/">
          <Button>Inapoi la Home</Button>
        </Link>
      </CardContent>
    </Card>
  );
}
