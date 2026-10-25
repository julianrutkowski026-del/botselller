export type CampaignSearchPair = { industry: string; location: string };

function normalizedIndex(value: number | null | undefined, length: number) {
  if (!length) return 0;
  const parsed = Number(value || 0);
  return Math.abs(Math.round(Number.isFinite(parsed) ? parsed : 0)) % length;
}

export function buildCampaignSearchPairs(args: {
  industries: string[];
  locations: string[];
  startIndustryIndex?: number | null;
  startLocationIndex?: number | null;
  limit: number;
}): CampaignSearchPair[] {
  if (!args.industries.length || !args.locations.length) return [];

  const startIndustry = normalizedIndex(args.startIndustryIndex, args.industries.length);
  const startLocation = normalizedIndex(args.startLocationIndex, args.locations.length);
  const pairs = args.industries.flatMap((industry) => args.locations.map((location) => ({ industry, location })));
  const startPair = startIndustry * args.locations.length + startLocation;
  const rotated = [...pairs.slice(startPair), ...pairs.slice(0, startPair)];
  return rotated.slice(0, Math.max(1, Math.floor(args.limit)));
}

export function advanceCampaignSearchCursor(args: {
  industriesCount: number;
  locationsCount: number;
  startIndustryIndex?: number | null;
  startLocationIndex?: number | null;
  processedPairs: number;
}) {
  const totalPairs = Math.max(args.industriesCount, 0) * Math.max(args.locationsCount, 0);
  if (!totalPairs || !args.locationsCount) return { industryIndex: 0, locationIndex: 0 };

  const startIndustry = normalizedIndex(args.startIndustryIndex, args.industriesCount);
  const startLocation = normalizedIndex(args.startLocationIndex, args.locationsCount);
  const startPair = startIndustry * args.locationsCount + startLocation;
  const processed = Math.max(0, Math.floor(args.processedPairs));
  const nextPair = (startPair + processed) % totalPairs;
  return {
    industryIndex: Math.floor(nextPair / args.locationsCount),
    locationIndex: nextPair % args.locationsCount,
  };
}
