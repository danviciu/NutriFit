import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/AuthContext";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const onSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      await signUp({ email, password });
      navigate("/wizard", { replace: true });
    } catch (err) {
      setError(err.message || "Creare cont esuata");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="-mx-4 -mt-6 min-h-[calc(100vh-5rem)] md:-mx-6">
      <div className="flex min-h-[calc(100vh-5rem)] w-full flex-col overflow-hidden lg:flex-row">
        <div className="relative hidden overflow-hidden bg-teal-700 px-20 lg:flex lg:w-1/2 lg:flex-col lg:justify-center">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute -left-[10%] -top-[10%] h-96 w-96 rounded-full bg-emerald-400 blur-3xl" />
            <div className="absolute -bottom-[10%] -right-[10%] h-96 w-96 rounded-full bg-amber-300 blur-3xl" />
          </div>
          <div className="relative z-10">
            <div className="mb-12 flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-400 shadow-lg shadow-emerald-500/20">
                <span className="text-white">✚</span>
              </div>
              <span className="text-2xl font-bold tracking-tight text-white">NutriFit</span>
            </div>
            <h1 className="mb-8 text-5xl font-extrabold leading-tight text-white">
              Date reale, decizii bune, <br />
              <span className="text-emerald-300">progres masurabil.</span>
            </h1>
            <p className="max-w-lg text-xl italic leading-relaxed text-emerald-50/80">
              Configurezi profilul in 4 pasi si obtii un plan vizual complet.
            </p>
          </div>
        </div>

        <div className="flex w-full items-center justify-center bg-slate-50 p-6 sm:p-12 lg:w-1/2">
          <div className="w-full max-w-md">
            <div className="rounded-3xl border border-white/70 bg-white/85 p-8 shadow-2xl shadow-slate-200/50 backdrop-blur sm:p-10">
              <div className="mb-10 text-center lg:text-left">
                <h2 className="mb-2 text-3xl font-bold text-slate-800">Creeaza cont</h2>
                <p className="text-slate-500">Porneste onboarding-ul NutriFit.</p>
              </div>

              <form className="space-y-6" onSubmit={onSubmit}>
                <div className="space-y-2">
                  <label className="ml-1 text-sm font-semibold text-slate-700">Adresa de email</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="nume@exemplu.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="ml-1 text-sm font-semibold text-slate-700">Parola</label>
                  <Input
                    type="password"
                    minLength={6}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="minimum 6 caractere"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-2xl bg-teal-600 py-4 font-bold text-white shadow-lg shadow-teal-900/10 transition-all hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={loading}
                >
                  {loading ? "Se creeaza..." : "Creeaza cont"}
                </button>
              </form>

              {error ? (
                <Alert variant="destructive" className="mt-6">
                  <AlertTitle>Eroare</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <p className="mt-10 text-center text-sm text-slate-500">
                Ai deja cont?
                <Link to="/login" className="ml-1 font-bold text-teal-700 hover:underline">
                  Autentifica-te
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
