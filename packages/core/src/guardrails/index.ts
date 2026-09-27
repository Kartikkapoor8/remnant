/**
 * Bumped whenever a rule changes what the persona may say. Reported by GET /api/health.
 *   1.0.0  the five modules: neverAlive, noInitiate, consent, dependencyMonitor, crisisBypass
 *   1.1.0  neverAlive flags present-time anchored self-reports ("shift is dead quiet tonight")
 *   1.2.0  neverAlive: "im still in the chair" presence pattern; classifyInContext turns a bare "ya"
 *          to "do you miss me" into the timeless line
 */
export const GUARDRAILS_VERSION = "1.2.0";

export * from "./neverAlive.ts";
export * from "./noInitiate.ts";
export * from "./consent.ts";
export * from "./dependencyMonitor.ts";
export * from "./crisisBypass.ts";
