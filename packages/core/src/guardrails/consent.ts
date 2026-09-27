import type { PersonaProfile } from "../types.ts";

/**
 * consent — building a persona of, or cloning the voice of, a LIVING person
 * requires that person's own consent record. A deceased person requires a
 * relationship attestation from the user. Without a record, we block.
 */

export type ConsentKind = "living-consent" | "deceased-attestation";
export type ConsentScope = "persona" | "voice-clone";

export interface ConsentRecord {
  id: string;
  subjectSlug: string;
  subjectName: string;
  kind: ConsentKind;
  /** Who granted it. For living-consent this must be the subject themself. */
  grantedBy: string;
  relationship: string;
  statement: string;
  grantedAt: string;
  scope: ConsentScope[];
}

export interface ConsentStore {
  list(subjectSlug: string): Promise<ConsentRecord[]>;
  add(record: ConsentRecord): Promise<void>;
}

export class InMemoryConsentStore implements ConsentStore {
  private records: ConsentRecord[] = [];
  constructor(seed: ConsentRecord[] = []) {
    this.records = [...seed];
  }
  async list(subjectSlug: string): Promise<ConsentRecord[]> {
    return this.records.filter((r) => r.subjectSlug === subjectSlug);
  }
  async add(record: ConsentRecord): Promise<void> {
    this.records.push(record);
  }
}

export class JsonFileConsentStore implements ConsentStore {
  constructor(private readonly path: string) {}

  private async readAll(): Promise<ConsentRecord[]> {
    const file = Bun.file(this.path);
    if (!(await file.exists())) return [];
    const text = await file.text();
    if (text.trim().length === 0) return [];
    const parsed: unknown = JSON.parse(text);
    return Array.isArray(parsed) ? (parsed as ConsentRecord[]) : [];
  }

  async list(subjectSlug: string): Promise<ConsentRecord[]> {
    return (await this.readAll()).filter((r) => r.subjectSlug === subjectSlug);
  }

  async add(record: ConsentRecord): Promise<void> {
    const all = await this.readAll();
    all.push(record);
    await Bun.write(this.path, JSON.stringify(all, null, 2));
  }
}

export interface ConsentDecision {
  allowed: boolean;
  reason: string;
  record?: ConsentRecord;
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export async function checkConsent(
  profile: PersonaProfile,
  store: ConsentStore,
  purpose: ConsentScope,
): Promise<ConsentDecision> {
  const records = await store.list(profile.slug);
  const label = purpose === "voice-clone" ? "cloning the voice" : "building a persona";

  if (profile.deceased) {
    const record = records.find((r) => r.kind === "deceased-attestation" && r.scope.includes(purpose));
    if (record) {
      return { allowed: true, reason: `Attested by ${record.grantedBy} (${record.relationship}) on ${record.grantedAt}.`, record };
    }
    return {
      allowed: false,
      reason: `Blocked: ${label} of ${profile.name} requires a relationship attestation covering "${purpose}". None is on record.`,
    };
  }

  const record = records.find(
    (r) => r.kind === "living-consent" && r.scope.includes(purpose) && sameName(r.grantedBy, r.subjectName),
  );
  if (record) {
    return { allowed: true, reason: `${profile.name} consented on ${record.grantedAt}.`, record };
  }
  const wrongGrantor = records.find((r) => r.kind === "living-consent" && r.scope.includes(purpose));
  if (wrongGrantor) {
    return {
      allowed: false,
      reason: `Blocked: ${profile.name} is living, and consent for "${purpose}" was granted by ${wrongGrantor.grantedBy}, not by ${profile.name}. Only the person themself can consent.`,
    };
  }
  return {
    allowed: false,
    reason: `Blocked: ${profile.name} is living. ${label[0]!.toUpperCase()}${label.slice(1)} requires their own consent covering "${purpose}". None is on record.`,
  };
}

export function createAttestation(
  profile: PersonaProfile,
  grantedBy: string,
  statement: string,
  scope: ConsentScope[],
  grantedAt: string = new Date().toISOString(),
): ConsentRecord {
  return {
    id: crypto.randomUUID(),
    subjectSlug: profile.slug,
    subjectName: profile.name,
    kind: profile.deceased ? "deceased-attestation" : "living-consent",
    grantedBy,
    relationship: profile.relationship,
    statement,
    grantedAt,
    scope: [...scope],
  };
}
