/** Inline test corpus (Sarah-style "them", formal "me"). Not the demo fixture. */
import type { Message } from "../types.ts";

const base = Date.parse("2025-03-01T09:00:00Z");
let t = base;
const mk = (sender: "them" | "me", text: string, gapSec: number): Message => {
  t += gapSec * 1000;
  return { sender, text, timestamp: new Date(t).toISOString() };
};

export const SARAH_STYLE: Message[] = [
  mk("them", "hi hi", 0),
  mk("them", "u up bub", 20),
  mk("me", "Yes, just made coffee. How are you?", 120),
  mk("them", "good good", 40),
  mk("them", "im soooo tired tho haha", 15),
  mk("them", "biscuit ate a sock again 🌻", 30),
  mk("me", "That dog is a menace. Vet again?", 90),
  mk("them", "ya prob", 25),
  mk("them", "okok gtg omw to work", 20),
  mk("me", "Drive safe.", 60),
  mk("them", "love u ❤️", 10),

  mk("them", "hi hi", 6 * 3600),
  mk("them", "dont forget dinner at moms", 30),
  mk("me", "I won't. Should I bring wine?", 200),
  mk("them", "ya the red one", 22),
  mk("them", "thats the one she likes", 12),
  mk("me", "Got it.", 40),
  mk("them", "ur the best bub", 18),
  mk("them", "haha she will pretend she doesnt care", 35),

  mk("them", "heyyy", 5 * 3600),
  mk("them", "hair appt ran long", 25),
  mk("me", "No problem. Want me to pick you up?", 100),
  mk("them", "ya pls", 15),
  mk("them", "omw out now", 40),
  mk("me", "Okay, leaving in 5.", 30),
  mk("them", "okok", 8),
  mk("them", "cant wait to see u bub 🌻", 20),

  mk("them", "hi hi", 8 * 3600),
  mk("them", "did u eat", 12),
  mk("me", "Not yet. Long day at work.", 300),
  mk("them", "im making pasta come over", 30),
  mk("them", "biscuit misses u haha", 20),
  mk("me", "Be there at 7.", 45),
  mk("them", "ya perfect", 10),
  mk("them", "love u", 15),

  mk("them", "hey", 7 * 3600),
  mk("them", "youre gonna laugh", 20),
  mk("them", "i locked myself out again haha", 18),
  mk("me", "Again? I'll bring the spare key.", 120),
  mk("them", "thank u bub ❤️", 20),
  mk("them", "ok wait nvm found it", 60),
];
