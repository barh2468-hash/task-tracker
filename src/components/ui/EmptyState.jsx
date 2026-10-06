export default function EmptyState({ icon: Icon, title, description, children }) {
  return (
    <div className="uiEmptyState">
      {Icon ? <Icon size={32} strokeWidth={1.5} aria-hidden="true" /> : null}
      <strong>{title}</strong>
      {description ? <span>{description}</span> : null}
      {children}
    </div>
  );
}
