import "server-only";

import { normalizeEmailCandidate } from "@/lib/bot/emailValidation";
import { extractEmails, fetchText, normalizeUrl, stripHtml, unique } from "@/lib/bot/utils";
import type { EmailLanguage } from "@/lib/locationOptions";

const CONTACT_PATHS: Record<EmailLanguage, string[]> = {
  pl: ["", "/kontakt", "/o-nas", "/firma", "/oferta", "/polityka-prywatnosci"],
  de: ["", "/impressum", "/kontakt", "/ueber-uns", "/contact"],
  en: ["", "/contact", "/about", "/imprint", "/privacy-policy", "/company"],
  fr: ["", "/mentions-legales", "/contact", "/a-propos", "/politique-de-confidentialite"],
  es: ["", "/aviso-legal", "/contacto", "/sobre-nosotros", "/privacidad"],
  it: ["", "/note-legali", "/contatti", "/chi-siamo", "/privacy"],
  nl: ["", "/colofon", "/contact", "/over-ons", "/privacyverklaring"],
  pt: ["", "/aviso-legal", "/contactos", "/sobre-nos", "/privacidade"],
  cs: ["", "/kontakt", "/o-nas", "/ochrana-osobnich-udaju"],
  sk: ["", "/kontakt", "/o-nas", "/ochrana-osobnych-udajov"],
  da: ["", "/kontakt", "/om-os", "/privatlivspolitik"],
  sv: ["", "/kontakt", "/om-oss", "/integritetspolicy"],
  no: ["", "/kontakt", "/om-oss", "/personvern"],
  fi: ["", "/yhteystiedot", "/meista", "/tietosuoja"],
  ro: ["", "/contact", "/despre-noi", "/politica-de-confidentialitate"],
  hu: ["", "/kapcsolat", "/rolunk", "/adatvedelem"],
  el: ["", "/epikoinonia", "/about", "/privacy"],
  uk: ["", "/контакти", "/про-нас", "/політика-конфіденційності"],
};

const SEARCH_TERMS: Record<EmailLanguage, { contact: string; email: string; legal: string }> = {
  pl: { contact: "kontakt", email: "email", legal: "dane kontaktowe" },
  de: { contact: "Kontakt", email: "E-Mail", legal: "Impressum" },
  en: { contact: "contact", email: "email", legal: "imprint" },
  fr: { contact: "contact", email: "e-mail", legal: "mentions légales" },
  es: { contact: "contacto", email: "correo electrónico", legal: "aviso legal" },
  it: { contact: "contatti", email: "e-mail", legal: "note legali" },
  nl: { contact: "contact", email: "e-mail", legal: "colofon" },
  pt: { contact: "contacto", email: "e-mail", legal: "aviso legal" },
  cs: { contact: "kontakt", email: "e-mail", legal: "kontaktní údaje" },
  sk: { contact: "kontakt", email: "e-mail", legal: "kontaktné údaje" },
  da: { contact: "kontakt", email: "e-mail", legal: "kontaktoplysninger" },
  sv: { contact: "kontakt", email: "e-post", legal: "kontaktuppgifter" },
  no: { contact: "kontakt", email: "e-post", legal: "kontaktinformasjon" },
  fi: { contact: "yhteystiedot", email: "sähköposti", legal: "yhteystiedot" },
  ro: { contact: "contact", email: "e-mail", legal: "date de contact" },
  hu: { contact: "kapcsolat", email: "e-mail", legal: "impresszum" },
  el: { contact: "επικοινωνία", email: "email", legal: "στοιχεία επικοινωνίας" },
  uk: { contact: "контакти", email: "електронна пошта", legal: "контактні дані" },
};

function resolvePath(baseUrl: string, path: string) {
  try {
    return new URL(path, baseUrl).toString();
  } catch {
    return null;
  }
}

function isDeliverableBusinessEmail(email: string) {
  const lower = email.toLowerCase();
  const local = lower.split("@")[0] || "";
  if (!lower.includes("@")) return false;
  if (/^(no-?reply|noreply|donotreply|do-not-reply|mailer-daemon|postmaster|abuse|privacy|rodo|dpo|iod|newsletter|marketing-newsletter|unsubscribe)\b/i.test(local)) return false;
  if (/\.(png|jpg|jpeg|webp|gif|svg|pdf)$/i.test(lower)) return false;
  return true;
}

function bestEmail(emails: string[]) {
  const usable = emails.map(normalizeEmailCandidate).filter(isDeliverableBusinessEmail);
  const preferred = usable.find((email) => /^(kontakt|biuro|office|info|recepcja|sprzedaz|sales|hello|verein|geschaeftsstelle|vorstand)@/i.test(email));
  return preferred || usable[0] || null;
}

function cloudflareEmails(html: string) {
  const emails: string[] = [];
  for (const match of html.matchAll(/data-cfemail=["']([0-9a-f]{6,})["']/gi)) {
    const encoded = match[1];
    const key = Number.parseInt(encoded.slice(0, 2), 16);
    if (!Number.isFinite(key)) continue;
    let decoded = "";
    for (let index = 2; index + 1 < encoded.length; index += 2) {
      decoded += String.fromCharCode(Number.parseInt(encoded.slice(index, index + 2), 16) ^ key);
    }
    if (decoded.includes("@")) emails.push(decoded);
  }
  return emails;
}

function pageEmails(html: string) {
  const deobfuscated = html
    .replace(/\s*(?:\[at\]|\(at\)|\{at\})\s*/gi, "@")
    .replace(/\s*(?:\[dot\]|\(dot\)|\{dot\})\s*/gi, ".");
  return [...extractEmails(deobfuscated), ...extractEmails(stripHtml(deobfuscated)), ...cloudflareEmails(html)];
}

export type EmailFinderResult = {
  email: string | null;
  source: "website" | "google_search" | "none";
  checkedUrls: string[];
};

export async function findEmailOnWebsite(
  website: string | null | undefined,
  deadlineMs?: number,
  language: EmailLanguage = "en",
): Promise<EmailFinderResult> {
  const base = normalizeUrl(website);
  if (!base) return { email: null, source: "none", checkedUrls: [] };

  // Check the homepage and local contact/legal pages concurrently. German clubs often
  // publish their public address on /impressum, so keep that page ahead of generic paths.
  const lookupDeadline = Math.min(deadlineMs ?? Date.now() + 2300, Date.now() + 2300);
  const checkedUrls = unique((CONTACT_PATHS[language] || CONTACT_PATHS.en)
    .slice(0, 5)
    .map((path) => resolvePath(base, path))
    .filter((url): url is string => Boolean(url)));
  const remainingMs = lookupDeadline - Date.now();
  if (remainingMs < 250) return { email: null, source: "none", checkedUrls: [] };

  const results = await Promise.all(checkedUrls.map(async (url) => {
    const timeoutMs = Math.max(250, Math.min(700, lookupDeadline - Date.now()));
    const html = await fetchText(url, timeoutMs);
    return { url, emails: html ? pageEmails(html) : [] };
  }));
  const email = bestEmail(unique(results.flatMap((result) => result.emails)));
  return { email, source: email ? "website" : "none", checkedUrls };
}

export async function findEmailWithGoogleSearch(args: {
  apiKey: string | null;
  cx: string | null;
  companyName: string;
  website?: string | null;
  city?: string | null;
  deadlineMs?: number;
  language?: EmailLanguage;
}): Promise<EmailFinderResult> {
  if (!args.apiKey || !args.cx) return { email: null, source: "none", checkedUrls: [] };

  const language = args.language || "en";
  const terms = SEARCH_TERMS[language] || SEARCH_TERMS.en;
  const website = normalizeUrl(args.website || null);
  const domain = website ? new URL(website).hostname.replace(/^www\./, "") : "";
  const query = domain
    ? `site:${domain}`
    : `"${args.companyName}" ${args.city || ""}`;
  const checkedUrls: string[] = [];
  const searchDeadline = Math.min(args.deadlineMs ?? Date.now() + 2200, Date.now() + 2200);
  const remainingMs = searchDeadline - Date.now();
  if (remainingMs < 250) return { email: null, source: "none", checkedUrls };

  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", args.apiKey);
  url.searchParams.set("cx", args.cx);
  url.searchParams.set("q", query);
  url.searchParams.set("orTerms", `${terms.legal} ${terms.contact} ${terms.email}`);
  url.searchParams.set("num", "10");
  url.searchParams.set("lr", `lang_${language}`);

  let response: Response;
  try {
    response = await fetch(url.toString(), { signal: AbortSignal.timeout(Math.max(250, Math.min(1400, remainingMs))) });
  } catch {
    return { email: null, source: "none", checkedUrls };
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return { email: null, source: "none", checkedUrls };

  const items: any[] = Array.isArray(payload?.items) ? payload.items : [];
  const emails = items.flatMap((item: any) => extractEmails(`${item?.title || ""} ${item?.snippet || ""}`));
  const snippetEmail = bestEmail(unique(emails));
  if (snippetEmail) return { email: snippetEmail, source: "google_search", checkedUrls };

  const links: string[] = unique<string>(items
    .map((item: any) => typeof item?.link === "string" ? item.link : null)
    .filter((link: string | null): link is string => Boolean(link)))
    .slice(0, 3);
  checkedUrls.push(...links);
  const pageRemainingMs = searchDeadline - Date.now();
  if (pageRemainingMs < 250) return { email: null, source: "none", checkedUrls };
  const pageTimeoutMs = Math.min(600, pageRemainingMs);
  const pages = await Promise.all(links.map(async (link: string) => {
    const html = await fetchText(link, pageTimeoutMs);
    return html ? pageEmails(html) : [];
  }));
  const email = bestEmail(unique(pages.flat()));
  return { email, source: email ? "google_search" : "none", checkedUrls };
}

export async function findBusinessEmail(args: {
  companyName: string;
  website?: string | null;
  city?: string | null;
  googleSearchApiKey?: string | null;
  googleSearchCx?: string | null;
  deadlineMs?: number;
  language?: EmailLanguage;
}) {
  const language = args.language || "en";
  const websiteResult = await findEmailOnWebsite(args.website, args.deadlineMs, language);
  if (websiteResult.email) return websiteResult;

  const googleResult = await findEmailWithGoogleSearch({
    apiKey: args.googleSearchApiKey || null,
    cx: args.googleSearchCx || null,
    companyName: args.companyName,
    website: args.website,
    city: args.city,
    deadlineMs: args.deadlineMs,
    language,
  });

  return googleResult.email
    ? googleResult
    : { email: null, source: "none" as const, checkedUrls: [...websiteResult.checkedUrls, ...googleResult.checkedUrls] };
}
