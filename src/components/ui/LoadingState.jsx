export default function LoadingState({ label }) {
  return (
    <div className="uiLoading" role="status">
      <span className="uiSpinner" aria-hidden="true" />
      {label ? <span>{label}</span> : null}
    </div>
  );
}
