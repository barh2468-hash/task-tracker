const messages = {
  client: ['הלקוח:', 'Client:', 'Πελάτης:', 'Cliente:'],
  technical: ['שיטת העבודה והציוד', 'Method and equipment', 'Μέθοδος και εξοπλισμός', 'Método e equipamento'],
  gallery: ['תיעוד וממצאים', 'Evidence and imagery', 'Τεκμηρίωση και εικόνες', 'Documentação e imagens'],
  imagesLoading: ['טוען תמונות…', 'Loading images…', 'Φόρτωση εικόνων…', 'A carregar imagens…'],
  imagesError: ['לא ניתן להציג חלק מהתמונות. אפשר לנסות שוב.', 'Some images could not be displayed. Please try again.', 'Δεν ήταν δυνατή η προβολή ορισμένων εικόνων. Δοκιμάστε ξανά.', 'Não foi possível apresentar algumas imagens. Tente novamente.'],
  enlarge: ['הגדלת תמונה: {{caption}}', 'Enlarge image: {{caption}}', 'Μεγέθυνση εικόνας: {{caption}}', 'Ampliar imagem: {{caption}}'],
  imagePreview: ['תמונה מוגדלת ממקרה הבוחן', 'Case study image preview', 'Προεπισκόπηση εικόνας μελέτης', 'Pré-visualização da imagem do estudo'],
  closeImage: ['סגירת התמונה', 'Close image', 'Κλείσιμο εικόνας', 'Fechar imagem'],
  editingLanguage: ['שפת התוכן לעריכה', 'Content language to edit', 'Γλώσσα περιεχομένου για επεξεργασία', 'Idioma do conteúdo a editar'],
  hebrew: ['עברית', 'Hebrew', 'Εβραϊκά', 'Hebraico'],
  english: ['אנגלית', 'English', 'Αγγλικά', 'Inglês'],
  previewLibrary: ['תצוגה מקדימה של דף הלקוח', 'Preview client page', 'Προεπισκόπηση σελίδας πελάτη', 'Pré-visualizar página do cliente'],
  draftPreview: ['תצוגה מקדימה למנהל · כוללת פרויקטים שטרם פורסמו', 'Manager preview · Includes unpublished projects', 'Προεπισκόπηση διαχειριστή · Περιλαμβάνει μη δημοσιευμένα έργα', 'Pré-visualização do gestor · Inclui projetos não publicados'],
  backManagement: ['חזרה לניהול דף הלקוח', 'Back to client page management', 'Επιστροφή στη διαχείριση σελίδας πελάτη', 'Voltar à gestão da página do cliente'],
  read: ['קריאת מקרה הבוחן', 'Read case study', 'Διαβάστε τη μελέτη', 'Ler estudo de caso'],
  label: ['מקרה בוחן', 'Case study', 'Μελέτη περίπτωσης', 'Estudo de caso'],
  back: ['חזרה למקרי הבוחן', 'Back to case studies', 'Πίσω στις μελέτες περίπτωσης', 'Voltar aos estudos de caso'],
  contents: ['בעמוד זה', 'On this page', 'Σε αυτή τη σελίδα', 'Nesta página'],
  challenge: ['האתגר', 'The challenge', 'Η πρόκληση', 'O desafio'],
  work_process: ['דרך העבודה', 'Our approach', 'Η προσέγγισή μας', 'A nossa abordagem'],
  solution: ['הפתרון', 'The solution', 'Η λύση', 'A solução'],
  outcome: ['התוצאה', 'The outcome', 'Το αποτέλεσμα', 'O resultado'],
  source: ['צפייה במסמך המקור', 'View source document', 'Προβολή αρχικού εγγράφου', 'Ver documento original'],
  loading: ['טוען מסמך לצפייה…', 'Loading document…', 'Φόρτωση εγγράφου…', 'A carregar documento…'],
  pdfError: ['לא ניתן להציג את המסמך כרגע. בדקו את החיבור ונסו שוב.', 'The document could not be displayed. Check your connection and try again.', 'Δεν ήταν δυνατή η προβολή του εγγράφου. Ελέγξτε τη σύνδεση και δοκιμάστε ξανά.', 'Não foi possível apresentar o documento. Verifique a ligação e tente novamente.'],
  retry: ['ניסיון נוסף', 'Try again', 'Δοκιμάστε ξανά', 'Tentar novamente'],
  page: ['עמוד {{page}} מתוך {{total}}', 'Page {{page}} of {{total}}', 'Σελίδα {{page}} από {{total}}', 'Página {{page}} de {{total}}'],
  edit: ['עריכת תוכן מקרה הבוחן', 'Edit case study content', 'Επεξεργασία μελέτης περίπτωσης', 'Editar conteúdo do estudo de caso'],
  editNamed: ['עריכת מקרה בוחן: {{title}}', 'Edit case study: {{title}}', 'Επεξεργασία μελέτης: {{title}}', 'Editar estudo de caso: {{title}}'],
  save: ['שמירת עמוד מקרה הבוחן', 'Save case study page', 'Αποθήκευση σελίδας μελέτης', 'Guardar página do estudo de caso'],
  saved: ['עמוד מקרה הבוחן נשמר.', 'Case study page saved.', 'Η σελίδα της μελέτης αποθηκεύτηκε.', 'Página do estudo de caso guardada.'],
  editorHelp: ['התוכן יוצג כעמוד קריאה בתוך האפליקציה. אפשר למלא רק את הסעיפים הרלוונטיים; מסמך המקור זמין לצפייה בתוך העמוד.', 'This content appears as a reading page in the app. Fill in the relevant sections; the source document can also be viewed within the page.', 'Το περιεχόμενο εμφανίζεται ως σελίδα ανάγνωσης στην εφαρμογή. Συμπληρώστε τις σχετικές ενότητες· το αρχικό έγγραφο προβάλλεται επίσης μέσα στη σελίδα.', 'Este conteúdo aparece como página de leitura na aplicação. Preencha as secções relevantes; o documento original também pode ser consultado na página.'],
};
const dictionary = (index) => Object.fromEntries(Object.entries(messages).map(([key, values]) => [`caseStudy.${key}`, values[index]]));
export const heArticles = dictionary(0);
export const enArticles = dictionary(1);
export const elArticles = dictionary(2);
export const ptArticles = dictionary(3);
