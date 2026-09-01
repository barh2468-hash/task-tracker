export default function SetupPage() {
  return (
    <main className="login">
      <section className="card">
        <img src="/logo.png" alt="לוגו" />
        <h1>נדרש חיבור Supabase</h1>
        <p className="muted">
          צור קובץ <b>.env.local</b> בתיקיית הפרויקט והוסף את הפרטים מ-Supabase:
        </p>
        <pre className="setupCode">
          VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co{'\n'}
          VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
        </pre>
      </section>
    </main>
  );
}
