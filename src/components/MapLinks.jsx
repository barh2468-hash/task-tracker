export default function MapLinks({ startLinks, endLinks }) {
  if (!startLinks.length && !endLinks.length) return <span className="muted">לא נשמר מיקום</span>;
  return (
    <div className="mapLinks">
      {startLinks.slice(0, 3).map((link, i) => (
        <a key={`s-${link}`} href={link} target="_blank" rel="noreferrer">
          התחלה {i + 1}
        </a>
      ))}
      {endLinks.slice(0, 3).map((link, i) => (
        <a key={`e-${link}`} href={link} target="_blank" rel="noreferrer">
          סיום {i + 1}
        </a>
      ))}
      {startLinks.length + endLinks.length > 6 && <span className="muted">ועוד...</span>}
    </div>
  );
}
