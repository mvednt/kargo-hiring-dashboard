const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

export async function gemini(prompt: string, jsonSchema?: any): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY missing");

  const body: any = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2 },
  };
  if (jsonSchema) {
    body.generationConfig.responseMimeType = "application/json";
    body.generationConfig.responseSchema = jsonSchema;
  }

  let lastErr: any;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    );
    if (res.ok) {
      const j = await res.json();
      const text = j?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
      if (text) return text;
      lastErr = new Error("Empty response from Gemini");
    } else {
      lastErr = new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
      if (res.status === 400 || res.status === 403) break;
    }
    await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
  }
  throw lastErr;
}

export async function geminiJson<T>(prompt: string, schema: any): Promise<T> {
  const raw = await gemini(prompt, schema);
  try {
    return JSON.parse(raw) as T;
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]) as T;
    throw new Error("Gemini did not return valid JSON");
  }
}
