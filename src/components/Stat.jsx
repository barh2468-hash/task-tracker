export default function Stat({ number, label, icon, onClick, active = false }) {
  return (
    <div
      className={`stat ${onClick ? 'statClickable' : ''} ${active ? 'statActive' : ''}`}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        onClick();
      }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      title={onClick ? `פתח ${label}` : undefined}
      aria-pressed={onClick ? active : undefined}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>{number}</strong>
        {icon}
      </div>
      <span>{label}</span>
    </div>
  );
}
