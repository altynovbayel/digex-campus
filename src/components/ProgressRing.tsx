interface Props {
  value: number;
  label: string;
}

export function ProgressRing({ value, label }: Props) {
  const clamped = Math.min(100, Math.max(0, value));
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring" role="img" aria-label={`${label}: ${clamped}%`}>
      <svg viewBox="0 0 128 128" aria-hidden="true">
        <circle className="ring__track" cx="64" cy="64" r={r} />
        <circle
          className="ring__value"
          cx="64"
          cy="64"
          r={r}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped / 100)}
        />
      </svg>
      <div className="ring__center" aria-hidden="true">
        <span className="ring__number">
          {clamped}
          <small>%</small>
        </span>
        <span className="ring__label">{label}</span>
      </div>
    </div>
  );
}
