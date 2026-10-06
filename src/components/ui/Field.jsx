export default function Field({ label, hint, error, children }) {
  return (
    <label>
      {label}
      {children}
      {hint && !error ? <span className="fieldHint">{hint}</span> : null}
      {error ? <span className="fieldError">{error}</span> : null}
    </label>
  );
}
