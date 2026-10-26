import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../lib/bot/sportsBuyerTarget.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const rules = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const target = "kluby sportowe, akademie sportowe, drużyny sportowe";
const germanTarget = "Sportvereine, Sportclubs, Sportakademien, Fußballvereine, Fußballakademien, Fußballschulen, Jugendfußballvereine, Sportmannschaften";
assert.equal(rules.isSportsOrganizationOnlyTarget(target), true);
assert.equal(rules.isSportsOrganizationOnlyTarget(germanTarget), true);
assert.deepEqual(rules.sportsOrganizationSearchTerms(target), ["klub sportowy", "akademia sportowa", "drużyna sportowa"]);
assert.deepEqual(rules.sportsOrganizationSearchTerms(germanTarget), ["klub sportowy", "akademia sportowa", "drużyna sportowa"]);
assert.equal(rules.isSportsOrganizationOnlyTarget("kluby sportowe, agencje eventowe i marki odzieżowe"), false);

assert.equal(rules.matchesSportsOrganizationTarget(target, "TSV 1860 München · sports club"), true);
assert.equal(rules.matchesSportsOrganizationTarget(target, "FC Bayern München · Fußballverein"), true);
assert.equal(rules.matchesSportsOrganizationTarget(target, "Sportakademie Berlin"), true);
assert.equal(rules.matchesSportsOrganizationTarget(target, "Münchner Fußball-Akademie"), true);
assert.equal(rules.matchesSportsOrganizationTarget(target, "Amateurmannschaft München · sport team"), true);
assert.equal(rules.matchesSportsOrganizationTarget(target, "Köln · Fußballmannschaft"), true);
assert.equal(rules.matchesSportsOrganizationTarget(germanTarget, "FC Bayern München · Fußballverein"), true);
assert.equal(rules.matchesSportsOrganizationTarget(germanTarget, "Sportakademie Berlin"), true);
assert.equal(rules.matchesSportsOrganizationTarget(germanTarget, "SV Babelsberg · Sportmannschaft"), true);
assert.equal(rules.matchesSportsOrganizationTarget(germanTarget, "FC Sportfreunde München e.V."), true);
assert.equal(rules.matchesSportsOrganizationTarget(germanTarget, "Fußball TSV Turnerbund München e.V."), true);
assert.equal(rules.matchesSportsOrganizationTarget(germanTarget, "Meyer Eventagentur · sports event team"), false);
assert.equal(rules.matchesSportsOrganizationTarget(target, "Meyer Eventagentur · sports event team"), false);
assert.equal(rules.matchesSportsOrganizationTarget(target, "Nürnberg Convention Center · event venue · sports events"), false);
assert.equal(rules.matchesSportsOrganizationTarget(target, "Sputnikhalle · nightclub · concerts"), false);

assert.equal(rules.localizeSportsSearchTerm("klub sportowy", "de"), "Sportverein");
assert.equal(rules.localizeSportsSearchTerm("akademia sportowa", "de"), "Sportakademie");
assert.equal(rules.localizeSportsSearchTerm("drużyna sportowa", "de"), "Sportmannschaft");
assert.equal(rules.localizeSportsSearchTerm("klub sportowy", "pl"), "klub sportowy");

console.log("sports buyer target tests passed");
