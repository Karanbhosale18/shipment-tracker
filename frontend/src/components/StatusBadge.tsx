import type { StatusValue } from "../types";

export function StatusBadge({ status, label }: { status: StatusValue; label: string }) {
  return (
    <span className={`badge badge-${status.toLowerCase()}`}>
      <span className="dot" aria-hidden />
      {label}
    </span>
  );
}
