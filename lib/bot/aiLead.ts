import "server-only";

import type { Campaign, ClientAccount } from "@/lib/types";
import type { WebsiteAudit } from "@/lib/bot/websiteAudit";
import type { PlaceLead } from "@/lib/bot/googlePlaces";
import { EMAIL_LANGUAGE_NAMES, emailLanguageForCampaignLocation, type EmailLanguage } from "@/lib/locationOptions";
import { logAiUsage, readOpenAiUsage } from "@/lib/aiUsage";
import { isSportsOrganizationOnlyTarget } from "@/lib/bot/sportsBuyerTarget";

export type GeneratedLeadResult = {
  score: number;
  mainProblem: string;
  aiSummary: string;
  subject: string;
  body: string;
  language: EmailLanguage;
};

function clampScore(value: unknown) {
  const score = Number(value);
  if (Number.isNaN(score)) return 5;
  return Math.max(0, Math.min(10, Math.round(score)));
}

function text(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function clean(value: string | null | undefined) {
  return value?.trim() || "";
}

function campaignPrimaryTarget(campaign: Campaign) {
  return [
    campaign.search_keywords,
    ...(campaign.target_industries || []),
    campaign.exact_target_business_type,
    campaign.target_audience_niche,
  ].filter(Boolean).join("\n");
}

function normalizeOfferText(value: string) {
  return value
    .normalize("NFD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/ß/g, "ss");
}

function isSportswearCampaign(campaign: Campaign) {
  if (!isSportsOrganizationOnlyTarget(campaignPrimaryTarget(campaign))) return false;
  const offerText = normalizeOfferText([
    campaign.offer_description,
    campaign.client_business_description,
    campaign.promoted_service,
    campaign.value_proposition,
  ].filter(Boolean).join(" "));
  return /\b(odziez\w*|ubran\w*|stroj\w*|sportbekleidung\w*|bekleidung\w*|teamwear\w*|sportswear\w*|trikot\w*|sports kit\w*|team uniform\w*)\b/.test(offerText);
}

const GERMAN_SPORTSWEAR_FALLBACK = () =>
  `Guten Tag,\n\nunsere Teamwear gestalten wir vollständig nach Ihren Wünschen und den Vereinsfarben. Je nach Artikel veredeln wir sie im Sublimations- oder DTF-Druck; Namen, Rückennummern und weitere Details lassen sich individuell umsetzen. Auf Wunsch entwerfen wir außerdem das passende Grafikdesign. Falls später noch etwas fehlt, können einzelne Teile bereits ab einem Stück nachbestellt werden.\n\nWäre das für Ihre Mannschaft interessant? Gern sende ich Ihnen weitere Informationen.`;

const GERMAN_SPORTSWEAR_PROMPT = `

PERSÖNLICHE ANSPRACHE: Schreibe keine austauschbare Standardmail und beginne nicht mit einer bloßen Produktliste. Starte mit einem konkreten, belegten Bezug zu genau diesem Verein, der aus Website, Lead-Daten oder Prüfung hervorgeht, zum Beispiel zu einer erkennbaren Mannschaft, Sportart oder Nachwuchsabteilung. Stelle den Absender kurz und natürlich mit dem in der Persona hinterlegten Namen und der Firma vor; erfinde keine Personendaten und wiederhole keine Signatur. Erkläre, warum die Teamwear für diesen Verein nützlich sein könnte: ein stimmiger Auftritt in den Vereinsfarben, individuelle Namen und Rückennummern sowie unkomplizierte Ergänzungen, wenn später ein einzelnes Teil oder eine zusätzliche Größe gebraucht wird. Formuliere vermuteten Bedarf als Möglichkeit oder Frage, nicht als bekannte Tatsache.

BESTÄTIGTE PRODUKTVORTEILE FÜR DIESE TEAMWEAR-KAMPAGNE: Integriere alle Punkte natürlich und kompakt in den Mailtext, nicht als Aufzählung. Die Teamwear wird vollständig nach den Wünschen und Vereinsfarben des Clubs gestaltet. Je nach Artikel kommt Sublimations- oder DTF-Druck zum Einsatz; Namen, Rückennummern und weitere Details lassen sich individuell umsetzen. Auf Wunsch kann außerdem das passende Grafikdesign entworfen werden. Einzelne Teile sind später bereits ab einem Stück nachbestellbar. Eine mögliche Formulierung: „Unsere Teamwear gestalten wir vollständig nach Ihren Wünschen und den Vereinsfarben. Je nach Artikel veredeln wir sie im Sublimations- oder DTF-Druck; Namen, Rückennummern und weitere Details lassen sich individuell umsetzen. Auf Wunsch entwerfen wir außerdem das passende Grafikdesign. Falls später noch etwas fehlt, können einzelne Teile bereits ab einem Stück nachbestellt werden.“ Behaupte keine Preise, Lieferzeiten oder kostenlosen Leistungen, die in der Kampagne nicht genannt sind.`;

function sampleStyleBlock(sample: string | null | undefined) {
  const cleaned = clean(sample);
  if (!cleaned) return "Brak przykładowego maila. Zastosuj ton kampanii i pisz naturalnie.";
  const clipped = cleaned.slice(0, 4500);
  return [
    "Kampania zawiera przykładowy mail lub kilka przykładowych maili. To jest najważniejszy wzorzec stylu wiadomości.",
    "Masz odwzorować: długość, poziom formalności, typ powitania, tempo zdań, układ akapitów, sposób przedstawienia oferty i sposób przejścia do CTA.",
    "Nie kopiuj 1:1 całych zdań z przykładu. Użyj wzorca stylu, ale treść dopasuj do znalezionego leada, oferty klienta i zasad kampanii.",
    "Jeżeli przykład zawiera podpis, stopkę, telefon, email, stronę lub dane nadawcy, potraktuj je wyłącznie jako informację stylistyczną. Nie wpisuj ich do body, bo mailer doda aktualne dane z kampanii automatycznie.",
    "Przykładowe maile / wzorzec stylu:",
    clipped,
  ].join("\n");
}

function personaText(client: ClientAccount, campaign: Campaign) {
  const firstName = clean(campaign.bot_first_name) || clean(client.bot_first_name);
  const lastName = clean(campaign.bot_last_name) || clean(client.bot_last_name);
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || clean(client.sender_name) || clean(client.contact_name);
  return [
    `- Imię i nazwisko bota: ${fullName || "brak"}`,
    `- Rola bota: ${clean(campaign.bot_role) || clean(client.bot_role)}`,
    `- Firma w podpisie: ${clean(campaign.signature_company) || clean(client.signature_company) || client.company_name}`,
    `- Strona w podpisie: ${clean(campaign.signature_website) || clean(client.signature_website) || clean(client.website)}`,
    `- Email w podpisie / reply-to: ${clean(campaign.signature_email) || clean(client.signature_email) || clean(client.smtp_reply_to) || clean(client.sender_email) || clean(client.contact_email)}`,
    `- Telefon w podpisie: ${clean(campaign.signature_phone) || clean(client.signature_phone) || clean(client.phone)}`,
    `- Adres w podpisie: ${clean(campaign.signature_address) || clean(client.signature_address)}`,
    `- Notatka stopki: ${clean(campaign.signature_footer_note) || clean(client.signature_footer_note)}`,
  ].join("\n");
}

const FALLBACK_COPY: Partial<Record<EmailLanguage, { subject: string; problem: string; summary: string; body: (company: string) => string }>> = {
  pl: {
    subject: "Krótka propozycja współpracy",
    problem: "Wymaga sprawdzenia strony internetowej",
    summary: "AI nie zwróciło pełnej odpowiedzi. Ocena została ustawiona nisko, aby nie wysłać słabej wiadomości automatycznie.",
    body: (company) => `Dzień dobry,\n\ntrafiłem na Państwa firmę i chciałem krótko zapytać, czy rozmowa o możliwej współpracy byłaby dla Państwa aktualna.\n\nReprezentuję ${company}. Jeśli to dobry moment, mogę przesłać krótką propozycję dopasowaną do Państwa działalności.`,
  },
  en: {
    subject: "A short idea for cooperation",
    problem: "Website needs a review",
    summary: "AI did not return a complete response. The score was kept low to prevent a weak message from being sent automatically.",
    body: (company) => `Hello,\n\nI came across your company and wanted to briefly ask whether a conversation about working together would be relevant for you.\n\nI represent ${company}. If the timing is right, I can send a short proposal tailored to your business.`,
  },
  de: {
    subject: "Kurze Anfrage zur Zusammenarbeit",
    problem: "Die Website sollte geprüft werden",
    summary: "Die KI hat keine vollständige Antwort geliefert. Die Bewertung bleibt niedrig, damit keine unpassende Nachricht automatisch versendet wird.",
    body: (company) => `Guten Tag,\n\nich bin auf Ihr Unternehmen aufmerksam geworden und wollte kurz fragen, ob ein Gespräch über eine mögliche Zusammenarbeit für Sie aktuell interessant wäre.\n\nIch vertrete ${company}. Wenn der Zeitpunkt passt, sende ich Ihnen gern einen kurzen, auf Ihr Unternehmen abgestimmten Vorschlag.`,
  },
  fr: {
    subject: "Une courte proposition de collaboration",
    problem: "Le site web doit être vérifié",
    summary: "L’IA n’a pas fourni de réponse complète. La note reste basse afin d’éviter l’envoi automatique d’un message inadapté.",
    body: (company) => `Bonjour,\n\nje suis tombé sur votre entreprise et souhaitais vous demander si un échange au sujet d’une éventuelle collaboration pourrait vous intéresser.\n\nJe représente ${company}. Si le moment est opportun, je peux vous envoyer une courte proposition adaptée à votre activité.`,
  },
  es: {
    subject: "Una breve propuesta de colaboración",
    problem: "Conviene revisar el sitio web",
    summary: "La IA no devolvió una respuesta completa. La puntuación se mantiene baja para evitar el envío automático de un mensaje poco adecuado.",
    body: (company) => `Hola,\n\nhe conocido su empresa y quería preguntarle brevemente si podría interesarle conversar sobre una posible colaboración.\n\nRepresento a ${company}. Si es un buen momento, puedo enviarle una propuesta breve adaptada a su actividad.`,
  },
  it: {
    subject: "Una breve proposta di collaborazione",
    problem: "È opportuno verificare il sito web",
    summary: "L’IA non ha restituito una risposta completa. Il punteggio resta basso per evitare l’invio automatico di un messaggio poco pertinente.",
    body: (company) => `Buongiorno,\n\nho trovato la vostra azienda e volevo chiedervi brevemente se potrebbe interessarvi parlare di una possibile collaborazione.\n\nRappresento ${company}. Se è un buon momento, posso inviarvi una breve proposta adatta alla vostra attività.`,
  },
  nl: {
    subject: "Een kort voorstel voor samenwerking",
    problem: "De website moet worden gecontroleerd",
    summary: "De AI heeft geen volledig antwoord gegeven. De score blijft laag om te voorkomen dat er automatisch een ongeschikt bericht wordt verstuurd.",
    body: (company) => `Goedendag,\n\nik kwam uw bedrijf tegen en wilde kort vragen of een gesprek over een mogelijke samenwerking voor u interessant kan zijn.\n\nIk vertegenwoordig ${company}. Als het u uitkomt, stuur ik u graag een kort voorstel dat op uw bedrijf is afgestemd.`,
  },
  pt: {
    subject: "Uma breve proposta de colaboração",
    problem: "É aconselhável rever o site",
    summary: "A IA não apresentou uma resposta completa. A avaliação mantém-se baixa para evitar o envio automático de uma mensagem inadequada.",
    body: (company) => `Bom dia,\n\nconheci a vossa empresa e gostaria de perguntar brevemente se teria interesse numa conversa sobre uma possível colaboração.\n\nRepresento ${company}. Se for oportuno, posso enviar uma proposta breve e adaptada à vossa atividade.`,
  },
};

function fallbackLead(args: { client: ClientAccount; campaign: Campaign; place: PlaceLead; email: string | null; audit: WebsiteAudit }): GeneratedLeadResult {
  const hasEmail = Boolean(args.email);
  // Fallback AI nie powinien przechodzić do wysyłki. Jeśli OpenAI padnie, lead trafia do logów jako low_score/ai_failed, a panel pozostaje czysty.
  const score = hasEmail ? 2 : 0;
  const language = emailLanguageForCampaignLocation(args.campaign.location_scope, args.campaign.target_locations, args.place.city, args.place.address);
  const copy = FALLBACK_COPY[language] || FALLBACK_COPY.en!;
  const sportswearCampaign = language === "de" && isSportswearCampaign(args.campaign);
  const body = sportswearCampaign
    ? GERMAN_SPORTSWEAR_FALLBACK()
    : copy.body(args.client.company_name);
  return {
    score,
    mainProblem: copy.problem,
    aiSummary: copy.summary,
    subject: sportswearCampaign ? "Individuelle Teamwear für Ihren Verein" : copy.subject,
    body,
    language,
  };
}

function extractOutputText(payload: any) {
  if (typeof payload?.output_text === "string") return payload.output_text.trim();
  const parts: string[] = [];
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === "string") parts.push(content.text);
    }
  }
  return parts.join("\n").trim();
}

function removeAccidentalFooter(body: string, client: ClientAccount, campaign: Campaign) {
  const senderNames = [
    clean(campaign.bot_first_name),
    clean(campaign.bot_last_name),
    clean(client.bot_first_name),
    clean(client.bot_last_name),
    clean(client.sender_name),
    clean(client.contact_name),
    clean(campaign.signature_company),
    clean(client.signature_company),
    clean(client.company_name),
  ].filter(Boolean);

  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const cutIndex = lines.findIndex((line, index) => {
    const trimmed = line.trim().toLowerCase();
    if (trimmed === "--" || trimmed === "---") return true;
    if (/^(pozdrawiam|z poważaniem|best regards|kind regards|regards|mit freundlichen grüßen|freundliche grüße|cordiali saluti|saludos|bien cordialement),?$/i.test(line.trim())) {
      const next = lines.slice(index + 1, index + 5).join(" ").toLowerCase();
      return senderNames.some((name) => next.includes(name.toLowerCase()));
    }
    return false;
  });

  const cleaned = cutIndex >= 0 ? lines.slice(0, cutIndex).join("\n").trim() : body.trim();
  return cleaned || body.trim();
}

export async function generateLeadWithAi(args: {
  apiKey: string | null;
  model?: string | null;
  client: ClientAccount;
  campaign: Campaign;
  place: PlaceLead;
  email: string | null;
  audit: WebsiteAudit;
  timeoutMs?: number;
}): Promise<GeneratedLeadResult> {
  if (!args.apiKey) return fallbackLead(args);

  const messageLanguage = emailLanguageForCampaignLocation(args.campaign.location_scope, args.campaign.target_locations, args.place.city, args.place.address);
  const languageName = EMAIL_LANGUAGE_NAMES[messageLanguage];
  const languageInstruction = `Napisz całą wiadomość w języku ${languageName}. Dotyczy to tematu, treści, powodu kontaktu i podsumowania AI.`;
  const primaryTarget = campaignPrimaryTarget(args.campaign);
  const sportsBuyerInstruction = isSportsOrganizationOnlyTarget(primaryTarget)
    ? `\nTWARDY FILTR KAMPANII: szukamy wyłącznie klubów sportowych, akademii sportowych i drużyn sportowych. Lead musi być takim zespołem lub organizacją, która może zamawiać stroje dla własnych zawodników. Agencja eventowa, sala koncertowa, centrum konferencyjne, hotel, firma kupująca ubrania dla pracowników ani organizator wydarzeń bez własnej drużyny sportowej nie pasują: wystaw score 0-2 i nie pisz do nich oferty. Wiadomość ma dotyczyć strojów meczowych/treningowych dla zawodników, nie ubrań na event lub merchu.`
    : "";
  const sportswearOfferInstruction = messageLanguage === "de" && isSportswearCampaign(args.campaign)
    ? GERMAN_SPORTSWEAR_PROMPT
    : "";

  const prompt = `
Jesteś AI Sales Managerem. Przygotowujesz lead dla klienta abonamentowego FluxBase BotSeller.

Klient, dla którego szukamy leadów:
- Firma: ${args.client.company_name}
- Kontakt: ${args.client.contact_name || ""}
- Strona klienta: ${args.client.website || ""}

Kampania:
- Nazwa: ${args.campaign.name}
- Szukane branże: ${(args.campaign.target_industries || []).join(", ")}
- Lokalizacje: ${(args.campaign.target_locations || []).join(", ") || "Cała Polska"}
- Wymagany język wiadomości: ${languageName} (${messageLanguage})
- Oferta klienta: ${args.campaign.offer_description || ""}
- Czym zajmuje się klient: ${args.campaign.client_business_description || ""}
- Promowana usługa: ${args.campaign.promoted_service || ""}
- Dlaczego ktoś miałby skorzystać: ${args.campaign.value_proposition || ""}
- Docelowa grupa odbiorców / nisza: ${args.campaign.target_audience_niche || ""}
- Osoba decyzyjna po stronie leada: ${args.campaign.decision_maker_roles || ""}
- Model biznesu targetu: ${args.campaign.target_business_model || ""}
- Etap rozwoju targetu: ${args.campaign.target_company_stage || ""}
- Segment cenowy/budżet targetu: ${args.campaign.target_price_segment || ""}
- Konkretny typ firm: ${args.campaign.exact_target_business_type || ""}
- Czym te firmy się zajmują: ${args.campaign.target_business_activities || ""}
- Preferowana wielkość firmy: ${args.campaign.target_company_size || ""}
- Słowa kluczowe do wyszukiwania: ${args.campaign.search_keywords || ""}
- Słowa wykluczające: ${args.campaign.negative_keywords || ""}
- Sygnały wymagane: ${args.campaign.must_have_signals || ""}
- Sygnały online wymagane przy sprawdzaniu: ${args.campaign.required_online_signals || ""}
- Zasady kwalifikacji leada: ${args.campaign.lead_qualification_rules || ""}
- Firmy wykluczone: ${args.campaign.excluded_company_types || ""}
- Zasady dyskwalifikacji leada: ${args.campaign.lead_disqualification_rules || ""}
- Idealny profil leada: ${args.campaign.preferred_lead_profile || ""}
- Najlepszy target: ${args.campaign.target_customer_description || ""}
- Problemy targetu: ${args.campaign.customer_pain_points || ""}
- Czego unikać w mailach: ${args.campaign.avoid_in_messages || ""}
- Preferowany CTA: ${args.campaign.call_to_action || ""}
- Ton: ${args.campaign.tone || "spokojny, konkretny, profesjonalny"}
- Przykładowy mail / styl komunikacji klienta:
${sampleStyleBlock(args.campaign.sample_email_style)}

Persona nadawcy i podpis, który doda mailer:
${personaText(args.client, args.campaign)}

Znaleziony lead:
- Firma: ${args.place.companyName}
- Branża: ${args.place.industry || ""}
- Miasto: ${args.place.city || ""}
- Telefon: ${args.place.phone || ""}
- Email: ${args.email || "brak"}
- Strona: ${args.place.website || "brak"}
- Google Maps: ${args.place.googleMapsUrl || ""}

Audyt automatyczny strony:
- Problemy: ${args.audit.problems.join(" | ")}
- Sygnały: ${args.audit.signals.join(" | ")}
- Próbka treści: ${args.audit.textSample.slice(0, 600)}

Zadanie:
${sportsBuyerInstruction}
${sportswearOfferInstruction}
1. Oceń jakość leada od 0 do 10 dla tej kampanii. Źródłem prawdy jest wyłącznie opis targetu wpisany w kampanii: „Szukane branże”, „Jakich firm szukamy”, „Konkretny typ firm”, „Nisza”, „Słowa kluczowe”, „Sygnały wymagane”, „Zasady kwalifikacji” i „Wykluczenia”.
2. NIE MYL klienta z targetem. „Czym zajmuje się klient”, „Oferta klienta” i „Promowana usługa” opisują NADAWCĘ oraz produkt, a nie firmy, których bot ma szukać.
3. Jeśli kampania szuka klubów, akademii, szkół, marek lub organizacji sportowych, lead musi wyglądać jak taki kupujący. Szkółka drzew/krzewów/roślin, centrum ogrodnicze, gospodarstwo szkółkarskie, sklep sportowy, hurtownia, drukarnia, szwalnia albo producent odzieży ma dostać score 0-2, chyba że kampania literalnie wskazuje taki typ jako target.
4. Jeśli klient sprzedaje np. odzież sportową, strony www, druk, marketing, logistykę itd., to producent/sklep/agencja z tej samej branży NIE jest automatycznie dobrym leadem. Dobry lead musi pasować do pola „Jakich firm szukamy?”.
5. Jeśli lead jest dostawcą/producentem/sprzedawcą podobnego produktu zamiast potencjalnym kupującym, daj score 0-2.
6. Jeśli lead jest za szeroki, z innej branży, wygląda jak sieciówka/franczyza albo łamie zasady dyskwalifikacji, daj score 0-3.
7. Nie naciągaj dopasowania. Jeśli nie masz jasnego sygnału, że firma pasuje do targetu z kampanii, oceń ją nisko i nie twórz przekonującej wiadomości na siłę.
8. Wskaż główny powód kontaktu.
9. Napisz krótką analizę dla admina.
10. Napisz krótki temat i wiadomość e-mail dla znalezionej firmy.

Zasady wiadomości:
- ${languageInstruction}
- Nie kłam. Nie obiecuj wyników.
- Nie naginaj targetu tylko po to, aby wysłać mail. Jeśli firma nie pasuje do zawężonej grupy odbiorców, oceń ją nisko.
- Nie pisz, że firma na pewno ma problem, jeżeli audyt jest niepewny.
- Wiadomość ma reprezentować klienta, nie FluxBase.
- Bot wysyła tylko pierwszą wiadomość. Nie sugeruj, że AI będzie dalej odpisywać.
- Odpowiedzi odbiera i obsługuje człowiek po stronie klienta.
  - Jeśli kampania podała CTA, zachowaj jego sens i przetłumacz go na wymagany język wiadomości.
- Jeśli kampania ma przykładowego maila, ma on pierwszeństwo przed ogólną instrukcją tonu. Zachowaj podobną długość, strukturę akapitów, formalność, rytm, typ powitania i sposób domknięcia rozmowy.
- Przykładowy mail jest stylem, nie szablonem do kopiowania. Nie kopiuj całych zdań 1:1 i nie przenoś danych kontaktowych z przykładu.
- Nie powtarzaj pełnej stopki ani danych podpisu w treści. Mailer zawsze doda aktualny podpis i stopkę z danych wpisanych w kampanii.
- Zwróć tylko temat i główną treść wiadomości, bez finalnej stopki prawnej, bez listy danych kontaktowych i bez podpisu typu „Pozdrawiam, Jan Kowalski”.
- Nie zaczynaj każdej wiadomości identycznie. Dobierz naturalne otwarcie do leada, ale bez sztucznej poufałości.
- Wiadomość ma być krótka, konkretna i B2B. Unikaj tonu newslettera, obietnic i przesadnej sprzedaży.
- Nie tłumacz nazw firm, imion, domen ani nazw własnych. Dostosuj tylko język wiadomości.
- Jeśli kampania podała rzeczy do unikania, zastosuj je bez wyjątków.
- AI jest wywoływane dopiero po znalezieniu e-maila. Nie twórz tekstu dla leadów bez adresu.
- Bez agresywnej sprzedaży.

BEZWZGLĘDNA KONTROLA JĘZYKA (ma pierwszeństwo przed językiem przykładów, kampanii i danych klienta):
- ${languageInstruction}
- Temat, treść, mainProblem i aiSummary muszą być w całości w języku ${languageName}.
- Przykład maila jest wyłącznie wzorcem tonu i układu. Nie kopiuj z niego języka, jeśli jest inny niż ${languageName}.
- Przetłumacz sens CTA oraz opis oferty na ${languageName}; nie wstawiaj polskich ani angielskich zdań do wiadomości w innym języku.
- Nazwy własne, nazwy firm, imiona, domeny i adresy pozostaw bez tłumaczenia.

Zwróć wyłącznie JSON.
`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${args.apiKey}`, "Content-Type": "application/json" },
    ...(args.timeoutMs ? { signal: AbortSignal.timeout(Math.max(1000, Math.min(args.timeoutMs, 9000))) } : {}),
    body: JSON.stringify({
      model: args.model || process.env.OPENAI_MODEL || "gpt-5.5",
      input: [{ role: "user", content: prompt }],
      max_output_tokens: 800,
      text: {
        format: {
          type: "json_schema",
          name: "botseller_lead",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              score: { type: "number", minimum: 0, maximum: 10 },
              mainProblem: { type: "string" },
              aiSummary: { type: "string" },
              subject: { type: "string" },
              body: { type: "string" },
            },
            required: ["score", "mainProblem", "aiSummary", "subject", "body"],
          },
        },
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  const model = args.model || process.env.OPENAI_MODEL || "gpt-5.5";
  const usage = readOpenAiUsage(payload);
  if (usage.totalTokens || usage.inputTokens || usage.outputTokens) {
    await logAiUsage({
      provider: "openai",
      model,
      clientId: args.client.id,
      campaignId: args.campaign.id,
      operation: "lead_email_generation",
      inputTokens: usage.inputTokens,
      cachedInputTokens: usage.cachedInputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      status: response.ok ? "ok" : "failed",
      metadata: { companyName: args.place.companyName, email: args.email || null },
    });
  }
  if (!response.ok) return fallbackLead(args);

  try {
    const raw = JSON.parse(extractOutputText(payload));
    return {
      score: clampScore(raw.score),
      mainProblem: text(raw.mainProblem, FALLBACK_COPY[messageLanguage]?.problem || FALLBACK_COPY.en!.problem),
      aiSummary: text(raw.aiSummary, FALLBACK_COPY[messageLanguage]?.summary || FALLBACK_COPY.en!.summary),
      subject: text(raw.subject, FALLBACK_COPY[messageLanguage]?.subject || FALLBACK_COPY.en!.subject),
      body: removeAccidentalFooter(text(raw.body, fallbackLead(args).body), args.client, args.campaign),
      language: messageLanguage,
    };
  } catch {
    return fallbackLead(args);
  }
}
