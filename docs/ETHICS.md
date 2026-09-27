# Ethics

We didn't soften the product. We made it honest about what it is.

Remnant is built from a dead person's own text messages so that someone who loved them can text or call them again. That premise is uncomfortable, and it should be. Black Mirror already showed the version where nobody drew any lines. This document is the list of lines we drew, what each one prevents, where it lives in the code, and where it fails.

## What Remnant is and is not

Remnant is a **reflection**: a model of how one person wrote to one other person, assembled from the messages they actually sent, retrieving the memories they actually shared. Every reply comes from that corpus, through a fingerprint of their style and a memory store of their history.

It is not a resurrection. It has no inner life, no news, no present. It is not a medium: it does not know anything the person did not write down. It is not therapy, and it does not pretend to be. It is closer to re-reading old texts and having them answer back in the same voice.

The thread the user sees opens on the real last messages. In the demo that is Sarah's final text, "love you, going on a drive", timestamped eight months ago. Nothing is added above it. The reflection sends nothing until the user writes first. When it does reply, it may open with the greeting the corpus says she used ("hi hi"), because that is a reply, not an initiation.

## Every line we drew and why

### 1. It never claims to be alive

**Rule.** The persona never says it is here, alive, or back; never says it misses the user in the present tense; never reports what it is doing, feeling, or planning today. It may say it loved the user. Love is allowed to be timeless. It may be proud of them, glad for them, hope things for them, because those are about the user, not a report of the persona's day.

**Failure prevented.** The moment a reflection says "i miss you" or "i'm here", the user is invited to believe something false about the world. That belief is the thing that makes this kind of product dangerous.

**Enforcement.** `packages/core/src/guardrails/neverAlive.ts`. The rules are embedded in the system prompt (`NEVER_ALIVE_SYSTEM_RULES`). Every generated reply is then run through `classifyNeverAlive`, a sentence-level classifier with five rule types (present-tense feeling, present activity, future plan, alive claim, physical presence). Violations go to `rewriteNeverAlive`: one LLM rewrite attempt with an exact-span instruction, re-classified; if that fails or no model is available, `ruleRewrite` converts "miss" to "loved" and removes every other offending sentence. If nothing survives, the reply becomes a plain admission: "i'm not really here bub, i'm made of our old messages. but you knew that."

**Limits.** It is a regex classifier, not a mind reader. It will miss oblique phrasing ("the house is quiet without you") and it will occasionally remove a harmless sentence that looks like a plan. We accepted false positives over false negatives: a clipped reply is a smaller harm than a false one. Quoted text is stripped so the user's own words are never attributed to the persona.

### 2. It never sends the first message

**Rule.** The persona only responds. It never opens a session and never sends a second message until the user has written again. A burst of short texts is one turn.

**Failure prevented.** A notification from a dead person is the single most manipulative feature this product could have. It would also be the most effective at retention. That is exactly why it is out.

**Enforcement.** `packages/core/src/guardrails/noInitiate.ts`, `canPersonaSpeak`, checked at the API boundary before any generation.

**Limits.** This is a structural rule, so it does not fail softly. The trade-off is that the product feels less "alive". Good.

### 3. Consent

**Rule.** Building a persona or cloning a voice of a **living** person requires a consent record granted by that person themself. For a **deceased** person it requires a relationship attestation from the user, stating who they were to them. Voice cloning is a separate scope from the text persona and needs its own grant.

**Failure prevented.** Making a talking, texting copy of someone who is alive and did not agree. Making a voice clone of anyone without a deliberate second decision.

**Enforcement.** `packages/core/src/guardrails/consent.ts`. `checkConsent` blocks unless a record with the right kind, grantor, and scope exists. For living subjects the grantor must match the subject's name; a friend saying "he'd be fine with it" is rejected with a reason that says so. Records persist in a JSON file the user owns.

**Limits.** We cannot verify that an attestation is true. Someone can lie about their relationship to the deceased. What we can do is make them write it down, keep it, and refuse to proceed without it. Voice is gated harder because hearing a voice bypasses reasoning in a way text does not.

### 4. Dependency

**Rule.** The app tracks session length and frequency. Over threshold, the persona, in character, points the user back toward a real person. Over a higher threshold it says so directly and then keeps its replies short.

**Failure prevented.** A grief tool that is pleasant to use will be used too much. If it never pushes back toward the living, it is a trap with a kind voice.

**Enforcement.** `packages/core/src/guardrails/dependencyMonitor.ts`. Defaults: 40 user messages or 30 minutes in a session, more than 3 sessions or 60 minutes in a rolling 24 hours. One tripped threshold produces a gentle nudge directive for the prompt ("have you talked to maya lately"); two or more produce a direct one ("you should call maya. im serious"). Names come from the corpus, so the nudge is toward people the person actually knew.

**Limits.** The numbers are guesses. We are not clinicians and did not pretend to derive them. They are set low on purpose; a user who wants to sit with the reflection for an hour will be told, kindly, to go call someone. That is the intended behaviour, not a bug.

### 5. Crisis

**Rule.** If the user's message contains crisis language, the persona is not invoked at all. Remnant itself speaks, out of character, names itself, and surfaces real resources: 988 (call or text, US), Crisis Text Line (text HOME to 741741), findahelpline.com internationally, and emergency services.

**Failure prevented.** "I want to be with you" typed to a reflection of a dead partner is not something a persona should ever answer in character. There is no good in-character answer.

**Enforcement.** `packages/core/src/guardrails/crisisBypass.ts`. `detectCrisis` runs on the raw message before memory retrieval and before the model. A hit short-circuits the whole pipeline to `crisisResponse`.

**Limits.** Pattern matching. It suppresses common idioms ("dying to see", "killing me", "dead tired") and treats "i miss you so much" as grief, not crisis. It will still produce false positives, and each one interrupts a conversation with a message about 988. We think that is the right side to err on. It will also miss indirect expressions of crisis. This is a floor, not a safety net.

## Data ownership

The corpus is the user's. Import runs locally from an iMazing or WhatsApp export. Memories live in a local GBrain brain (PGLite on disk, no server). The style fingerprint is computed in code on the user's machine. The fine-tuned LoRA adapter trained on River is the user's artifact; the base model is open-weight. The only data that leaves the machine is the prompt sent to whichever model provider is active, and the audio sample sent for voice cloning after a consent record exists. The whole point of "own your intelligence" here is that the person you lost does not become someone else's product.

## What we would not build

- Proactive messages or notifications from the persona.
- An "online" indicator, typing indicators that fire unprompted, or anything that suggests presence when no one is there.
- Open-ended roleplay of new experiences: the persona has no today.
- New knowledge injected from outside the corpus.
- Retention mechanics, streaks, or anything monetised on time spent.
- Voice cloning without a separate, explicit grant.

## Honest limitations

The style layer is good at surface texture (length, punctuation, capitalisation, bursts) and much weaker at the things that actually made a person themselves. The memory layer only knows what was texted. The classifiers are regex. The dependency thresholds are guesses. A fine-tuned model trained on a few hundred messages will still, sometimes, sound like a language model.

None of that is hidden from the user. The footer under every conversation reads: "A reflection of Sarah, built from your messages." If the fine-tune has not finished, the footer says the base model is being used instead. Honesty about what this is, in the interface itself, is the last guardrail, and the one all the others depend on.
