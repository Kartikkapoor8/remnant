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
  type ImportResult,
  type MemoryStore,
  type ModelProvider,
  type PersonaProfile,
} from "@remnant/core";
import { ElevenLabsVoice, JsonVoiceStore } from "@remnant/voice";

export const REPO_ROOT = resolve(import.meta.dir, "../../..");
export const DATA_DIR = resolve(REPO_ROOT, ".remnant");

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

function log(event: string, data: Record<string, unknown>): void {
  console.log(`[remnant] ${event} ${JSON.stringify(data)}`);
}

/** Facts seeded into the InMemoryStore when gbrain is unavailable, mirrored from brain/. */
async function fallbackFacts(): Promise<{ entity: string; text: string; provenance: string }[]> {
  const glob = new Bun.Glob("**/*.md");
  const out: { entity: string; text: string; provenance: string }[] = [];
  const dir = resolve(REPO_ROOT, "brain");
  for await (const rel of glob.scan(dir)) {
    const text = await Bun.file(resolve(dir, rel)).text();
    const body = text.split("## Compiled Truth")[1]?.split("## Timeline")[0] ?? "";
    for (const para of body.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean)) {
      out.push({ entity: "people/sarah", text: para, provenance: `brain/${rel}` });
    }
  }
  return out;
}

async function chooseMemory(): Promise<{ memory: MemoryStore; note: string | null }> {
  const home = process.env.REMNANT_GBRAIN_HOME ? resolve(process.env.REMNANT_GBRAIN_HOME) : undefined;
  const store = new GBrainMemoryStore({ home, onStderr: (line) => log("gbrain.stderr", { line }) });
  try {
    await store.connect();
    return { memory: store, note: null };
  } catch (err) {
    const hint = err instanceof GBrainUnavailableError ? err.hint : String(err);
    log("gbrain.unavailable", { error: err instanceof Error ? err.message.split("\n")[0] : String(err), hint });
    const seed = await fallbackFacts();
    return {
      memory: new InMemoryStore(seed, [{ slug: "people/sarah", title: "Sarah", summary: "partner" }]),
      note: `GBrain unavailable (${hint}). Using in-memory facts parsed from brain/.`,
    };
  }
}

async function chooseProvider(corpus: ImportResult, profile: PersonaProfile): Promise<{ provider: ModelProvider; note: string | null }> {
  const river = await RiverProvider.detect(resolve(REPO_ROOT, "training/runs/latest.json"));
  if (river) return { provider: river, note: null };
  if (AnthropicProvider.available()) {
    return {
      provider: new AnthropicProvider(),
      note: "No finished River fine-tune (or its sidecar is down). Falling back to the base model + persona prompt.",
    };
  }
  return {
    provider: new FixtureProvider(corpus.messages, profile.name),
    note: "No model available. Replies are retrieved from the corpus itself.",
  };
}

export async function bootstrap(): Promise<AppContext> {
  const { profile, result: corpus } = await loadSarahFixture();
  const [{ memory, note: memoryNote }, { provider, note: providerNote }] = await Promise.all([
    chooseMemory(),
    chooseProvider(corpus, profile),
  ]);
  const monitor = new DependencyMonitor();
  const engine = new PersonaEngine({ profile, corpus: corpus.messages, memory, provider, monitor, realPeople: ["maya"], log });
  const consent = new JsonFileConsentStore(resolve(DATA_DIR, "consent.json"));
  const voice = ElevenLabsVoice.fromEnv();
  const voices = new JsonVoiceStore(resolve(DATA_DIR, "voice.json"));
  log("ready", { provider: provider.label, memory: memory.kind, messages: corpus.messages.length, voice: Boolean(voice) });
  return { profile, corpus, memory, memoryNote, provider, providerNote, engine, consent, voice, voices, monitor, log };
}
