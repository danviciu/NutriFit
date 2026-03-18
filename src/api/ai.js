import { API_BASE_URL } from "@/lib/app-params";

const API_URL = API_BASE_URL;

async function postJson(path, payload, token = "") {
  if (!API_URL) return null;

  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

export async function generatePlanWithApi(profile, token = "") {
  return postJson("/generate-plan", { profile }, token);
}

export async function suggestWithApi(payload, token = "") {
  return postJson("/suggest", payload, token);
}

export async function suggestLocal(profile) {
  const goalText = profile.goal === "lose" ? "deficit controlat" : profile.goal === "gain" ? "surplus moderat" : "aport echilibrat";
  return {
    suggestion: `Recomandare rapida: mentine ${goalText}, prioritizeaza proteina la fiecare masa si 2L apa/zi.`,
  };
}

export const apiConfig = {
  API_URL,
  authFromBackend: true,
};

