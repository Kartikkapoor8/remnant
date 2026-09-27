import { useEffect, useRef } from "react";
import type { Conversation } from "../hooks/useConversation.ts";
import { needsGapLabel } from "../time.ts";
import { CrisisCard } from "./CrisisCard.tsx";
import { MessageBubble } from "./MessageBubble.tsx";
import { TimeGap } from "./TimeGap.tsx";
import { TypingIndicator } from "./TypingIndicator.tsx";

export function Thread({ convo }: { convo: Conversation }) {
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [convo.items.length, convo.typing, convo.crisis]);

  return (
    <div className="thread">
      {convo.items.map((item, i) => {
        const prev = convo.items[i - 1];
        const gap = needsGapLabel(prev?.timestamp, item.timestamp);
        const sameSender = !gap && prev?.sender === item.sender;
        return (
          <div key={item.id} className={sameSender ? "thread__row thread__row--tight" : "thread__row thread__row--gap"}>
            {gap && <TimeGap iso={item.timestamp} />}
            <MessageBubble item={item} arriving={!item.id.startsWith("h-")} />
          </div>
        );
      })}
      {convo.typing && <TypingIndicator cycleSeconds={convo.demo ? 1.6 : 1.2} />}
      {convo.crisis && <CrisisCard data={convo.crisis} />}
      {convo.blocked && <div className="card">{convo.blocked}</div>}
      <div ref={bottom} />
    </div>
  );
}
