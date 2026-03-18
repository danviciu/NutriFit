import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { suggestLocal, suggestWithApi } from "@/api/ai";
import { getProfile, logUserEvent, upsertProfile, uploadLabs } from "@/lib/backend-api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import WizardStep1 from "@/wizard/WizardStep1";
import WizardStep2 from "@/wizard/WizardStep2";
import WizardStep3 from "@/wizard/WizardStep3";
import WizardStep4 from "@/wizard/WizardStep4";
import { profileSchema } from "@/lib/schema";

const defaultState = {
  sex: "male",
  age: 30,
  heightCm: 178,
  weightKg: 78,
  goal: "maintain",
  goalDeltaKcal: 0,
  activityLevel: "moderate",
  dietaryPrefs: "",
  allergies: "",
  lifestyle: "",
  labsText: "",
  labsFileName: "",
};

export default function Wizard() {
  const [error, setError] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [uploadingLabs, setUploadingLabs] = useState(false);
  const [extractedLabs, setExtractedLabs] = useState(null);

  const navigate = useNavigate();
  const { accessToken } = useAuth();

  const methods = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: defaultState,
    mode: "onChange",
  });

  const {
    handleSubmit,
    reset,
    watch,
    formState: { isSubmitting },
  } = methods;

  useEffect(() => {
    if (!accessToken) return;
    let mounted = true;

    (async () => {
      try {
        const response = await getProfile(accessToken);
        if (!mounted || !response?.profile) return;
        const profile = response.profile;
        reset({
          ...defaultState,
          sex: profile.sex || defaultState.sex,
          age: profile.age || defaultState.age,
          heightCm: profile.height_cm || defaultState.heightCm,
          weightKg: profile.weight_kg || defaultState.weightKg,
          goal: profile.goal || defaultState.goal,
          activityLevel: profile.activity_level || defaultState.activityLevel,
          dietaryPrefs: profile.dietary_prefs || defaultState.dietaryPrefs,
          allergies: profile.allergies || defaultState.allergies,
          lifestyle: profile.lifestyle || defaultState.lifestyle,
          labsText: profile.labs_text || defaultState.labsText,
          labsFileName: profile.labs_file_name || defaultState.labsFileName,
        });
      } catch {
        // keep defaults
      }
    })();

    return () => {
      mounted = false;
    };
  }, [accessToken, reset]);

  useEffect(() => {
    if (!accessToken) return;
    logUserEvent(accessToken, {
      eventName: "profile_editor_open",
      page: "/wizard",
      metadata: { layout: "single_page" },
    }).catch(() => {});
  }, [accessToken]);

  const handleSuggest = async () => {
    setSuggestLoading(true);
    try {
      const formData = watch();
      if (!accessToken) {
        const local = await suggestLocal(formData);
        setSuggestion(local.suggestion);
        return;
      }

      const apiSuggestion = await suggestWithApi({ profileDraft: formData, locale: "ro" }, accessToken);
      if (apiSuggestion?.suggestion) {
        setSuggestion(apiSuggestion.suggestion);
      } else {
        const local = await suggestLocal(formData);
        setSuggestion(local.suggestion);
      }
    } finally {
      setSuggestLoading(false);
    }
  };

  const handleLabsUpload = async (file) => {
    if (!accessToken) return;
    setUploadingLabs(true);
    setError("");
    try {
      const result = await uploadLabs(accessToken, file);
      setExtractedLabs(result.extracted || null);
      logUserEvent(accessToken, {
        eventName: "labs_upload_success",
        page: "/wizard",
        metadata: { fileName: file.name, size: file.size, type: file.type || "unknown" },
      }).catch(() => {});
    } catch (err) {
      setError(err.message || "Upload analize esuat");
    } finally {
      setUploadingLabs(false);
    }
  };

  const onSubmit = async (data) => {
    if (!accessToken) return;
    setError("");

    try {
      await upsertProfile(accessToken, {
        sex: data.sex,
        age: Number(data.age),
        heightCm: Number(data.heightCm),
        weightKg: Number(data.weightKg),
        goal: data.goal,
        activityLevel: data.activityLevel,
        dietaryPrefs: data.dietaryPrefs,
        allergies: data.allergies,
        lifestyle: data.lifestyle,
        labsText: data.labsText,
        labsFileName: data.labsFileName,
      });
      logUserEvent(accessToken, {
        eventName: "profile_saved",
        page: "/wizard",
        metadata: { hasLabsFile: Boolean(data.labsFileName), hasLabsText: Boolean(data.labsText) },
      }).catch(() => {});
      navigate("/plan", { replace: true });
    } catch (err) {
      setError(err.message || "Nu am putut salva profilul.");
    }
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pb-8">
        <section className="relative overflow-hidden rounded-[32px] border border-white/80 bg-white/70 p-8 backdrop-blur md:p-10">
          <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-emerald-100/70 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -right-10 h-52 w-52 rounded-full bg-teal-100/70 blur-3xl" />
          <div className="relative z-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">Tab unic utilizator</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900 md:text-4xl">Toate informatiile profilului intr-o singura pagina</h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-600">
              Completeaza datele fizice, obiectivele, preferintele si analizele in acelasi ecran, apoi salveaza o singura data.
            </p>
          </div>
        </section>

        <section className="space-y-8 rounded-[32px] border border-white/80 bg-white/75 p-8 backdrop-blur md:p-10">
          <WizardStep1 />
          <div className="h-px bg-slate-200/80" />
          <WizardStep2 />
          <div className="h-px bg-slate-200/80" />
          <WizardStep3 onSuggest={handleSuggest} suggestion={suggestion} suggestLoading={suggestLoading} />
          <div className="h-px bg-slate-200/80" />
          <WizardStep4 onUploadFile={handleLabsUpload} uploading={uploadingLabs} extractedLabs={extractedLabs} />

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Eroare</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting || uploadingLabs}>
              {isSubmitting ? "Se salveaza..." : "Salveaza profilul"}
            </Button>
          </div>
        </section>
      </form>
    </FormProvider>
  );
}
