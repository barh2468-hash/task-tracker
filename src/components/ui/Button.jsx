export default function Button({ variant = 'primary', size, className = '', type = 'button', ...props }) {
  const classes = [variant === 'primary' ? '' : variant, size === 'sm' ? 'smallBtn' : '', className]
    .filter(Boolean)
    .join(' ');
  return <button type={type} className={classes || undefined} {...props} />;
}
