export default function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="uiPageHeader">
      <div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className="uiPageActions">{actions}</div> : null}
    </header>
  );
}
