import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { suggestLocal, suggestWithApi } from "@/api/ai";
import { getProfile, logUserEvent, upsertProfile, uploadLabs } from "@/lib/backend-api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { WIZARD_STEPS } from "@/lib/app-params";
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
  const [step, setStep] = useState(0);
  const [hasVisitedLabsStep, setHasVisitedLabsStep] = useState(false);
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
    trigger,
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
    if (step === WIZARD_STEPS.length - 1) setHasVisitedLabsStep(true);
  }, [step]);

  useEffect(() => {
    if (!accessToken) return;
    logUserEvent(accessToken, {
      eventName: "wizard_step_view",
      page: "/wizard",
      metadata: { step, stepLabel: WIZARD_STEPS[step] },
    }).catch(() => {});
  }, [accessToken, step]);

  const progress = Math.round(((step + 1) / WIZARD_STEPS.length) * 100);

  const handleSuggest = async () => {
    setSuggestLoading(true);
    try {
      const formData = watch();
      const apiSuggestion = await suggestWithApi({ profileDraft: formData, locale: "ro" });
      if (apiSuggestion?.suggestion) setSuggestion(apiSuggestion.suggestion);
      else {
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

  const goNext = async () => {
    let fieldsToValidate = [];
    if (step === 0) fieldsToValidate = ["age", "heightCm", "weightKg"];
    if (step === 1) fieldsToValidate = ["goal", "activityLevel"];
    if (fieldsToValidate.length > 0) {
      const isValid = await trigger(fieldsToValidate);
      if (!isValid) return;
    }

    setError("");
    setStep((prev) => Math.min(WIZARD_STEPS.length - 1, prev + 1));
  };

  const goBack = () => {
    setError("");
    setStep((prev) => Math.max(0, prev - 1));
  };

  const onSubmit = async (data) => {
    if (step < WIZARD_STEPS.length - 1) {
      goNext();
      return;
    }

    if (!hasVisitedLabsStep) {
      setStep(WIZARD_STEPS.length - 1);
      return;
    }

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
      navigate("/plan", { replace: true });
    } catch (err) {
      setError(err.message || "Nu am putut salva profilul.");
    }
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 pb-8">
        <div className="relative overflow-hidden rounded-[32px] border border-white/80 bg-white/70 p-8 backdrop-blur md:p-12">
          <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-emerald-100/70 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -right-10 h-52 w-52 rounded-full bg-teal-100/70 blur-3xl" />

          <div className="relative z-10">
            <div className="mb-8 text-center">
              <div className="mb-3 flex items-end justify-between">
                <span className="text-sm font-semibold uppercase tracking-wider text-teal-800">
                  Pasul {step + 1} din {WIZARD_STEPS.length}
                </span>
                <span className="text-sm font-medium italic text-teal-600">Aproape gata!</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-teal-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-600 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {step === 0 ? <WizardStep1 /> : null}
            {step === 1 ? <WizardStep2 /> : null}
            {step === 2 ? <WizardStep3 onSuggest={handleSuggest} suggestion={suggestion} suggestLoading={suggestLoading} /> : null}
            {step === 3 ? <WizardStep4 onUploadFile={handleLabsUpload} uploading={uploadingLabs} extractedLabs={extractedLabs} /> : null}

            {error ? (
              <Alert variant="destructive" className="mt-6">
                <AlertTitle>Eroare</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="mt-8 flex flex-col items-center justify-between gap-4 sm:flex-row">
              <Button type="button" variant="outline" onClick={goBack} disabled={step === 0 || isSubmitting}>
                Pasul anterior
              </Button>
              {step < WIZARD_STEPS.length - 1 ? (
                <Button type="button" onClick={goNext}>
                  Continua
                </Button>
              ) : (
                <Button type="submit" disabled={isSubmitting || uploadingLabs}>
                  {isSubmitting ? "Se salveaza..." : "Finalizeaza profilul"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </form>
    </FormProvider>
  );
}
