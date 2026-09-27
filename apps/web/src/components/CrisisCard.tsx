import type { CrisisCardData } from "../hooks/useConversation.ts";

export function CrisisCard({ data }: { data: CrisisCardData }) {
  return (
    <div className="card card--danger" role="alert">
      <div className="card__title">Remnant, not the reflection</div>
      <p>{data.message}</p>
      <ul>
        {data.resources.map((r) => (
          <li key={r.name}>
            {r.name}: {r.contact} ({r.region})
          </li>
        ))}
      </ul>
    </div>
  );
}
