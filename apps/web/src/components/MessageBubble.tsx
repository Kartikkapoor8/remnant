import type { ThreadItem } from "../hooks/useConversation.ts";

interface Props {
  item: ThreadItem;
  first: boolean;
}

export function MessageBubble({ item, first }: Props) {
  const cls = ["bubble", item.sender === "me" ? "bubble--me" : "bubble--them", first ? "bubble--first" : ""].filter(Boolean).join(" ");
  return (
    <div className={cls} title={item.memories?.length ? `memories: ${item.memories.join(", ")}` : undefined}>
      {item.text}
    </div>
  );
}
