import { relativeLabel } from "../time.ts";

export function TimeGap({ iso }: { iso: string }) {
  return <div className="gap">{relativeLabel(iso)}</div>;
}
