const API_KEY = import.meta.env.VITE_BASE44_API_KEY;
const API_URL = import.meta.env.VITE_BASE44_API_URL;

async function postJson(path, payload) {
  if (!API_URL) return null;

  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        api_key: API_KEY || "",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data;
  } catch {
    return null;
  }
}

export async function generatePlanWithApi(profile) {
  return postJson("/generate-plan", { profile });
}

export async function suggestWithApi(payload) {
  return postJson("/suggest", payload);
}

export async function suggestLocal(profile) {
  const goalText = profile.goal === "lose" ? "deficit controlat" : profile.goal === "gain" ? "surplus moderat" : "aport echilibrat";
  return {
    suggestion: `Recomandare rapida: mentine ${goalText}, prioritizeaza proteina la fiecare masa si 2L apa/zi.`,
  };
}

export const apiConfig = {
  API_URL,
  hasApiKey: Boolean(API_KEY),
};

