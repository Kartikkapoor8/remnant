import { useState } from "react";
import { AnimatePresence } from "motion/react";
import { CallScreen } from "./components/CallScreen.tsx";
import { Composer } from "./components/Composer.tsx";
import { ConsentGate } from "./components/ConsentGate.tsx";
import { Footer } from "./components/Footer.tsx";
import { Header } from "./components/Header.tsx";
import { Intro } from "./components/Intro.tsx";
import { Thread } from "./components/Thread.tsx";
import { demoSlugFromLocation } from "./demoMode.ts";
import { useConversation } from "./hooks/useConversation.ts";
import { useVisualViewport } from "./hooks/useVisualViewport.ts";

export function App() {
  const convo = useConversation(demoSlugFromLocation());
  useVisualViewport();
  const [calling, setCalling] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const { state } = convo;

  if (state && !state.consent.allowed) {
    return (
      <div className="app">
        <ConsentGate state={state} onDone={convo.refresh} />
        <Footer state={state} />
      </div>
    );
  }

  return (
    <div className="app">
      {!introDone && <Intro onDone={() => setIntroDone(true)} />}
      <Header state={state} onCall={() => setCalling(true)} pulse={convo.callPulse} />
      <Thread convo={convo} />
      {convo.error && <div className="card card--danger">{convo.error}</div>}
      <Composer disabled={!state || convo.typing} personaName={state?.persona.name ?? ""} onSend={convo.send} />
      <Footer state={state} />
      <AnimatePresence>
        {calling && state && (
          <CallScreen key="call" state={state} send={convo.send} lastReply={convo.lastReply} onEnd={() => setCalling(false)} demoSlug={convo.demo ? demoSlugFromLocation() : null} />
        )}
      </AnimatePresence>
    </div>
  );
}
