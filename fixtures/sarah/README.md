# Sarah fixture

`sarah.whatsapp.txt` is a **fictional** WhatsApp (Android export format) chat
between "Sarah" and "Kartik" spanning March 2025 to 27 January 2026. It exists
so the Remnant demo never depends on a live import. Every person, place, pet
and event in it is invented; any resemblance to real people is coincidental.

Canon the rest of the codebase relies on:

- Sarah is the user's partner. Her last message, Tuesday 27 Jan 2026 at 5:12 PM,
  is exactly `love you, going on a drive`. Nothing follows it.
- She opens conversations with `hi hi` (sometimes `hi hi bub`).
- Hair appointment every Tuesday at 4 with Dani.
- Pediatric nurse on night shifts; drives an old green Subaru ("the frog") up
  the coast to "the overlook" to clear her head; sister Maya; beagle Biscuit
  who eats socks; oat milk lattes; Love Island; hates mushrooms; terrible
  pancakes; always late; sunflowers.
- Voice: lowercase, no trailing periods, "haha" never "lol", "ya", "okok",
  "omw", "bub", sparse 🌻 / ❤️, bursts of 2–3 short messages.

`profile.json` is a `PersonaProfile` for her. Load both with
`loadSarahFixture()` from `@remnant/core/fixtures`.
