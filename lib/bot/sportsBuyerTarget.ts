export type SportsBuyerCategory = "club" | "academy" | "team";

function normalizeTargetText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SPORTS_WORD = /\b(sport\w*|pilk\w*|futbol\w*|football\w*|fussball\w*|siatkow\w*|volleyball\w*|koszyk\w*|basketball\w*|reczn\w*|handball\w*|tenis\w*|fitness\w*|sportverein\w*|sports club)\b/;

function targetCategories(source: string): SportsBuyerCategory[] {
  const target = normalizeTargetText(source);
  const categories: SportsBuyerCategory[] = [];
  if (/\b(klub\w*|verein\w*|club\w*|sportverein\w*|sportclub\w*|fussballverein\w*|fussballclub\w*)\b/.test(target)) categories.push("club");
  if (/\b(akadem\w*|academy\w*|sportakadem\w*)\b/.test(target)) categories.push("academy");
  if (/\b(druzyn\w*|team\w*|mannschaft\w*|sportmannschaft\w*|fussballmannschaft\w*)\b/.test(target)) categories.push("team");
  return categories;
}

const OTHER_BUYER_CATEGORY = /\b(agenc\w*|agentur\w*|event\w*|veranstalt\w*|organizator\w*|organizer\w*|organizacj\w*|mark\w*|brand\w*|pracownik\w*|employees?\w*|corporate\w*|producent\w*|manufacturer\w*|sklep\w*|store\w*|hurtown\w*)\b/;

export function isSportsOrganizationOnlyTarget(source: string) {
  const normalized = normalizeTargetText(source);
  return targetCategories(normalized).length > 0 && SPORTS_WORD.test(normalized) && !OTHER_BUYER_CATEGORY.test(normalized);
}

export function sportsOrganizationSearchTerms(source: string) {
  if (!isSportsOrganizationOnlyTarget(source)) return [];
  const categories = targetCategories(normalizeTargetText(source));
  const terms = [
    ...(categories.includes("club") ? ["klub sportowy"] : []),
    ...(categories.includes("academy") ? ["akademia sportowa"] : []),
    ...(categories.includes("team") ? ["drużyna sportowa"] : []),
  ];
  return Array.from(new Set(terms));
}

export function sportsOrganizationAliases(source: string) {
  if (!isSportsOrganizationOnlyTarget(source)) return [];
  const categories = targetCategories(normalizeTargetText(source));
  return [
    ...(categories.includes("club") ? ["klub", "sportverein", "sportclub", "fussballverein", "fussball club", "sports club", "football club"] : []),
    ...(categories.includes("academy") ? ["akademia", "academy", "sportakademie", "sports academy", "fussballakademie", "fussball akademie", "fussballschule"] : []),
    ...(categories.includes("team") ? ["druzyna", "team", "mannschaft", "sports team", "sportmannschaft", "fussballmannschaft", "fussball team"] : []),
  ];
}

export function matchesSportsOrganizationTarget(source: string, leadText: string) {
  if (!isSportsOrganizationOnlyTarget(source)) return true;
  const lead = normalizeTargetText(leadText);
  const explicitNonBuyer = /\b(night ?club\w*|club ?night\w*|eventagentur\w*|event agency\w*|eventlocation\w*|event venue\w*|conference center\w*|convention center\w*|kongresszentrum\w*|veranstaltungsort\w*|veranstaltungszentrum\w*|hotel\w*|restaurant\w*)\b/;
  if (explicitNonBuyer.test(lead)) return false;

  const hasTargetEntity = sportsOrganizationAliases(source).some((alias) => {
    const normalizedAlias = normalizeTargetText(alias);
    return normalizedAlias && lead.includes(normalizedAlias);
  });
  return hasTargetEntity && SPORTS_WORD.test(lead);
}

export function localizeSportsSearchTerm(term: string, languageCode: string | undefined) {
  if (languageCode !== "de") return term;
  const normalized = normalizeTargetText(term);
  if (/\bklub\w*\b/.test(normalized) && SPORTS_WORD.test(normalized)) return "Sportverein";
  if (/\bakadem\w*\b/.test(normalized) && SPORTS_WORD.test(normalized)) return "Sportakademie";
  if (/\b(druzyn\w*|team\w*)\b/.test(normalized) && SPORTS_WORD.test(normalized)) return "Sportmannschaft";
  return term;
}
