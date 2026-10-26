import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;

function compileTypeScript(source) {
  return ts.transpileModule(source.replace(/^import ["']server-only["'];?\s*$/gm, ""), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

async function transpiledModuleUrl(relativePath) {
  return moduleUrl(compileTypeScript(await readFile(new URL(relativePath, import.meta.url), "utf8")));
}

async function loadTypeScript(relativePath, replacements = {}) {
  let source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  source = source.replace(/^import ["']server-only["'];?\s*$/gm, "");
  for (const [specifier, url] of Object.entries(replacements)) {
    source = source.replaceAll(`from "${specifier}"`, `from "${url}"`);
    source = source.replaceAll(`from '${specifier}'`, `from '${url}'`);
  }
  return import(moduleUrl(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText));
}

const sportsBuyerTargetUrl = await transpiledModuleUrl("../lib/bot/sportsBuyerTarget.ts");
const googlePlacesModule = await loadTypeScript("../lib/bot/googlePlaces.ts", {
  "@/lib/bot/sportsBuyerTarget": sportsBuyerTargetUrl,
});
const emailValidationUrl = await transpiledModuleUrl("../lib/bot/emailValidation.ts");
const utilsUrl = await transpiledModuleUrl("../lib/bot/utils.ts");
const emailFinder = await loadTypeScript("../lib/bot/emailFinder.ts", {
  "@/lib/bot/emailValidation": emailValidationUrl,
  "@/lib/bot/utils": utilsUrl,
});

const aiUsageStubUrl = moduleUrl("export async function logAiUsage() {}\nexport function readOpenAiUsage() { return { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, totalTokens: 0 }; }");
const locationOptionsUrl = await transpiledModuleUrl("../lib/locationOptions.ts");
const aiLead = await loadTypeScript("../lib/bot/aiLead.ts", {
  "@/lib/locationOptions": locationOptionsUrl,
  "@/lib/aiUsage": aiUsageStubUrl,
  "@/lib/bot/sportsBuyerTarget": sportsBuyerTargetUrl,
});

{
  const originalFetch = globalThis.fetch;
  let placesRequest;
  globalThis.fetch = async (url, init) => {
    placesRequest = { url: String(url), init };
    return new Response(JSON.stringify({
      places: [{
        displayName: { text: "SG 1928 Frankfurt" },
        formattedAddress: "Musterstraße 1, Frankfurt am Main, Germany",
        primaryTypeDisplayName: { text: "Sportverein" },
        primaryType: "sports_club",
        types: ["sports_club", "point_of_interest"],
        websiteUri: "https://sg1928.de",
        googleMapsUri: "https://maps.google.test/sg1928",
        internationalPhoneNumber: "+49 69 123456",
      }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  try {
    const places = await googlePlacesModule.searchGooglePlaces({
      apiKey: "mock-google-key",
      industry: "klub sportowy",
      location: "Frankfurt am Main, Germany",
      limit: 4,
      languageCode: "de",
    });
    assert.equal(placesRequest.url, "https://places.googleapis.com/v1/places:searchText");
    assert.equal(placesRequest.init.method, "POST");
    assert.equal(placesRequest.init.headers["X-Goog-Api-Key"], "mock-google-key");
    assert.match(placesRequest.init.headers["X-Goog-FieldMask"], /places\.websiteUri/);
    assert.deepEqual(JSON.parse(placesRequest.init.body), {
      textQuery: "Sportverein Frankfurt am Main, Germany",
      languageCode: "de",
      pageSize: 4,
    });
    assert.equal(places.length, 1);
    assert.equal(places[0].companyName, "SG 1928 Frankfurt");
    assert.equal(places[0].city, "Frankfurt am Main, Germany");
    assert.equal(places[0].website, "https://sg1928.de");
    assert.equal(places[0].primaryType, "sports_club");
    assert.equal(places[0].phone, "+49 69 123456");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

{
  const originalFetch = globalThis.fetch;
  const requestedPaths = [];
  globalThis.fetch = async (url) => {
    const parsed = new URL(String(url));
    requestedPaths.push(parsed.pathname);
    const body = parsed.pathname === "/"
      ? "<p>Technische Absenderadresse: noreply@sg1928.de</p>"
      : parsed.pathname === "/impressum"
        ? "<p>Kontakt: kontakt [at] sg1928 [dot] de</p>"
        : "<p>Keine Kontaktdaten auf dieser Seite.</p>";
    return new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
  };

  try {
    const result = await emailFinder.findEmailOnWebsite("https://sg1928.de", Date.now() + 5000, "de");
    assert.equal(result.email, "kontakt@sg1928.de");
    assert.equal(result.source, "website");
    assert.ok(requestedPaths.includes("/impressum"), "German lookup should check /impressum");
    assert.ok(result.checkedUrls.some((url) => new URL(url).pathname === "/impressum"));
    assert.notEqual(result.email, "noreply@sg1928.de", "automated sender addresses must be excluded");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

{
  const originalFetch = globalThis.fetch;
  const key = 0x5a;
  const encodedEmail = `${key.toString(16).padStart(2, "0")}${[..."vorstand@sg1928.de"]
    .map((character) => (character.charCodeAt(0) ^ key).toString(16).padStart(2, "0"))
    .join("")}`;
  globalThis.fetch = async (url) => {
    const pathname = new URL(String(url)).pathname;
    const body = pathname === "/impressum"
      ? `<a class="__cf_email__" data-cfemail="${encodedEmail}">[email protected]</a>`
      : "<p>Keine öffentlich lesbare E-Mail.</p>";
    return new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
  };

  try {
    const result = await emailFinder.findEmailOnWebsite("sg1928.de", Date.now() + 5000, "de");
    assert.equal(result.email, "vorstand@sg1928.de");
    assert.equal(result.source, "website");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

{
  const originalFetch = globalThis.fetch;
  let searchUrl;
  globalThis.fetch = async (url) => {
    searchUrl = new URL(String(url));
    return new Response(JSON.stringify({
      items: [{ title: "Kontakt – FC Sportfreunde München", snippet: "Schreiben Sie an vorstand@fc-sportfreunde.de" }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  try {
    const result = await emailFinder.findEmailWithGoogleSearch({
      apiKey: "mock-search-key",
      cx: "mock-search-engine",
      companyName: "FC Sportfreunde München e.V.",
      city: "München, Germany",
      deadlineMs: Date.now() + 5000,
      language: "de",
    });
    assert.equal(result.email, "vorstand@fc-sportfreunde.de");
    assert.equal(result.source, "google_search");
    assert.equal(searchUrl.searchParams.get("lr"), "lang_de");
    assert.equal(searchUrl.searchParams.get("cx"), "mock-search-engine");
    assert.equal(searchUrl.searchParams.get("orTerms"), "Impressum Kontakt E-Mail");
    assert.match(searchUrl.searchParams.get("q"), /FC Sportfreunde München/);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

{
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("Fallback generation must not make an external request");
  };
  const args = {
    apiKey: null,
    client: { company_name: "CLAW SPORT" },
    campaign: {
      location_scope: "europe_countries",
      target_locations: ["Berlin, Germany"],
      search_keywords: "kluby sportowe, akademie sportowe, drużyny sportowe",
      target_industries: ["kluby sportowe", "akademie sportowe", "drużyny sportowe"],
      offer_description: "Personalizowana odzież sportowa dla klubów",
      client_business_description: "Produkujemy stroje sportowe dla drużyn.",
      promoted_service: "Personalizowana odzież sportowa",
      value_proposition: "Indywidualna teamwear dla klubów",
    },
    place: { companyName: "Berliner Sportverein", city: "Berlin, Germany", address: "Berlin, Germany" },
    email: "info@example.de",
    audit: {},
  };

  try {
    const result = await aiLead.generateLeadWithAi(args);
    assert.equal(result.language, "de");
    assert.match(result.subject, /Teamwear/);
    assert.match(result.body, /^Guten Tag,/);
    assert.match(result.mainProblem, /Website/);
    assert.match(result.aiSummary, /KI/);
    assert.match(result.body, /Sublimations- oder DTF-Druck/);
    assert.match(result.body, /Namen, Rückennummern/);
    assert.match(result.body, /Grafikdesign/);
    assert.match(result.body, /nachbestell/i);
    assert.match(result.body, /ab einem Stück/);
    assert.doesNotMatch(`${result.subject}\n${result.body}\n${result.mainProblem}\n${result.aiSummary}`, /Dzień dobry|Pozdrawiam|Hello,/i);
    assert.equal(result.score, 2, "AI fallback stays below the automatic-send score threshold");

    const missingEmail = await aiLead.generateLeadWithAi({ ...args, email: null });
    assert.equal(missingEmail.language, "de");
    assert.equal(missingEmail.score, 0, "a lead without an email must never be scored as sendable");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

{
  const originalFetch = globalThis.fetch;
  let requestBody;
  globalThis.fetch = async (_url, init) => {
    requestBody = JSON.parse(init.body);
    return new Response(JSON.stringify({
      output_text: JSON.stringify({
        score: 8,
        mainProblem: "Neue Trikots für die nächste Saison",
        aiSummary: "Der Verein spielt in mehreren Jugendmannschaften.",
        subject: "Individuelle Teamwear für Ihren Verein",
        body: "Guten Tag,\n\nunsere Teamwear lässt sich individuell gestalten. Wäre das für Ihren Verein interessant?",
      }),
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const campaign = {
    location_scope: "europe_countries",
    target_locations: ["Berlin, Germany"],
    search_keywords: "kluby sportowe, akademie sportowe, drużyny sportowe",
    target_industries: ["kluby sportowe", "akademie sportowe", "drużyny sportowe"],
    offer_description: "Personalizowana odzież sportowa dla klubów",
    client_business_description: "Produkujemy stroje sportowe dla drużyn.",
    promoted_service: "Personalizowana odzież sportowa",
    value_proposition: "Indywidualna teamwear dla klubów",
  };
  const baseArgs = {
    apiKey: "mock-openai-key",
    client: { company_name: "CLAW SPORT" },
    campaign,
    place: { companyName: "Berliner Sportverein", city: "Berlin, Germany", address: "Berlin, Germany" },
    email: "info@berliner-verein.de",
    audit: { problems: [], signals: [], textSample: "" },
  };

  try {
    const result = await aiLead.generateLeadWithAi(baseArgs);
    assert.equal(result.language, "de");
    assert.match(result.body, /^Guten Tag,/);
    const prompt = requestBody.input[0].content;
    assert.match(prompt, /BESTÄTIGTE PRODUKTVORTEILE FÜR DIESE TEAMWEAR-KAMPAGNE/);
    assert.match(prompt, /konkreten, belegten Bezug zu genau diesem Verein/);
    assert.match(prompt, /mit dem in der Persona hinterlegten Namen und der Firma/);
    assert.match(prompt, /warum die Teamwear für diesen Verein nützlich sein könnte/);
    assert.match(prompt, /Formuliere vermuteten Bedarf als Möglichkeit oder Frage/);
    assert.match(prompt, /Sublimations- oder DTF-Druck/);
    assert.match(prompt, /Namen, Rückennummern und weitere Details/);
    assert.match(prompt, /Grafikdesign/);
    assert.match(prompt, /ab einem Stück nachbestellbar/);
    assert.match(prompt, /Behaupte keine Preise, Lieferzeiten oder kostenlosen Leistungen/);

    requestBody = null;
    const unrelatedCampaign = {
      ...campaign,
      offer_description: "Software für die Mitgliederverwaltung von Sportvereinen",
      client_business_description: "Wir entwickeln Verwaltungssoftware für Clubs.",
      promoted_service: "Software zur Vereinsverwaltung",
      value_proposition: "Mitglieder und Beiträge zentral verwalten",
    };
    await aiLead.generateLeadWithAi({ ...baseArgs, campaign: unrelatedCampaign });
    const unrelatedPrompt = requestBody.input[0].content;
    assert.doesNotMatch(unrelatedPrompt, /BESTÄTIGTE PRODUKTVORTEILE FÜR DIESE TEAMWEAR-KAMPAGNE|DTF-Druck|Grafikentwurf/);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

console.log("German Salesbot flow tests passed (mocked Google, website, and AI fallback)");
