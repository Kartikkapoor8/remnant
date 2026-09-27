import { resolve } from "node:path";
import {
  AnthropicProvider,
  DependencyMonitor,
  FixtureProvider,
  GBrainMemoryStore,
  GBrainUnavailableError,
  InMemoryStore,
  JsonFileConsentStore,
  PersonaEngine,
  RiverProvider,
  loadSarahFixture,
  parseBrainFacts,
  type ImportResult,
  type MemoryStore,
  type ModelProvider,
  type PersonaProfile,
} from "@remnant/core";
import { ElevenLabsVoice, JsonVoiceStore } from "@remnant/voice";

export const REPO_ROOT = resolve(import.meta.dir, "../../..");
export const DATA_DIR = resolve(REPO_ROOT, ".remnant");
const BRAIN_DIR = resolve(REPO_ROOT, "brain");

export interface AppContext {
  profile: PersonaProfile;
  corpus: ImportResult;
  memory: MemoryStore;
  memoryNote: string | null;
  provider: ModelProvider;
  providerNote: string | null;
  engine: PersonaEngine;
  consent: JsonFileConsentStore;
  voice: ElevenLabsVoice | null;
  voices: JsonVoiceStore;
  monitor: DependencyMonitor;
  log: (event: string, data: Record<string, unknown>) => void;
}

/** Knobs for tests and CI; production runs with the defaults and the environment. */
export interface BootstrapOptions {
  /** "memory" skips gbrain and uses the facts parsed from brain/. */
  memory?: "auto" | "memory";
  /** "fixture" skips the River and Anthropic probes. */
  provider?: "auto" | "fixture";
  /** false disables ElevenLabs even when a key is in the environment. */
  voice?: boolean;
  /** Where consent.json and voice.json live. Defaults to .remnant/. */
  dataDir?: string;
}

function log(event: string, data: Record<string, unknown>): void {
  console.log(`[remnant] ${event} ${JSON.stringify(data)}`);
}

/** The same facts `bun run sarah` seeds into GBrain, held in memory instead. */
async function inMemoryFacts(profile: PersonaProfile): Promise<InMemoryStore> {
  const facts = await parseBrainFacts(BRAIN_DIR);
  return new InMemoryStore(
    facts.map((f) => ({ entity: f.entity, text: f.text, provenance: f.provenance, kind: f.kind })),
    [{ slug: `people/${profile.slug}`, title: profile.name, summary: profile.relationship }],
  );
}

async function chooseMemory(profile: PersonaProfile, mode: BootstrapOptions["memory"]): Promise<{ memory: MemoryStore; note: string | null }> {
  if (mode === "memory") return { memory: await inMemoryFacts(profile), note: null };
  const url = process.env.GBRAIN_MCP_URL;
  const home = process.env.REMNANT_GBRAIN_HOME ? resolve(process.env.REMNANT_GBRAIN_HOME) : undefined;
  const store = url
    ? new GBrainMemoryStore({ url, token: process.env.GBRAIN_MCP_TOKEN })
    : new GBrainMemoryStore({ home, onStderr: (line) => log("gbrain.stderr", { line }) });
  try {
    await store.connect();
    return { memory: store, note: null };
  } catch (err) {
    const hint = err instanceof GBrainUnavailableError ? err.hint : String(err);
    log("gbrain.unavailable", { backend: store.backend, error: err instanceof Error ? err.message.split("\n")[0] : String(err), hint });
    return { memory: await inMemoryFacts(profile), note: `GBrain unavailable (${hint}). Using in-memory facts parsed from brain/.` };
  }
}

async function chooseProvider(corpus: ImportResult, profile: PersonaProfile, mode: BootstrapOptions["provider"]): Promise<{ provider: ModelProvider; note: string | null }> {
  const fixture = () => new FixtureProvider(corpus.messages, profile.name);
  if (mode === "fixture") return { provider: fixture(), note: null };
  const river = await RiverProvider.detect(resolve(REPO_ROOT, "training/runs/latest.json"));
  if (river) return { provider: river, note: null };
  if (AnthropicProvider.available()) {
    return {
      provider: new AnthropicProvider(),
      note: "No finished River fine-tune (or its sidecar is down). Falling back to the base model + persona prompt.",
    };
  }
  return { provider: fixture(), note: "No model available. Replies are retrieved from the corpus itself." };
}

export async function bootstrap(opts: BootstrapOptions = {}): Promise<AppContext> {
  const { profile, result: corpus } = await loadSarahFixture();
  const [{ memory, note: memoryNote }, { provider, note: providerNote }] = await Promise.all([
    chooseMemory(profile, opts.memory ?? "auto"),
    chooseProvider(corpus, profile, opts.provider ?? "auto"),
  ]);
  const dataDir = opts.dataDir ?? DATA_DIR;
  const monitor = new DependencyMonitor();
  const engine = new PersonaEngine({ profile, corpus: corpus.messages, memory, provider, monitor, realPeople: ["maya"], log });
  const consent = new JsonFileConsentStore(resolve(dataDir, "consent.json"));
  const voice = opts.voice === false ? null : ElevenLabsVoice.fromEnv();
  const voices = new JsonVoiceStore(resolve(dataDir, "voice.json"));
  log("ready", { provider: provider.label, memory: memory.backend, messages: corpus.messages.length, voice: Boolean(voice) });
  return { profile, corpus, memory, memoryNote, provider, providerNote, engine, consent, voice, voices, monitor, log };
}
