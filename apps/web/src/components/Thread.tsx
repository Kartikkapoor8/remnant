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
        const first = gap || prev?.sender !== item.sender;
        return (
          <div key={item.id}>
            {gap && <TimeGap iso={item.timestamp} />}
            <MessageBubble item={item} first={first} />
          </div>
        );
      })}
      {convo.typing && <TypingIndicator />}
      {convo.crisis && <CrisisCard data={convo.crisis} />}
      {convo.blocked && <div className="card">{convo.blocked}</div>}
      <div ref={bottom} />
    </div>
  );
}
