const messages = {
  fixedRole: ['חשבון זה מיועד לדף לקוח לצפייה בלבד.', 'This account is for the view-only client page.', 'Αυτός ο λογαριασμός προορίζεται για τη σελίδα πελάτη μόνο για προβολή.', 'Esta conta destina-se à página do cliente apenas para consulta.'],
  profileMissing: [
    'אין פרופיל פעיל לחשבון דף הלקוח. פנו למנהל המערכת.',
    'No active client page profile was found. Contact your administrator.',
    'Δεν βρέθηκε ενεργό προφίλ σελίδας πελάτη. Επικοινωνήστε με τον διαχειριστή.',
    'Não foi encontrado um perfil ativo da página do cliente. Contacte o administrador.',
  ],
  subtitle: [
    'כניסה מאובטחת עם מייל או שם משתמש וסיסמה',
    'Secure sign-in with email or username and password',
    'Ασφαλής σύνδεση με email ή όνομα χρήστη και κωδικό',
    'Início de sessão seguro com email ou nome de utilizador e palavra-passe',
  ],
  identifier: [
    'מייל או שם משתמש',
    'Email or username',
    'Email ή όνομα χρήστη',
    'Email ou nome de utilizador',
  ],
  placeholder: [
    'מייל ארגוני או שם המשתמש שקיבלתם',
    'Work email or the username you received',
    'Επαγγελματικό email ή το όνομα χρήστη που λάβατε',
    'Email profissional ou nome de utilizador recebido',
  ],
  required: [
    'יש למלא מייל או שם משתמש וסיסמה.',
    'Enter your email or username and password.',
    'Συμπληρώστε email ή όνομα χρήστη και κωδικό.',
    'Preencha o email ou nome de utilizador e a palavra-passe.',
  ],
  invalidCredentials: [
    'פרטי ההתחברות או הסיסמה אינם נכונים.',
    'The sign-in details or password are incorrect.',
    'Τα στοιχεία σύνδεσης ή ο κωδικός δεν είναι σωστά.',
    'Os dados de acesso ou a palavra-passe estão incorretos.',
  ],
  recoveryHelp: [
    'לחשבון עם שם משתמש ללא מייל, פנו למנהל המערכת לשחזור הגישה.',
    'For a username account without email, contact your administrator to recover access.',
    'Για λογαριασμό με όνομα χρήστη χωρίς email, επικοινωνήστε με τον διαχειριστή για ανάκτηση πρόσβασης.',
    'Para uma conta com nome de utilizador sem email, contacte o administrador para recuperar o acesso.',
  ],
  createTitle: [
    'יצירת משתמש לדף לקוח ללא מייל',
    'Create a client page user without email',
    'Δημιουργία χρήστη σελίδας πελάτη χωρίς email',
    'Criar utilizador da página do cliente sem email',
  ],
  createHelp: [
    'המערכת תפיק סיסמה חזקה ותציג אותה פעם אחת. לא תישלח הזמנה במייל. לאחר היצירה יש לאשר פרויקטים לצפייה.',
    'A strong password will be generated and shown once. No email invitation will be sent. Approve projects for viewing after creation.',
    'Θα δημιουργηθεί ισχυρός κωδικός και θα εμφανιστεί μία φορά. Δεν θα σταλεί πρόσκληση email. Εγκρίνετε έργα για προβολή μετά τη δημιουργία.',
    'Será gerada uma palavra-passe forte, apresentada uma única vez. Não será enviado convite por email. Aprove os projetos para consulta após a criação.',
  ],
  username: ['שם משתמש', 'Username', 'Όνομα χρήστη', 'Nome de utilizador'],
  usernameHelp: [
    '3–48 תווים: אותיות באנגלית, ספרות, מקף או קו תחתון.',
    '3–48 characters: English letters, digits, hyphens or underscores.',
    '3–48 χαρακτήρες: λατινικά γράμματα, ψηφία, παύλες ή κάτω παύλες.',
    '3–48 caracteres: letras latinas, algarismos, hífen ou sublinhado.',
  ],
  create: ['יצירת משתמש', 'Create user', 'Δημιουργία χρήστη', 'Criar utilizador'],
  creating: ['יוצר משתמש…', 'Creating user…', 'Δημιουργία χρήστη…', 'A criar utilizador…'],
  created: [
    'המשתמש נוצר בהצלחה',
    'User created successfully',
    'Ο χρήστης δημιουργήθηκε επιτυχώς',
    'Utilizador criado com sucesso',
  ],
  password: ['סיסמה', 'Password', 'Κωδικός', 'Palavra-passe'],
  credentialsHelp: [
    'שמרו את פרטי הכניסה לפני סגירת ההודעה. הסיסמה לא תוצג שוב לאחר הסגירה.',
    'Save these sign-in details before closing. The password will not be shown again after closing.',
    'Αποθηκεύστε τα στοιχεία σύνδεσης πριν κλείσετε. Ο κωδικός δεν θα εμφανιστεί ξανά μετά το κλείσιμο.',
    'Guarde os dados de acesso antes de fechar. A palavra-passe não voltará a ser apresentada após fechar.',
  ],
  closeCredentials: [
    'שמרתי את הפרטים',
    'I saved the details',
    'Αποθήκευσα τα στοιχεία',
    'Guardei os dados',
  ],
  invalidUsername: [
    'שם המשתמש אינו תקין. השתמשו ב־3–48 תווים באנגלית, ספרות, מקף או קו תחתון.',
    'Invalid username. Use 3–48 English letters, digits, hyphens or underscores.',
    'Μη έγκυρο όνομα χρήστη. Χρησιμοποιήστε 3–48 λατινικά γράμματα, ψηφία, παύλες ή κάτω παύλες.',
    'Nome de utilizador inválido. Use 3–48 letras latinas, algarismos, hífen ou sublinhado.',
  ],
  exists: [
    'שם המשתמש כבר קיים. בחרו שם אחר.',
    'This username already exists. Choose another.',
    'Αυτό το όνομα χρήστη υπάρχει ήδη. Επιλέξτε άλλο.',
    'Este nome de utilizador já existe. Escolha outro.',
  ],
  createError: [
    'לא ניתן ליצור את המשתמש כרגע. בדקו את רשימת המשתמשים לפני ניסיון נוסף.',
    'The user could not be created. Check the user list before trying again.',
    'Δεν ήταν δυνατή η δημιουργία χρήστη. Ελέγξτε τη λίστα χρηστών πριν δοκιμάσετε ξανά.',
    'Não foi possível criar o utilizador. Verifique a lista de utilizadores antes de tentar novamente.',
  ],
};
const dictionary = (index) =>
  Object.fromEntries(
    Object.entries(messages).map(([key, values]) => [`clientLogin.${key}`, values[index]]),
  );
export const heClientLogin = dictionary(0);
export const enClientLogin = dictionary(1);
export const elClientLogin = dictionary(2);
export const ptClientLogin = dictionary(3);
