import "server-only";

export {
  EUROPE_COUNTRIES,
  EUROPE_COUNTRIES_WITHOUT_POLAND,
  EUROPE_COUNTRY_NAMES,
  EUROPE_COUNTRY_NAMES_FOR_EUROPE_PLAN,
  EUROPE_LOCATIONS,
  EUROPE_LOCATIONS_WITHOUT_POLAND,
  EMAIL_LANGUAGE_NAMES,
  POLAND_LOCATIONS,
  POLISH_VOIVODESHIPS,
  VOIVODESHIP_NAMES,
  emailLanguageForCampaignLocation,
  type EmailLanguage,
  expandLocations as expandCampaignLocations,
  isPolishLocation,
  languageForCampaignLocation,
  languageForLocation,
  normalizeLocationLabel,
} from "@/lib/locationOptions";

export function locationHint() {
  return "Wybierz zasięg w panelu: Cała Polska, Cała Europa, wybrane kraje Europy, województwa albo własne miasta.";
}
