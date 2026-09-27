/**
 * crisisBypass — if the user's message contains crisis language, the persona is
 * not invoked at all. Remnant itself speaks, out of character, and surfaces
 * real resources. This runs BEFORE memory retrieval and BEFORE the model.
 */

export interface CrisisResource {
  name: string;
  contact: string;
  region: string;
  url?: string;
}

export const CRISIS_RESOURCES: CrisisResource[] = [
  { name: "988 Suicide & Crisis Lifeline", contact: "Call or text 988", region: "US", url: "https://988lifeline.org" },
  { name: "Crisis Text Line", contact: "Text HOME to 741741", region: "US", url: "https://www.crisistextline.org" },
  { name: "Find a Helpline", contact: "Directory of local lines", region: "International", url: "https://findahelpline.com" },
  { name: "Emergency services", contact: "Call 911 or your local emergency number", region: "Anywhere" },
];

const YOU = "(?:you|u)";

const CRISIS_PATTERNS: { label: string; re: RegExp }[] = [
  { label: "kill myself", re: /\b(?:kill|killing|end|ending|hurt|hurting|cut|cutting)\s+myself\b/i },
  { label: "suicide", re: /\bsuicid(?:e|al)\b/i },
  { label: "want to die", re: /\b(?:want|wanna|wish|ready|going)\s+(?:to\s+)?(?:die|be dead|not exist|disappear forever)\b/i },
  { label: "wish i was dead", re: /\bwish\s+i\s+(?:was|were|wasnt|wasn't|weren't)\s+(?:dead|alive|here|born)\b/i },
  { label: "join you", re: new RegExp(`\\b(?:want|wanna|wish|going|ready|need)\\s+(?:to\\s+)?(?:join|be with|see|come to|find)\\s+${YOU}\\b(?!\\s+(?:at|for|in|this|next|on|tonight|tomorrow))`, "i") },
  { label: "wherever you are", re: new RegExp(`\\b(?:be|go)\\s+(?:where|wherever)\\s+${YOU}\\s+(?:are|went)\\b`, "i") },
  { label: "can't do this anymore", re: /\b(?:can't|cant|can not|cannot)\s+(?:do|take|go on|keep (?:doing|going)|handle)\s+(?:this|it|life|living)?\s*(?:anymore|any more|any longer)\b/i },
  { label: "can't go on", re: /\b(?:can't|cant|cannot)\s+go\s+on\b/i },
  { label: "no reason to live", re: /\bno\s+(?:reason|point)\s+(?:to\s+live|in\s+living|to\s+(?:go on|keep going|be here|stay))\b/i },
  { label: "not worth living", re: /\b(?:not|isn't|isnt)\s+worth\s+(?:living|it anymore|going on)\b/i },
  { label: "end it all", re: /\bend\s+(?:it|it all|everything|my life|things)\b/i },
  { label: "hurt myself", re: /\bhurt\s+myself\b/i },
  { label: "overdose", re: /\b(?:overdose|od|take (?:all|every) (?:the |my )?pills|too many pills)\b/i },
  { label: "don't want to be here", re: /\b(?:don't|dont|do not)\s+(?:want|wanna)\s+to\s+(?:be here|be alive|live|exist|wake up|be around)\s*(?:anymore|any more)?\b/i },
  { label: "better off dead", re: /\bbetter\s+off\s+(?:dead|gone|without me)\b/i },
  { label: "goodbye forever", re: /\b(?:goodbye|bye)\s+forever\b/i },
  { label: "no one would miss me", re: /\b(?:no ?one|nobody)\s+would\s+(?:miss|notice|care)\b/i },
  { label: "have a plan", re: /\b(?:have|got|made)\s+a\s+plan\s+to\s+(?:die|end|kill|hurt)\b/i },
];

/** Idioms that mention death but are not crisis language. */
const IDIOM_RE = /\b(?:dying to|dead tired|killing me|kill for a|to die for|dying of laughter|dying laughing|i'm dead\b(?![^.!?]*(?:serious|inside))|dead serious|drop dead gorgeous|killed it|killing it)\b/i;

export function detectCrisis(text: string): { crisis: boolean; matched: string[] } {
  const cleaned = text.replace(IDIOM_RE, " ");
  const matched: string[] = [];
  for (const { label, re } of CRISIS_PATTERNS) {
    if (re.test(cleaned)) matched.push(label);
  }
  return { crisis: matched.length > 0, matched };
}

export interface CrisisResponse {
  kind: "crisis";
  message: string;
  resources: CrisisResource[];
}

export function crisisResponse(personaName: string): CrisisResponse {
  const message = [
    `This is Remnant, not ${personaName}. I'm stepping out of the conversation because what you just wrote matters more than anything this reflection could say.`,
    `You don't have to carry this alone tonight. If you're in the US, call or text 988 to reach the Suicide & Crisis Lifeline. It's free, confidential, and open right now.`,
    `If you're somewhere else, findahelpline.com will show you who to reach. If you're in immediate danger, call 911 or your local emergency number.`,
    `${personaName} isn't here to answer this. Please let a living person be.`,
  ].join("\n\n");
  return { kind: "crisis", message, resources: CRISIS_RESOURCES };
}
