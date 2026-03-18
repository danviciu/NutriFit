import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/AuthContext";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const { signUp, resendSignupConfirmation } = useAuth();
  const navigate = useNavigate();

  const onSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");

    try {
      const result = await signUp({ email, password });
      if (result?.session) {
        navigate("/wizard", { replace: true });
        return;
      }
      setInfo(
        "Cont creat. Verifica emailul (si folderul Spam) pentru confirmare. Dupa confirmare, autentifica-te.",
      );
    } catch (err) {
      const raw = String(err?.message || "");
      const normalized = raw.toLowerCase();
      if (normalized.includes("email rate limit exceeded")) {
        setError(
          "S-a atins limita de emailuri de confirmare pe proiectul Supabase. Incearca din nou mai tarziu sau mareste limita in Supabase Auth > Rate Limits.",
        );
      } else {
        setError(raw || "Creare cont esuata");
      }
    } finally {
      setLoading(false);
    }
  };

  const onResendConfirmation = async () => {
    setResending(true);
    setError("");
    try {
      await resendSignupConfirmation(email);
      setInfo("Emailul de confirmare a fost retrimis. Verifica inbox/spam.");
    } catch (err) {
      setError(String(err?.message || "Nu am putut retrimite emailul de confirmare."));
    } finally {
      setResending(false);
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
                <span className="text-white">NF</span>
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
                    type={showPassword ? "text" : "password"}
                    minLength={6}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="minimum 6 caractere"
                    required
                  />
                  <label className="ml-1 mt-2 flex items-center gap-2 text-xs text-slate-600">
                    <Checkbox checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} />
                    Arata parola
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-2xl bg-teal-600 py-4 font-bold text-white shadow-lg shadow-teal-900/10 transition-all hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={loading}
                >
                  {loading ? "Se creeaza..." : "Creeaza cont"}
                </button>
              </form>

              {info ? (
                <Alert className="mt-6">
                  <AlertTitle>Verificare email</AlertTitle>
                  <AlertDescription>{info}</AlertDescription>
                  <button
                    type="button"
                    className="mt-3 rounded-xl border border-teal-200 bg-white px-3 py-2 text-xs font-semibold text-teal-700 hover:bg-teal-50 disabled:opacity-60"
                    onClick={onResendConfirmation}
                    disabled={resending || !email}
                  >
                    {resending ? "Se retrimite..." : "Retrimite emailul de confirmare"}
                  </button>
                </Alert>
              ) : null}

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
