const entries = {
  'recovery.profileTitle': ['לא ניתן לטעון את החשבון כרגע', 'Your account could not be loaded', 'Δεν ήταν δυνατή η φόρτωση του λογαριασμού σας', 'Não foi possível carregar a sua conta'],
  'recovery.profileHelp': ['בדקו את החיבור ונסו שוב. אם הבעיה נמשכת, פנו למנהל המערכת.', 'Check your connection and try again. If the problem continues, contact your administrator.', 'Ελέγξτε τη σύνδεσή σας και δοκιμάστε ξανά. Αν το πρόβλημα συνεχίζεται, επικοινωνήστε με τον διαχειριστή.', 'Verifique a ligação e tente novamente. Se o problema continuar, contacte o administrador.'],
  'recovery.retry': ['נסה שוב', 'Try again', 'Δοκιμάστε ξανά', 'Tentar novamente'],
  'recovery.signOut': ['יציאה מהחשבון', 'Sign out', 'Αποσύνδεση', 'Terminar sessão'],
  'recovery.filesLoading': ['טוען קישורי קבצים...', 'Loading file links...', 'Φόρτωση συνδέσμων αρχείων...', 'A carregar ligações dos ficheiros...'],
  'recovery.filesFailed': ['חלק מקישורי הקבצים לא נטענו. בדקו את החיבור ונסו שוב.', 'Some file links could not be loaded. Check your connection and try again.', 'Δεν ήταν δυνατή η φόρτωση ορισμένων συνδέσμων αρχείων. Ελέγξτε τη σύνδεσή σας και δοκιμάστε ξανά.', 'Não foi possível carregar algumas ligações dos ficheiros. Verifique a ligação e tente novamente.'],
};
const dictionary = (index) => Object.fromEntries(Object.entries(entries).map(([key, values]) => [key, values[index]]));
export const heRecovery = dictionary(0);
export const enRecovery = dictionary(1);
export const elRecovery = dictionary(2);
export const ptRecovery = dictionary(3);
