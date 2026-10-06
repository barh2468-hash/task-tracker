export default function Card({ muted = false, className = '', as: Tag = 'section', ...props }) {
  return <Tag className={`card${muted ? ' cardMuted' : ''} ${className}`.trim()} {...props} />;
}
