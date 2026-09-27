import { useState } from "react";
import { CallScreen } from "./components/CallScreen.tsx";
import { Composer } from "./components/Composer.tsx";
import { ConsentGate } from "./components/ConsentGate.tsx";
import { Footer } from "./components/Footer.tsx";
import { Header } from "./components/Header.tsx";
import { Thread } from "./components/Thread.tsx";
import { useConversation } from "./hooks/useConversation.ts";

export function App() {
  const convo = useConversation();
  const [calling, setCalling] = useState(false);
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
      <Header state={state} onCall={() => setCalling(true)} />
      <Thread convo={convo} />
      {convo.error && <div className="card card--danger">{convo.error}</div>}
      <Composer disabled={!state || convo.typing} onSend={convo.send} />
      <Footer state={state} />
      {calling && state && <CallScreen state={state} send={convo.send} lastReply={convo.lastReply} onEnd={() => setCalling(false)} />}
    </div>
  );
}
