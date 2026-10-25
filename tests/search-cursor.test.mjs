import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../lib/bot/searchCursor.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const cursor = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const industries = ["club", "academy", "team"];
const locations = ["Berlin", "Hamburg", "Munich"];
const wrapped = cursor.buildCampaignSearchPairs({ industries, locations, startIndustryIndex: 0, startLocationIndex: 2, limit: 4 });
assert.deepEqual(wrapped, [
  { industry: "club", location: "Munich" },
  { industry: "academy", location: "Berlin" },
  { industry: "academy", location: "Hamburg" },
  { industry: "academy", location: "Munich" },
]);

const afterWrap = cursor.advanceCampaignSearchCursor({
  industriesCount: industries.length,
  locationsCount: locations.length,
  startIndustryIndex: 0,
  startLocationIndex: 2,
  processedPairs: 1,
});
assert.deepEqual(afterWrap, { industryIndex: 1, locationIndex: 0 });

let industryIndex = 0;
let locationIndex = 0;
const visited = new Set();
for (let index = 0; index < industries.length * locations.length; index += 1) {
  const [pair] = cursor.buildCampaignSearchPairs({ industries, locations, startIndustryIndex: industryIndex, startLocationIndex: locationIndex, limit: 1 });
  visited.add(`${pair.industry}/${pair.location}`);
  ({ industryIndex, locationIndex } = cursor.advanceCampaignSearchCursor({
    industriesCount: industries.length,
    locationsCount: locations.length,
    startIndustryIndex: industryIndex,
    startLocationIndex: locationIndex,
    processedPairs: 1,
  }));
}
assert.equal(visited.size, industries.length * locations.length);
assert.deepEqual({ industryIndex, locationIndex }, { industryIndex: 0, locationIndex: 0 });

console.log("search cursor tests passed");
