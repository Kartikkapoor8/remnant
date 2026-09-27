import { useState } from "react";

interface Props {
  name: string;
  size: 40 | 96;
  /** Faint amber ring around the circle (call screen). */
  ring?: boolean;
}

export const AVATAR_SRC = "/avatar.jpg";

/**
 * Contact photo as a circle. If the file fails to load, falls back to the
 * placeholder: the first letter of the name on the surface color.
 */
export function Avatar({ name, size, ring = false }: Props) {
  const [failed, setFailed] = useState(false);
  const cls = ["avatar", `avatar--${size}`, ring ? "avatar--ring" : ""].filter(Boolean).join(" ");
  if (failed) {
    return (
      <div className={`${cls} avatar--placeholder`} aria-label={name}>
        {name.slice(0, 1)}
      </div>
    );
  }
  return <img className={cls} src={AVATAR_SRC} alt={name} onError={() => setFailed(true)} />;
}
