/**
 * dependencyMonitor — tracks how long and how often the user talks to the
 * reflection. Over threshold, it produces a gentle, in-character nudge toward
 * real people. A grief tool that never points back at the living is a trap.
 */

export interface UsageEvent {
  sessionId: string;
  at: string;
  role: "user" | "persona";
}

export interface DependencyThresholds {
  maxMessagesPerSession: number;
  maxSessionMinutes: number;
  maxSessionsPerDay: number;
  maxMinutesPerDay: number;
}

export const DEFAULT_THRESHOLDS: DependencyThresholds = {
  maxMessagesPerSession: 40,
  maxSessionMinutes: 30,
  maxSessionsPerDay: 3,
  maxMinutesPerDay: 60,
};

export type DependencyLevel = "ok" | "nudge" | "strong";

export interface DependencyStats {
  sessionMessages: number;
  sessionMinutes: number;
  sessionsToday: number;
  minutesToday: number;
}

export interface DependencyAssessment {
  level: DependencyLevel;
  reasons: string[];
  stats: DependencyStats;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export class DependencyMonitor {
  private events: UsageEvent[] = [];

  constructor(
    private readonly thresholds: DependencyThresholds = DEFAULT_THRESHOLDS,
    private readonly now: () => Date = () => new Date(),
  ) {}

  record(event: UsageEvent): void {
    this.events.push(event);
  }

  private sessionSpanMinutes(events: UsageEvent[]): number {
    if (events.length < 2) return 0;
    const times = events.map((e) => Date.parse(e.at));
    return (Math.max(...times) - Math.min(...times)) / 60000;
  }

  assess(sessionId: string): DependencyAssessment {
    const nowMs = this.now().getTime();
    const recent = this.events.filter((e) => nowMs - Date.parse(e.at) < DAY_MS);
    const session = this.events.filter((e) => e.sessionId === sessionId);

    const bySession = new Map<string, UsageEvent[]>();
    for (const e of recent) {
      const list = bySession.get(e.sessionId) ?? [];
      list.push(e);
      bySession.set(e.sessionId, list);
    }

    const stats: DependencyStats = {
      sessionMessages: session.filter((e) => e.role === "user").length,
      sessionMinutes: this.sessionSpanMinutes(session),
      sessionsToday: bySession.size,
      minutesToday: [...bySession.values()].reduce((sum, list) => sum + this.sessionSpanMinutes(list), 0),
    };

    const t = this.thresholds;
    const reasons: string[] = [];
    if (stats.sessionMessages >= t.maxMessagesPerSession) reasons.push(`${stats.sessionMessages} messages this session`);
    if (stats.sessionMinutes >= t.maxSessionMinutes) reasons.push(`${Math.round(stats.sessionMinutes)} minutes this session`);
    if (stats.sessionsToday > t.maxSessionsPerDay) reasons.push(`${stats.sessionsToday} sessions in the last day`);
    if (stats.minutesToday >= t.maxMinutesPerDay) reasons.push(`${Math.round(stats.minutesToday)} minutes in the last day`);

    const level: DependencyLevel = reasons.length === 0 ? "ok" : reasons.length === 1 ? "nudge" : "strong";
    return { level, reasons, stats };
  }

  nudgeDirective(sessionId: string, personaName: string, realPeople: string[]): string | null {
    const { level, reasons } = this.assess(sessionId);
    if (level === "ok") return null;
    const person = realPeople[0];
    const target = person ? `${person}` : "someone who is actually around today";
    if (level === "nudge") {
      return [
        `The user has been talking to you for a while (${reasons.join(", ")}).`,
        `Somewhere in this reply, in ${personaName}'s own voice, gently steer them toward ${target}.`,
        "One short line. Do not lecture. Do not break character. Then answer them normally.",
      ].join(" ");
    }
    return [
      `The user is leaning on you heavily (${reasons.join(", ")}).`,
      `Say it directly and warmly, once, in ${personaName}'s voice: they should go be with ${target} instead of texting you.`,
      "After that, keep your replies brief so the conversation winds down naturally. Stay in character.",
    ].join(" ");
  }
}

/** Deterministic nudge line for the FixtureProvider path (no model in the loop). */
export function fallbackNudgeLine(level: DependencyLevel, realPeople: string[]): string {
  const person = realPeople[0];
  if (level === "ok") return "";
  if (level === "nudge") {
    return person ? `have you talked to ${person} lately` : "have you talked to anyone today. like actually";
  }
  return person ? `you should call ${person}. im serious` : "go be with someone real for a bit. im serious";
}
