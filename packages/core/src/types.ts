/**
 * Shared domain types for Remnant.
 *
 * A persona is built from a corpus of messages between two people:
 *   - "them": the person being reflected (e.g. Sarah)
 *   - "me":   the user who is talking to the reflection
 */

export type Sender = "them" | "me";

export interface Message {
  sender: Sender;
  text: string;
  /** ISO-8601 timestamp. Adapters must normalise to this. */
  timestamp: string;
}

export interface ImportResult {
  /** Which adapter produced this result. */
  source: "imessage-imazing" | "whatsapp" | "fixture";
  /** Display name of the person being reflected, if the export carried one. */
  themName?: string;
  messages: Message[];
  /** Lines the adapter could not parse. Kept so the UI can be honest about loss. */
  skipped: number;
}

/** A single retrieved memory, with the provenance the UI shows. */
export interface MemoryHit {
  id: string;
  text: string;
  /** Where the memory came from (page slug, fact id, fixture key). */
  source: string;
  score?: number;
  kind?: string;
}

export interface PersonaProfile {
  /** URL-safe slug, e.g. "sarah". Also the GBrain entity slug suffix. */
  slug: string;
  name: string;
  /** Relationship of the user to this person, in the user's words. */
  relationship: string;
  /** Whether the person is deceased. Drives the consent gate. */
  deceased: boolean;
  /** ISO timestamp of the last message they sent, if known. */
  lastMessageAt?: string;
}
