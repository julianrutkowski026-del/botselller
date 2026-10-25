import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../lib/bot/leadCandidatePriority.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const priority = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const candidates = [
  { name: "no email", target: true, contact: { email: null, source: "none" } },
  { name: "wrong type with email", target: false, contact: { email: "wrong@example.de", source: "website" } },
  { name: "Google result", target: true, contact: { email: "club@example.de", source: "google_search" } },
  { name: "official site", target: true, contact: { email: "kontakt@example.de", source: "website" } },
  { name: "another no email", target: true, contact: null },
];

const ordered = priority.prioritizeLeadCandidates(candidates, {
  isTarget: (candidate) => candidate.target,
  contact: (candidate) => candidate.contact,
});

assert.deepEqual(ordered.map((candidate) => candidate.name), [
  "official site",
  "Google result",
  "no email",
  "another no email",
  "wrong type with email",
]);

console.log("lead candidate priority tests passed");
