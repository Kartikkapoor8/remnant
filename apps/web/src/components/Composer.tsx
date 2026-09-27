import { useState, type FormEvent } from "react";

interface Props {
  disabled: boolean;
  personaName: string;
  onSend: (text: string) => Promise<void>;
}

export function Composer({ disabled, personaName, onSend }: Props) {
  const [text, setText] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const t = text;
    if (!t.trim() || disabled) return;
    setText("");
    await onSend(t);
  };
  return (
    <form className="composer" onSubmit={submit}>
      <input
        className="composer__input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`message ${personaName}`.toLowerCase()}
        autoComplete="off"
        autoCorrect="on"
        enterKeyHint="send"
      />
      <button className="composer__send" type="submit" disabled={disabled || !text.trim()}>
        send
      </button>
    </form>
  );
}
