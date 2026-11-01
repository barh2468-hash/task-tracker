// Complete translations for shared UI labels and messages.
const entries = [
  [
    ": לא נשמר",
    ": not saved",
    ": δεν αποθηκεύτηκε",
    ": não guardada"
  ],
  [
    ": פתח במפה",
    ": open map",
    ": άνοιγμα χάρτη",
    ": abrir no mapa"
  ],
  [
    " · דיוק כ-{{value0}} מ׳",
    " · accuracy approx. {{value0}} m",
    " · ακρίβεια περίπου {{value0}} μ.",
    " · precisão aprox. {{value0}} m"
  ],
  [
    "מדריך לשימוש",
    "User guide",
    "Οδηγός χρήσης",
    "Guia de utilização"
  ],
  [
    "משהו לא עובד?",
    "Something not working?",
    "Κάτι δεν λειτουργεί;",
    "Algo não funciona?"
  ],
  [
    "קוד כרטיס",
    "Account code",
    "Κωδικός λογαριασμού",
    "Código da conta"
  ],
  [
    "שמירה",
    "Save",
    "Αποθήκευση",
    "Guardar"
  ],
  [
    "סיכום הדוח",
    "Report summary",
    "Σύνοψη αναφοράς",
    "Resumo do relatório"
  ],
  [
    "חודש הדוח",
    "Report month",
    "Μήνας αναφοράς",
    "Mês do relatório"
  ],
  [
    "פער מע\"מ שנכנס לרכב האחרון",
    "VAT difference allocated to the last vehicle",
    "Διαφορά ΦΠΑ που κατανεμήθηκε στο τελευταίο όχημα",
    "Diferença de IVA imputada ao último veículo"
  ],
  [
    "בדיקות",
    "Checks",
    "Έλεγχοι",
    "Verificações"
  ],
  [
    "רכבים ללא כרטיס — יש להזין קוד כרטיס",
    "Vehicles without an account — enter an account code",
    "Οχήματα χωρίς λογαριασμό — εισαγάγετε κωδικό λογαριασμού",
    "Veículos sem conta — introduza um código de conta"
  ],
  [
    "הורדת כל קבצי היבוא (ZIP)",
    "Download all import files (ZIP)",
    "Λήψη όλων των αρχείων εισαγωγής (ZIP)",
    "Descarregar todos os ficheiros de importação (ZIP)"
  ],
  [
    "כל פקודה היא קובץ נפרד — סאפ מקבל כותרת אחת בלבד בכל קובץ. יש לייבא אותם בזה אחר זה.",
    "Each journal entry is a separate file — SAP accepts only one header per file. Import them one after another.",
    "Κάθε λογιστική εγγραφή είναι ξεχωριστό αρχείο — το SAP δέχεται μόνο μία κεφαλίδα ανά αρχείο. Εισαγάγετέ τα διαδοχικά.",
    "Cada lançamento é um ficheiro separado — o SAP aceita apenas um cabeçalho por ficheiro. Importe-os sequencialmente."
  ],
  [
    "אפשר להוריד רק כשכל הבדיקות עוברות.",
    "Download is available only when all checks pass.",
    "Η λήψη είναι διαθέσιμη μόνο όταν περάσουν όλοι οι έλεγχοι.",
    "A transferência só está disponível quando todas as verificações forem aprovadas."
  ],
  [
    "שלב",
    "Step",
    "Βήμα",
    "Passo"
  ],
  [
    "אסמכתא",
    "Reference",
    "Αναφορά",
    "Referência"
  ],
  [
    "הקצאה",
    "Allocation",
    "Κατανομή",
    "Imputação"
  ],
  [
    "לא נמצאה משמרת כללית פתוחה.",
    "No open general shift was found.",
    "Δεν βρέθηκε ανοιχτή γενική βάρδια.",
    "Não foi encontrado nenhum turno geral em aberto."
  ],
  [
    "{{value0}} פעיל",
    "{{value0}} active",
    "{{value0}} ενεργό",
    "{{value0}} ativo"
  ],
  [
    "דווח: {{value0}}",
    "Reported: {{value0}}",
    "Δηλώθηκε: {{value0}}",
    "Reportado: {{value0}}"
  ],
  [
    "הדיווח {{value0}} נשמר להיום וניתן לעדכן אותו.",
    "The {{value0}} report was saved for today and can be updated.",
    "Η αναφορά {{value0}} αποθηκεύτηκε για σήμερα και μπορεί να ενημερωθεί.",
    "O registo {{value0}} foi guardado para hoje e pode ser atualizado."
  ],
  [
    "המשמרת האחרונה הסתיימה ב-{{value0}}",
    "The last shift ended at {{value0}}",
    "Η τελευταία βάρδια έληξε στις {{value0}}",
    "O último turno terminou às {{value0}}"
  ],
  [
    "סה״כ נוכחות היום:",
    "Total attendance today:",
    "Συνολική παρουσία σήμερα:",
    "Total de presença hoje:"
  ],
  [
    "תחילת {{value0}}",
    "Start {{value0}}",
    "Έναρξη {{value0}}",
    "Iniciar {{value0}}"
  ],
  [
    "שליחת הסיכום נכשלה: {{value0}}",
    "Sending the summary failed: {{value0}}",
    "Η αποστολή της σύνοψης απέτυχε: {{value0}}",
    "Falha no envio do resumo: {{value0}}"
  ],
  [
    "דיווחי נוכחות היום",
    "Today's attendance reports",
    "Σημερινές αναφορές παρουσίας",
    "Registos de presença de hoje"
  ],
  [
    "משמרות פתוחות",
    "Open shifts",
    "Ανοιχτές βάρδιες",
    "Turnos em aberto"
  ],
  [
    "שעון הנוכחות הכללי עדיין לא הופעל ב-Supabase. יש להריץ את migration הנוכחות.",
    "The general attendance clock is not enabled in Supabase yet. Run the attendance migration.",
    "Το γενικό ρολόι παρουσίας δεν έχει ενεργοποιηθεί ακόμη στο Supabase. Εκτελέστε τη μεταφορά παρουσίας.",
    "O relógio de presença geral ainda não está ativado no Supabase. Execute a migração de presença."
  ],
  [
    "כניסה:",
    "Clock-in:",
    "Προσέλευση:",
    "Entrada:"
  ],
  [
    "לא נמצא פרופיל למשתמש המחובר. בדוק את טבלת profiles ואת הרשאות RLS.",
    "No profile was found for the signed-in user. Check the profiles table and RLS permissions.",
    "Δεν βρέθηκε προφίλ για τον συνδεδεμένο χρήστη. Ελέγξτε τον πίνακα profiles και τα δικαιώματα RLS.",
    "Não foi encontrado um perfil para o utilizador autenticado. Verifique a tabela profiles e as permissões RLS."
  ],
  [
    "טעינת הנתונים נכשלה.",
    "Data loading failed.",
    "Η φόρτωση δεδομένων απέτυχε.",
    "Falha ao carregar os dados."
  ],
  [
    "המשתמש נוצר. אם נדרש אישור מייל ב-Supabase, אשר את המשתמש דרך Authentication > Users.",
    "User created. If Supabase requires email confirmation, confirm the user under Authentication > Users.",
    "Ο χρήστης δημιουργήθηκε. Αν το Supabase απαιτεί επιβεβαίωση email, επιβεβαιώστε τον χρήστη στο Authentication > Users.",
    "Utilizador criado. Se o Supabase exigir confirmação de email, confirme o utilizador em Authentication > Users."
  ],
  [
    "נושא",
    "Subject",
    "Θέμα",
    "Assunto"
  ],
  [
    "הודעה",
    "Message",
    "Μήνυμα",
    "Mensagem"
  ],
  [
    "חיפוש",
    "Search",
    "Αναζήτηση",
    "Pesquisar"
  ],
  [
    "תאריך ביצוע",
    "Work date",
    "Ημερομηνία εργασίας",
    "Data do trabalho"
  ],
  [
    "מפת מיקומי עובדים",
    "Employee location map",
    "Χάρτης τοποθεσιών εργαζομένων",
    "Mapa de localizações dos funcionários"
  ],
  [
    "ע",
    "U",
    "Χ",
    "U"
  ],
  [
    "פעיל עכשיו",
    "Active now",
    "Ενεργός τώρα",
    "Ativo agora"
  ],
  [
    "דיווח אחרון: {{value0}}",
    "Last report: {{value0}}",
    "Τελευταία αναφορά: {{value0}}",
    "Último registo: {{value0}}"
  ],
  [
    "מיקום אחרון",
    "Last location",
    "Τελευταία τοποθεσία",
    "Última localização"
  ],
  [
    "לא הוגדרה כתובת",
    "No address set",
    "Δεν έχει οριστεί διεύθυνση",
    "Sem endereço definido"
  ],
  [
    " · דיוק כ־{{value0}} מ׳",
    " · accuracy approx. {{value0}} m",
    " · ακρίβεια περίπου {{value0}} μ.",
    " · precisão aprox. {{value0}} m"
  ],
  [
    "פתיחת הפרויקט",
    "Open the project",
    "Άνοιγμα του έργου",
    "Abrir o projeto"
  ],
  [
    "ניווט לנקודה",
    "Navigate to point",
    "Πλοήγηση στο σημείο",
    "Navegar até ao ponto"
  ],
  [
    "{{value0}} פעולות מהשטח סונכרנו בהצלחה.",
    "{{value0}} field actions synced successfully.",
    "{{value0}} ενέργειες πεδίου συγχρονίστηκαν επιτυχώς.",
    "{{value0}} ações de campo sincronizadas com sucesso."
  ],
  [
    "{{value0}} פעולות ממתינות לסנכרון",
    "{{value0}} actions awaiting sync",
    "{{value0}} ενέργειες αναμένουν συγχρονισμό",
    "{{value0}} ações a aguardar sincronização"
  ],
  [
    "מצב אופליין · {{value0}} פעולות נשמרו במכשיר",
    "Offline · {{value0}} actions saved on this device",
    "Εκτός σύνδεσης · {{value0}} ενέργειες αποθηκεύτηκαν στη συσκευή",
    "Sem ligação · {{value0}} ações guardadas neste dispositivo"
  ],
  [
    "מחיקת {{value0}}",
    "Delete {{value0}}",
    "Διαγραφή {{value0}}",
    "Eliminar {{value0}}"
  ],
  [
    "לדוגמה: כביש 531 - קטע צפוני",
    "For example: Route 531 - northern section",
    "Για παράδειγμα: Οδός 531 - βόρειο τμήμα",
    "Por exemplo: Estrada 531 - troço norte"
  ],
  [
    "לדוגמה: עיריית הרצליה",
    "For example: Herzliya Municipality",
    "Για παράδειγμα: Δήμος Χερτσλίγια",
    "Por exemplo: Município de Herzliya"
  ],
  [
    "עיר / רחוב / אזור",
    "City / street / area",
    "Πόλη / οδός / περιοχή",
    "Cidade / rua / zona"
  ],
  [
    "עובדים נוספים בפרויקט, אופציונלי",
    "Additional project workers, optional",
    "Πρόσθετοι εργαζόμενοι έργου, προαιρετικά",
    "Trabalhadores adicionais do projeto, opcional"
  ],
  [
    "פירוט איתור תשתיות, דרישות לקוח, חסמים וכו׳",
    "Details of infrastructure detection, client requirements, blockers, etc.",
    "Λεπτομέρειες εντοπισμού υποδομών, απαιτήσεις πελάτη, εμπόδια κ.λπ.",
    "Detalhes da deteção de infraestruturas, requisitos do cliente, impedimentos, etc."
  ],
  [
    "כל המשימות הפתוחות במערכת. ניתן לערוך, להשלים או למחוק משימה.",
    "All open tasks in the system. You can edit, complete or delete a task.",
    "Όλες οι ανοιχτές εργασίες στο σύστημα. Μπορείτε να επεξεργαστείτε, να ολοκληρώσετε ή να διαγράψετε μια εργασία.",
    "Todas as tarefas em aberto no sistema. Pode editar, concluir ou eliminar uma tarefa."
  ],
  [
    "המשימות הפתוחות בפרויקטים שאליהם אתה משויך.",
    "Open tasks in your assigned projects.",
    "Ανοιχτές εργασίες στα έργα που σας έχουν ανατεθεί.",
    "Tarefas em aberto nos projetos que lhe estão atribuídos."
  ],
  [
    "פתוחות",
    "Open",
    "Ανοιχτές",
    "Em aberto"
  ],
  [
    "חיפוש משימה, פרויקט, מיקום או עובד...",
    "Search task, project, location or employee...",
    "Αναζήτηση εργασίας, έργου, τοποθεσίας ή εργαζομένου...",
    "Pesquisar tarefa, projeto, localização ou funcionário..."
  ],
  [
    "לא נמצאו משימות התואמות לחיפוש",
    "No tasks match your search",
    "Δεν βρέθηκαν εργασίες που ταιριάζουν στην αναζήτηση",
    "Nenhuma tarefa corresponde à pesquisa"
  ],
  [
    "אין משימות פתוחות כרגע",
    "No open tasks right now",
    "Δεν υπάρχουν ανοιχτές εργασίες τώρα",
    "Sem tarefas em aberto neste momento"
  ],
  [
    "פירוט",
    "Details",
    "Λεπτομέρειες",
    "Detalhes"
  ],
  [
    "ללא עובד משויך",
    "No assigned employee",
    "Χωρίς ανατεθειμένο εργαζόμενο",
    "Sem funcionário atribuído"
  ],
  [
    "פתיחת פרויקט",
    "Open project",
    "Άνοιγμα έργου",
    "Abrir projeto"
  ],
  [
    "הורדת דוח Excel",
    "Download Excel report",
    "Λήψη αναφοράς Excel",
    "Descarregar relatório Excel"
  ],
  [
    "פרויקטים בדוח",
    "Projects in report",
    "Έργα στην αναφορά",
    "Projetos no relatório"
  ],
  [
    "חיפוש לפי פרויקט, סטטוס או עובד...",
    "Search by project, status or employee...",
    "Αναζήτηση με έργο, κατάσταση ή εργαζόμενο...",
    "Pesquisar por projeto, estado ou funcionário..."
  ],
  [
    "סינון לפי שיוך",
    "Filter by assignment",
    "Φιλτράρισμα ανά ανάθεση",
    "Filtrar por atribuição"
  ],
  [
    "טרם שויך",
    "Not yet assigned",
    "Δεν έχει ανατεθεί ακόμη",
    "Ainda sem atribuição"
  ],
  [
    "אין חיבור. מוצגים נתוני הפרויקטים האחרונים שנשמרו במכשיר.",
    "Offline. Showing the latest project data saved on this device.",
    "Εκτός σύνδεσης. Εμφανίζονται τα τελευταία δεδομένα έργων που αποθηκεύτηκαν στη συσκευή.",
    "Sem ligação. A mostrar os dados de projetos mais recentes guardados neste dispositivo."
  ],
  [
    "ב-iPhone: פתח את תפריט השיתוף ובחר ׳הוספה למסך הבית׳.",
    "On iPhone: open the Share menu and choose Add to Home Screen.",
    "Στο iPhone: ανοίξτε το μενού κοινοποίησης και επιλέξτε Προσθήκη στην οθόνη αφετηρίας.",
    "No iPhone: abra o menu de partilha e escolha Adicionar ao ecrã principal."
  ],
  [
    "פתח את תפריט הדפדפן ובחר ׳התקנת האפליקציה׳ או ׳הוספה למסך הבית׳.",
    "Open the browser menu and choose Install app or Add to Home Screen.",
    "Ανοίξτε το μενού του προγράμματος περιήγησης και επιλέξτε Εγκατάσταση εφαρμογής ή Προσθήκη στην αρχική οθόνη.",
    "Abra o menu do navegador e escolha Instalar aplicação ou Adicionar ao ecrã principal."
  ],
  [
    "המכשיר או הדפדפן הזה אינם תומכים בהתראות Push.",
    "This device or browser does not support push notifications.",
    "Αυτή η συσκευή ή το πρόγραμμα περιήγησης δεν υποστηρίζει ειδοποιήσεις push.",
    "Este dispositivo ou navegador não suporta notificações push."
  ],
  [
    "לא ניתנה הרשאה להתראות. אפשר לשנות זאת בהגדרות הדפדפן.",
    "Notification permission was not granted. You can change this in your browser settings.",
    "Δεν δόθηκε άδεια ειδοποιήσεων. Μπορείτε να το αλλάξετε στις ρυθμίσεις του προγράμματος περιήγησης.",
    "Não foi concedida permissão para notificações. Pode alterá-la nas definições do navegador."
  ],
  [
    "נוכחות כללית לצד שעות לפי פרויקט. אפשר לבחור חודש מלא או טווח\n            מותאם ולייצא את שני סוגי הדיווח לאקסל.",
    "General attendance alongside hours per project. Select a full month or a custom range and export both report types to Excel.",
    "Γενική παρουσία μαζί με ώρες ανά έργο. Επιλέξτε ολόκληρο μήνα ή προσαρμοσμένο εύρος και εξαγάγετε και τους δύο τύπους αναφοράς στο Excel.",
    "Presença geral e horas por projeto. Selecione um mês completo ou um intervalo personalizado e exporte ambos os tipos de relatório para Excel."
  ],
  [
    "נתוני הנוכחות הכללית אינם זמינים עד להפעלת migration הנוכחות ב-Supabase.",
    "General attendance data is unavailable until the attendance migration is enabled in Supabase.",
    "Τα δεδομένα γενικής παρουσίας δεν είναι διαθέσιμα μέχρι να ενεργοποιηθεί η μεταφορά παρουσίας στο Supabase.",
    "Os dados de presença geral estão indisponíveis até ser ativada a migração de presença no Supabase."
  ],
  [
    "ללא שעות",
    "No hours",
    "Χωρίς ώρες",
    "Sem horas"
  ],
  [
    "שעות",
    "Hours",
    "Ώρες",
    "Horas"
  ],
  [
    "{{value0}} פתוח",
    "{{value0}} open",
    "{{value0}} ανοιχτό",
    "{{value0}} em aberto"
  ],
  [
    "השמירה נכשלה.",
    "Saving failed.",
    "Η αποθήκευση απέτυχε.",
    "Não foi possível guardar."
  ],
  [
    "התאמת נהגים למשתמשים",
    "Match drivers to users",
    "Αντιστοίχιση οδηγών με χρήστες",
    "Associar condutores a utilizadores"
  ],
  [
    "לא ניתן לטעון את רשימת המשתמשים",
    "Could not load the user list",
    "Δεν ήταν δυνατή η φόρτωση της λίστας χρηστών",
    "Não foi possível carregar a lista de utilizadores"
  ],
  [
    "יש להריץ את מיגרציית fleet_driver_lookup ב-Supabase.",
    "Run the fleet_driver_lookup migration in Supabase.",
    "Εκτελέστε τη μεταφορά fleet_driver_lookup στο Supabase.",
    "Execute a migração fleet_driver_lookup no Supabase."
  ],
  [
    "כל הנהגים כבר מקושרים",
    "All drivers are already linked",
    "Όλοι οι οδηγοί έχουν ήδη συνδεθεί",
    "Todos os condutores já estão associados"
  ],
  [
    "לכל רכב נבחר המשתמש שהשם שלו תואם לשם הנהג. התאמות ודאיות מסומנות מראש, ואת השאר יש לבדוק. רכבים בלי משתמש במערכת נשארים כפי שהם.",
    "For each vehicle, choose the user whose name matches the driver. Confident matches are preselected; check the rest. Vehicles without a system user remain unchanged.",
    "Για κάθε όχημα, επιλέξτε τον χρήστη με όνομα που αντιστοιχεί στον οδηγό. Οι βέβαιες αντιστοιχίσεις είναι προεπιλεγμένες· ελέγξτε τις υπόλοιπες. Τα οχήματα χωρίς χρήστη στο σύστημα παραμένουν αμετάβλητα.",
    "Para cada veículo, escolha o utilizador cujo nome corresponde ao condutor. As correspondências seguras estão pré-selecionadas; verifique as restantes. Os veículos sem utilizador no sistema mantêm-se inalterados."
  ],
  [
    "רכב",
    "Vehicle",
    "Όχημα",
    "Veículo"
  ],
  [
    "שם נהג בטבלה",
    "Driver name in table",
    "Όνομα οδηγού στον πίνακα",
    "Nome do condutor na tabela"
  ],
  [
    "משתמש במערכת",
    "System user",
    "Χρήστης συστήματος",
    "Utilizador do sistema"
  ],
  [
    "משתמש עבור",
    "User for",
    "Χρήστης για",
    "Utilizador para"
  ],
  [
    "ללא קישור",
    "No link",
    "Χωρίς σύνδεση",
    "Sem associação"
  ],
  [
    "הצעות",
    "Suggestions",
    "Προτάσεις",
    "Sugestões"
  ],
  [
    "כל המשתמשים",
    "All users",
    "Όλοι οι χρήστες",
    "Todos os utilizadores"
  ],
  [
    "שמירת",
    "Save",
    "Αποθήκευση",
    "Guardar"
  ],
  [
    "קישורים",
    "links",
    "συνδέσεις",
    "associações"
  ],
  [
    "פג תוקף",
    "Expired",
    "Έληξε",
    "Expirado"
  ],
  [
    "נותרו",
    "Remaining",
    "Απομένουν",
    "Restam"
  ],
  [
    "לא בטוח בקריאה – יש לבדוק",
    "Reading uncertain — please check",
    "Αβέβαιη ανάγνωση — ελέγξτε",
    "Leitura incerta — verifique"
  ],
  [
    "דוח עם מספר זה כבר קיים לרכב.",
    "A fine with this number already exists for the vehicle.",
    "Υπάρχει ήδη πρόστιμο με αυτόν τον αριθμό για το όχημα.",
    "Já existe uma multa com este número para o veículo."
  ],
  [
    "דוח חדש",
    "New fine",
    "Νέο πρόστιμο",
    "Nova multa"
  ],
  [
    "הרכב",
    "The vehicle",
    "Το όχημα",
    "O veículo"
  ],
  [
    "לא נמצא במערכת. יש לבחור רכב ידנית.",
    "was not found in the system. Select a vehicle manually.",
    "δεν βρέθηκε στο σύστημα. Επιλέξτε όχημα χειροκίνητα.",
    "não foi encontrado no sistema. Selecione um veículo manualmente."
  ],
  [
    "בחירת רכב",
    "Choose vehicle",
    "Επιλογή οχήματος",
    "Escolher veículo"
  ],
  [
    "מספר דוח",
    "Fine number",
    "Αριθμός προστίμου",
    "Número da multa"
  ],
  [
    "מועד העבירה",
    "Offence date and time",
    "Ημερομηνία και ώρα παράβασης",
    "Data e hora da infração"
  ],
  [
    "סכום לתשלום (₪)",
    "Amount payable (₪)",
    "Πληρωτέο ποσό (₪)",
    "Valor a pagar (₪)"
  ],
  [
    "לתשלום עד",
    "Payment due",
    "Προθεσμία πληρωμής",
    "Prazo de pagamento"
  ],
  [
    "עבירה",
    "Offence",
    "Παράβαση",
    "Infração"
  ],
  [
    "מקום",
    "Place",
    "Τόπος",
    "Local"
  ],
  [
    "רשות מוציאה",
    "Issuing authority",
    "Εκδούσα αρχή",
    "Entidade emitente"
  ],
  [
    "נקודות",
    "Points",
    "Βαθμοί ποινής",
    "Pontos"
  ],
  [
    "נהג אחראי",
    "Responsible driver",
    "Υπεύθυνος οδηγός",
    "Condutor responsável"
  ],
  [
    "נקבע לפי היסטוריית השיוכים בשעת העבירה. אפשר לשנות.",
    "Based on assignment history at the time of the offence. Can be changed.",
    "Βάσει του ιστορικού αναθέσεων κατά την παράβαση. Μπορεί να αλλάξει.",
    "Determinado pelo histórico de atribuições à hora da infração. Pode ser alterado."
  ],
  [
    "יוצג אחרי בחירת רכב ומועד.",
    "Shown after choosing a vehicle and date.",
    "Εμφανίζεται μετά την επιλογή οχήματος και ημερομηνίας.",
    "Apresentado após escolher um veículo e uma data."
  ],
  [
    "ללא משתמש מקושר",
    "No linked user",
    "Χωρίς συνδεδεμένο χρήστη",
    "Sem utilizador associado"
  ],
  [
    "לא נקבע",
    "Not determined",
    "Δεν έχει οριστεί",
    "Não determinado"
  ],
  [
    "הערות",
    "Notes",
    "Σημειώσεις",
    "Notas"
  ],
  [
    "פרטי הרכב הוזנו",
    "Vehicle details entered",
    "Τα στοιχεία οχήματος καταχωρίστηκαν",
    "Dados do veículo introduzidos"
  ],
  [
    "הגעה צפויה",
    "Expected arrival",
    "Αναμενόμενη άφιξη",
    "Chegada prevista"
  ],
  [
    "הצעת ביטוח הוגשה",
    "Insurance quote submitted",
    "Υποβλήθηκε προσφορά ασφάλισης",
    "Proposta de seguro apresentada"
  ],
  [
    "העלאת הצעת מחיר מהסוכן",
    "Upload the agent's quote",
    "Μεταφόρτωση προσφοράς του πράκτορα",
    "Carregar proposta do agente"
  ],
  [
    "ההצעה אושרה",
    "Quote approved",
    "Η προσφορά εγκρίθηκε",
    "Proposta aprovada"
  ],
  [
    "ממתינה להחלטת מנהל",
    "Awaiting manager decision",
    "Αναμονή απόφασης διαχειριστή",
    "A aguardar decisão do gestor"
  ],
  [
    "פוליסה בתוקף הועלתה",
    "Valid policy uploaded",
    "Μεταφορτώθηκε έγκυρο ασφαλιστήριο",
    "Apólice válida carregada"
  ],
  [
    "העלאת הפוליסה שהונפקה",
    "Upload the issued policy",
    "Μεταφόρτωση του εκδοθέντος ασφαλιστηρίου",
    "Carregar apólice emitida"
  ],
  [
    "הרכב הגיע ומוכן למסירה",
    "Vehicle arrived and ready for handover",
    "Το όχημα έφτασε και είναι έτοιμο για παράδοση",
    "Veículo recebido e pronto para entrega"
  ],
  [
    "תהליך קליטת רכב חדש",
    "New vehicle intake process",
    "Διαδικασία παραλαβής νέου οχήματος",
    "Processo de receção de novo veículo"
  ],
  [
    "הרכב הגיע – מוכן למסירה",
    "Vehicle arrived — ready for handover",
    "Το όχημα έφτασε — έτοιμο για παράδοση",
    "Veículo recebido — pronto para entrega"
  ],
  [
    "סימון כנמסר – בשימוש",
    "Mark as handed over — in use",
    "Σήμανση ως παραδομένο — σε χρήση",
    "Marcar como entregue — em utilização"
  ],
  [
    "אי אפשר להעביר למסירה לפני שיש פוליסה בתוקף.",
    "Handover is not allowed without a valid policy.",
    "Δεν επιτρέπεται παράδοση χωρίς έγκυρο ασφαλιστήριο.",
    "A entrega não é permitida sem uma apólice válida."
  ],
  [
    "מנהל אחר כבר החליט על ההצעה.",
    "Another manager has already decided on the quote.",
    "Άλλος διαχειριστής έχει ήδη αποφασίσει για την προσφορά.",
    "Outro gestor já decidiu sobre a proposta."
  ],
  [
    "הפעולה נכשלה.",
    "The action failed.",
    "Η ενέργεια απέτυχε.",
    "A ação falhou."
  ],
  [
    "ההצעה נשמרה והמנהלים קיבלו התראה.",
    "The quote was saved and managers were notified.",
    "Η προσφορά αποθηκεύτηκε και οι διαχειριστές ειδοποιήθηκαν.",
    "A proposta foi guardada e os gestores foram notificados."
  ],
  [
    "לא ניתן לפתוח את המסמך.",
    "Could not open the document.",
    "Δεν ήταν δυνατό το άνοιγμα του εγγράφου.",
    "Não foi possível abrir o documento."
  ],
  [
    "ההצעה אושרה.",
    "The quote was approved.",
    "Η προσφορά εγκρίθηκε.",
    "A proposta foi aprovada."
  ],
  [
    "ההצעה נדחתה.",
    "The quote was rejected.",
    "Η προσφορά απορρίφθηκε.",
    "A proposta foi rejeitada."
  ],
  [
    "לא הוגשו הצעות ביטוח לרכב זה",
    "No insurance quotes submitted for this vehicle",
    "Δεν υποβλήθηκαν προσφορές ασφάλισης για αυτό το όχημα",
    "Sem propostas de seguro para este veículo"
  ],
  [
    "הוגשה",
    "Submitted",
    "Υποβλήθηκε",
    "Apresentada"
  ],
  [
    "סוכן / חברה",
    "Agent / company",
    "Πράκτορας / εταιρεία",
    "Agente / empresa"
  ],
  [
    "פרמיה",
    "Premium",
    "Ασφάλιστρο",
    "Prémio"
  ],
  [
    "סטטוס",
    "Status",
    "Κατάσταση",
    "Estado"
  ],
  [
    "החלטה",
    "Decision",
    "Απόφαση",
    "Decisão"
  ],
  [
    "פתיחת ההצעה",
    "Open quote",
    "Άνοιγμα προσφοράς",
    "Abrir proposta"
  ],
  [
    "דחייה",
    "Reject",
    "Απόρριψη",
    "Rejeitar"
  ],
  [
    "למחוק את ההצעה?",
    "Delete the quote?",
    "Διαγραφή της προσφοράς;",
    "Eliminar a proposta?"
  ],
  [
    "הערה להחלטה (אופציונלי)",
    "Decision note (optional)",
    "Σημείωση απόφασης (προαιρετικά)",
    "Nota da decisão (opcional)"
  ],
  [
    "העלאת הצעה (קריאה אוטומטית)",
    "Upload quote (automatic reading)",
    "Μεταφόρτωση προσφοράς (αυτόματη ανάγνωση)",
    "Carregar proposta (leitura automática)"
  ],
  [
    "סוכן",
    "Agent",
    "Πράκτορας",
    "Agente"
  ],
  [
    "חברת ביטוח",
    "Insurance company",
    "Ασφαλιστική εταιρεία",
    "Seguradora"
  ],
  [
    "פרמיה מוצעת (₪)",
    "Proposed premium (₪)",
    "Προτεινόμενο ασφάλιστρο (₪)",
    "Prémio proposto (₪)"
  ],
  [
    "הגשת הצעה לאישור",
    "Submit quote for approval",
    "Υποβολή προσφοράς για έγκριση",
    "Apresentar proposta para aprovação"
  ],
  [
    "ההעלאה נכשלה.",
    "Upload failed.",
    "Η μεταφόρτωση απέτυχε.",
    "Falha no carregamento."
  ],
  [
    "קורא את המסמך...",
    "Reading document...",
    "Ανάγνωση εγγράφου...",
    "A ler documento..."
  ],
  [
    "מילוי אוטומטי מסריקה",
    "Autofill from scan",
    "Αυτόματη συμπλήρωση από σάρωση",
    "Preencher automaticamente a partir de digitalização"
  ],
  [
    "יש להזין מספר רכב.",
    "Enter a vehicle number.",
    "Εισαγάγετε αριθμό κυκλοφορίας.",
    "Introduza uma matrícula."
  ],
  [
    "רכב עם מספר זה כבר קיים במערכת.",
    "A vehicle with this number already exists in the system.",
    "Υπάρχει ήδη όχημα με αυτόν τον αριθμό στο σύστημα.",
    "Já existe um veículo com esta matrícula no sistema."
  ],
  [
    "רכב חדש",
    "New vehicle",
    "Νέο όχημα",
    "Novo veículo"
  ],
  [
    "יצרן ודגם",
    "Make and model",
    "Μάρκα και μοντέλο",
    "Marca e modelo"
  ],
  [
    "תאריך הגעה צפוי",
    "Expected arrival date",
    "Αναμενόμενη ημερομηνία άφιξης",
    "Data de chegada prevista"
  ],
  [
    "תאריך הוצאה משימוש",
    "Date taken out of service",
    "Ημερομηνία απόσυρσης από χρήση",
    "Data de retirada de serviço"
  ],
  [
    "סיבה (החזרת ליסינג, מכירה, השבתה)",
    "Reason (lease return, sale, decommissioning)",
    "Αιτία (επιστροφή μίσθωσης, πώληση, απόσυρση)",
    "Motivo (devolução de leasing, venda, desativação)"
  ],
  [
    "נכנס לחברה בתאריך",
    "Company entry date",
    "Ημερομηνία εισόδου στην εταιρεία",
    "Data de entrada na empresa"
  ],
  [
    "בעלות",
    "Ownership",
    "Ιδιοκτησία",
    "Propriedade"
  ],
  [
    "חברת ליסינג / בעלים",
    "Leasing company / owner",
    "Εταιρεία μίσθωσης / ιδιοκτήτης",
    "Empresa de leasing / proprietário"
  ],
  [
    "תחילת חוזה ליסינג",
    "Lease start",
    "Έναρξη μίσθωσης",
    "Início do leasing"
  ],
  [
    "סיום חוזה ליסינג",
    "Lease end",
    "Λήξη μίσθωσης",
    "Fim do leasing"
  ],
  [
    "סוג מחזיק",
    "Holder type",
    "Τύπος κατόχου",
    "Tipo de detentor"
  ],
  [
    "שם הנהג / המחזיק",
    "Driver / holder name",
    "Όνομα οδηγού / κατόχου",
    "Nome do condutor / detentor"
  ],
  [
    "רכב חשמלי",
    "Electric vehicle",
    "Ηλεκτρικό όχημα",
    "Veículo elétrico"
  ],
  [
    "לא ניתן לקרוא את הקובץ.",
    "Could not read the file.",
    "Δεν ήταν δυνατή η ανάγνωση του αρχείου.",
    "Não foi possível ler o ficheiro."
  ],
  [
    "הייבוא נכשל.",
    "Import failed.",
    "Η εισαγωγή απέτυχε.",
    "A importação falhou."
  ],
  [
    "ייבוא טבלת רכבים",
    "Import vehicle table",
    "Εισαγωγή πίνακα οχημάτων",
    "Importar tabela de veículos"
  ],
  [
    "בחרי את קובץ האקסל של המזכירה. רכבים שכבר קיימים במערכת (לפי מספר רכב) לא יידרסו.",
    "Choose the office Excel file. Vehicles already in the system (by vehicle number) will not be overwritten.",
    "Επιλέξτε το αρχείο Excel του γραφείου. Τα οχήματα που υπάρχουν ήδη στο σύστημα (βάσει αριθμού κυκλοφορίας) δεν θα αντικατασταθούν.",
    "Escolha o ficheiro Excel do escritório. Os veículos já existentes no sistema (pela matrícula) não serão substituídos."
  ],
  [
    "נמצאו",
    "Found",
    "Βρέθηκαν",
    "Encontrados"
  ],
  [
    "חדשים לייבוא",
    "new to import",
    "νέα για εισαγωγή",
    "novos para importar"
  ],
  [
    "דגם",
    "Model",
    "Μοντέλο",
    "Modelo"
  ],
  [
    "נהג",
    "Driver",
    "Οδηγός",
    "Condutor"
  ],
  [
    "מנויים",
    "Subscriptions",
    "Συνδρομές",
    "Subscrições"
  ],
  [
    "קיים – ידולג",
    "Exists — will be skipped",
    "Υπάρχει — θα παραλειφθεί",
    "Existente — será ignorado"
  ],
  [
    "ייבוא",
    "Import",
    "Εισαγωγή",
    "Importar"
  ],
  [
    "למחוק את הרשומה?",
    "Delete the record?",
    "Διαγραφή της εγγραφής;",
    "Eliminar o registo?"
  ],
  [
    "בסריקה מופיע רכב",
    "The scan shows vehicle",
    "Η σάρωση εμφανίζει όχημα",
    "A digitalização mostra o veículo"
  ],
  [
    "שונה מרכב זה",
    "different from this vehicle",
    "διαφορετικό από αυτό το όχημα",
    "diferente deste veículo"
  ],
  [
    "יש לוודא שזה המסמך הנכון.",
    "Check that this is the correct document.",
    "Ελέγξτε ότι αυτό είναι το σωστό έγγραφο.",
    "Verifique se este é o documento correto."
  ],
  [
    "הפוליסה נוספה.",
    "The policy was added.",
    "Το ασφαλιστήριο προστέθηκε.",
    "A apólice foi adicionada."
  ],
  [
    "לא הוזנו פוליסות לרכב זה",
    "No policies entered for this vehicle",
    "Δεν έχουν καταχωριστεί ασφαλιστήρια για αυτό το όχημα",
    "Sem apólices introduzidas para este veículo"
  ],
  [
    "חברה",
    "Company",
    "Εταιρεία",
    "Empresa"
  ],
  [
    "מס׳ פוליסה",
    "Policy no.",
    "Αρ. ασφαλιστηρίου",
    "N.º de apólice"
  ],
  [
    "עד",
    "Until",
    "Έως",
    "Até"
  ],
  [
    "מילוי מפוליסה סרוקה",
    "Fill from scanned policy",
    "Συμπλήρωση από σαρωμένο ασφαλιστήριο",
    "Preencher a partir de apólice digitalizada"
  ],
  [
    "מספר פוליסה",
    "Policy number",
    "Αριθμός ασφαλιστηρίου",
    "Número da apólice"
  ],
  [
    "תחילת תוקף",
    "Valid from",
    "Ισχύει από",
    "Válida desde"
  ],
  [
    "סיום תוקף",
    "Valid until",
    "Ισχύει έως",
    "Válida até"
  ],
  [
    "הוספת פוליסה",
    "Add policy",
    "Προσθήκη ασφαλιστηρίου",
    "Adicionar apólice"
  ],
  [
    "הטסט נוסף.",
    "The inspection was added.",
    "Ο τεχνικός έλεγχος προστέθηκε.",
    "A inspeção foi adicionada."
  ],
  [
    "לא הוזן טסט לרכב זה",
    "No inspection entered for this vehicle",
    "Δεν έχει καταχωριστεί τεχνικός έλεγχος για αυτό το όχημα",
    "Sem inspeção introduzida para este veículo"
  ],
  [
    "תאריך טסט",
    "Inspection date",
    "Ημερομηνία τεχνικού ελέγχου",
    "Data da inspeção"
  ],
  [
    "תחנה",
    "Station",
    "Σταθμός",
    "Centro"
  ],
  [
    "תוצאה",
    "Result",
    "Αποτέλεσμα",
    "Resultado"
  ],
  [
    "בתוקף עד",
    "Valid until",
    "Ισχύει έως",
    "Válida até"
  ],
  [
    "מילוי מרישיון / טסט סרוק",
    "Fill from scanned license / inspection",
    "Συμπλήρωση από σαρωμένη άδεια / τεχνικό έλεγχο",
    "Preencher a partir de documento do veículo / inspeção digitalizada"
  ],
  [
    "תחנת טסט",
    "Inspection station",
    "Σταθμός τεχνικού ελέγχου",
    "Centro de inspeção"
  ],
  [
    "תוצאה / הערה",
    "Result / note",
    "Αποτέλεσμα / σημείωση",
    "Resultado / nota"
  ],
  [
    "הוספת טסט",
    "Add inspection",
    "Προσθήκη τεχνικού ελέγχου",
    "Adicionar inspeção"
  ],
  [
    "המנוי נשמר.",
    "The subscription was saved.",
    "Η συνδρομή αποθηκεύτηκε.",
    "A subscrição foi guardada."
  ],
  [
    "מנוי",
    "Subscription",
    "Συνδρομή",
    "Subscrição"
  ],
  [
    "מספר מנוי",
    "Subscription number",
    "Αριθμός συνδρομής",
    "Número da subscrição"
  ],
  [
    "משויך",
    "Assigned",
    "Ανατεθειμένο",
    "Atribuído"
  ],
  [
    "מספר מנוי (אופציונלי)",
    "Subscription number (optional)",
    "Αριθμός συνδρομής (προαιρετικά)",
    "Número da subscrição (opcional)"
  ],
  [
    "שיוך / עדכון מנוי",
    "Assign / update subscription",
    "Ανάθεση / ενημέρωση συνδρομής",
    "Atribuir / atualizar subscrição"
  ],
  [
    "הקריאה נמוכה מהקריאה הגבוהה ביותר שנרשמה. להמשיך?",
    "The reading is lower than the highest recorded reading. Continue?",
    "Η ένδειξη είναι χαμηλότερη από την υψηλότερη καταγεγραμμένη. Συνέχεια;",
    "A leitura é inferior à leitura mais alta registada. Continuar?"
  ],
  [
    "הקריאה נשמרה.",
    "The reading was saved.",
    "Η ένδειξη αποθηκεύτηκε.",
    "A leitura foi guardada."
  ],
  [
    "אין קריאות ק\"מ",
    "No mileage readings",
    "Δεν υπάρχουν ενδείξεις χιλιομέτρων",
    "Sem leituras de quilometragem"
  ],
  [
    "ק\"מ",
    "km",
    "χλμ.",
    "km"
  ],
  [
    "תאריך דיווח",
    "Report date",
    "Ημερομηνία αναφοράς",
    "Data do registo"
  ],
  [
    "קריאת ק\"מ לחודש הנוכחי",
    "Mileage reading for the current month",
    "Ένδειξη χιλιομέτρων για τον τρέχοντα μήνα",
    "Leitura de quilometragem do mês atual"
  ],
  [
    "שמירת קריאה",
    "Save reading",
    "Αποθήκευση ένδειξης",
    "Guardar leitura"
  ],
  [
    "אין היסטוריית שיוך לרכב זה",
    "No assignment history for this vehicle",
    "Δεν υπάρχει ιστορικό αναθέσεων για αυτό το όχημα",
    "Sem histórico de atribuições para este veículo"
  ],
  [
    "ק\"מ התחלה",
    "Starting mileage",
    "Αρχικά χιλιόμετρα",
    "Quilometragem inicial"
  ],
  [
    "ק\"מ סיום",
    "Ending mileage",
    "Τελικά χιλιόμετρα",
    "Quilometragem final"
  ],
  [
    "מחזיק/ה כעת",
    "Current holder",
    "Τρέχων κάτοχος",
    "Detentor atual"
  ],
  [
    "זמני",
    "Temporary",
    "Προσωρινό",
    "Temporário"
  ],
  [
    "קבוע",
    "Permanent",
    "Μόνιμο",
    "Permanente"
  ],
  [
    "המסמך הועלה.",
    "The document was uploaded.",
    "Το έγγραφο μεταφορτώθηκε.",
    "O documento foi carregado."
  ],
  [
    "לא הועלו מסמכים לרכב זה",
    "No documents uploaded for this vehicle",
    "Δεν έχουν μεταφορτωθεί έγγραφα για αυτό το όχημα",
    "Sem documentos carregados para este veículo"
  ],
  [
    "תוקף",
    "Validity",
    "Ισχύς",
    "Validade"
  ],
  [
    "הועלה",
    "Uploaded",
    "Μεταφορτώθηκε",
    "Carregado"
  ],
  [
    "סוג מסמך",
    "Document type",
    "Τύπος εγγράφου",
    "Tipo de documento"
  ],
  [
    "תוקף (אם רלוונטי)",
    "Validity (if applicable)",
    "Ισχύς (εάν ισχύει)",
    "Validade (se aplicável)"
  ],
  [
    "קובץ (PDF / JPG / PNG, עד 10MB)",
    "File (PDF / JPG / PNG, up to 10MB)",
    "Αρχείο (PDF / JPG / PNG, έως 10MB)",
    "Ficheiro (PDF / JPG / PNG, até 10 MB)"
  ],
  [
    "העלאה",
    "Upload",
    "Μεταφόρτωση",
    "Carregar"
  ],
  [
    "פעולה",
    "Action",
    "Ενέργεια",
    "Ação"
  ],
  [
    "חתימה",
    "Signature",
    "Υπογραφή",
    "Assinatura"
  ],
  [
    "יומני העבודה עדיין לא הופעלו במסד הנתונים.",
    "Work diaries are not enabled in the database yet.",
    "Τα ημερολόγια εργασίας δεν έχουν ενεργοποιηθεί ακόμη στη βάση δεδομένων.",
    "Os diários de trabalho ainda não estão ativados na base de dados."
  ],
  [
    "יש למלא תאריך, איש קשר ושעות התחלה וסיום.",
    "Enter a date, contact, start time and end time.",
    "Εισαγάγετε ημερομηνία, επαφή, ώρα έναρξης και λήξης.",
    "Introduza a data, o contacto e as horas de início e fim."
  ],
  [
    "יש למלא את שמות נציג הלקוח וראש צוות מאיה.",
    "Enter the names of the client representative and Maya team lead.",
    "Εισαγάγετε τα ονόματα του εκπροσώπου πελάτη και του επικεφαλής ομάδας Maya.",
    "Introduza os nomes do representante do cliente e do chefe de equipa Maya."
  ],
  [
    "חובה להשלים את שתי החתימות לפני שמירת היומן.",
    "Both signatures are required before saving the diary.",
    "Απαιτούνται και οι δύο υπογραφές πριν από την αποθήκευση του ημερολογίου.",
    "São necessárias ambas as assinaturas antes de guardar o diário."
  ],
  [
    "יומן עבודה מספר {{value0}} נשמר ונחתם.",
    "Work diary no. {{value0}} was saved and signed.",
    "Το ημερολόγιο εργασίας αρ. {{value0}} αποθηκεύτηκε και υπογράφηκε.",
    "O diário de trabalho n.º {{value0}} foi guardado e assinado."
  ],
  [
    "שמירת היומן נכשלה: {{value0}}",
    "Saving the diary failed: {{value0}}",
    "Η αποθήκευση του ημερολογίου απέτυχε: {{value0}}",
    "Falha ao guardar o diário: {{value0}}"
  ],
  [
    "מחיקת יומן העבודה נכשלה: {{value0}}",
    "Deleting the work diary failed: {{value0}}",
    "Η διαγραφή του ημερολογίου εργασίας απέτυχε: {{value0}}",
    "Falha ao eliminar o diário de trabalho: {{value0}}"
  ],
  [
    "יומן עבודה מספר {{value0}} וה-PDF שלו נמחקו.",
    "Work diary no. {{value0}} and its PDF were deleted.",
    "Το ημερολόγιο εργασίας αρ. {{value0}} και το PDF του διαγράφηκαν.",
    "O diário de trabalho n.º {{value0}} e o respetivo PDF foram eliminados."
  ],
  [
    "יומן עבודה",
    "Work diary",
    "Ημερολόγιο εργασίας",
    "Diário de trabalho"
  ],
  [
    "· נחתם על ידי",
    "· signed by",
    "· υπογράφηκε από",
    "· assinado por"
  ],
  [
    "· המספר יינתן אוטומטית בשמירה",
    "· number assigned automatically on save",
    "· ο αριθμός δίνεται αυτόματα κατά την αποθήκευση",
    "· número atribuído automaticamente ao guardar"
  ],
  [
    "פרטי היומן והפרויקט",
    "Diary and project details",
    "Στοιχεία ημερολογίου και έργου",
    "Dados do diário e do projeto"
  ],
  [
    "שם המזמין",
    "Client name",
    "Όνομα πελάτη",
    "Nome do cliente"
  ],
  [
    "איש הקשר",
    "Contact person",
    "Υπεύθυνος επικοινωνίας",
    "Pessoa de contacto"
  ],
  [
    "טלפון נייד",
    "Mobile phone",
    "Κινητό τηλέφωνο",
    "Telemóvel"
  ],
  [
    "שעה",
    "Time",
    "Ώρα",
    "Hora"
  ],
  [
    "עד שעה",
    "Until time",
    "Έως ώρα",
    "Até à hora"
  ],
  [
    "אתר",
    "Site",
    "Εργοτάξιο",
    "Local da obra"
  ],
  [
    "איתור תשתיות תת-קרקעיות / שאיבת עפר / ביקון / מכשיר GPR",
    "Underground infrastructure detection / vacuum excavation / beacon / GPR device",
    "Εντοπισμός υπόγειων υποδομών / εκσκαφή με αναρρόφηση / πομπός / συσκευή GPR",
    "Deteção de infraestruturas subterrâneas / escavação por aspiração / emissor de localização / equipamento GPR"
  ],
  [
    "סוג התשתית",
    "Infrastructure type",
    "Τύπος υποδομής",
    "Tipo de infraestrutura"
  ],
  [
    "עבודה לפי יום עבודה",
    "Work by workday",
    "Εργασία ανά εργάσιμη ημέρα",
    "Trabalho por dia"
  ],
  [
    "עבודה לפי מ״ר - גודל שטח",
    "Work by square meter - area size",
    "Εργασία ανά τετραγωνικό μέτρο - μέγεθος έκτασης",
    "Trabalho por metro quadrado - área"
  ],
  [
    "עבודה לפי מ׳ אורך - אורך תשתית",
    "Work by linear meter - infrastructure length",
    "Εργασία ανά γραμμικό μέτρο - μήκος υποδομής",
    "Trabalho por metro linear - comprimento da infraestrutura"
  ],
  [
    "כמות יחידות עד מטר",
    "Number of units up to one meter",
    "Αριθμός μονάδων έως ένα μέτρο",
    "Número de unidades até um metro"
  ],
  [
    "כמות יחידות מעל מטר",
    "Number of units over one meter",
    "Αριθμός μονάδων άνω του ενός μέτρου",
    "Número de unidades acima de um metro"
  ],
  [
    "עומק",
    "Depth",
    "Βάθος",
    "Profundidade"
  ],
  [
    "איתור דלף",
    "Leak detection",
    "Ανίχνευση διαρροών",
    "Deteção de fugas"
  ],
  [
    "הערות כלליות לאיתור דלף",
    "General leak detection notes",
    "Γενικές σημειώσεις ανίχνευσης διαρροών",
    "Notas gerais sobre deteção de fugas"
  ],
  [
    "שירותים נוספים",
    "Additional services",
    "Πρόσθετες υπηρεσίες",
    "Serviços adicionais"
  ],
  [
    "שירותים נוספים - הערות",
    "Additional services - notes",
    "Πρόσθετες υπηρεσίες - σημειώσεις",
    "Serviços adicionais - notas"
  ],
  [
    "מודד מטעם חברת מאיה",
    "Surveyor on behalf of Maya",
    "Τοπογράφος εκ μέρους της Maya",
    "Topógrafo da Maya"
  ],
  [
    "מודד מטעם מזמין העבודה",
    "Surveyor on behalf of the client",
    "Τοπογράφος εκ μέρους του πελάτη",
    "Topógrafo do cliente"
  ],
  [
    "שם המודד",
    "Surveyor name",
    "Όνομα τοπογράφου",
    "Nome do topógrafo"
  ],
  [
    "סימון סקיצה על גבי מפה קיימת (לצרף צילום סקיצה)",
    "Mark a sketch on an existing map (attach a sketch photo)",
    "Σημειώστε σκαρίφημα σε υπάρχοντα χάρτη (επισυνάψτε φωτογραφία)",
    "Marcar esboço num mapa existente (anexar fotografia do esboço)"
  ],
  [
    "שונות",
    "Miscellaneous",
    "Διάφορα",
    "Diversos"
  ],
  [
    "חתימות חובה",
    "Required signatures",
    "Υποχρεωτικές υπογραφές",
    "Assinaturas obrigatórias"
  ],
  [
    "שם פרטי ושם משפחה",
    "First and last name",
    "Όνομα και επώνυμο",
    "Nome e apelido"
  ],
  [
    "חתימת נציג הלקוח",
    "Client representative signature",
    "Υπογραφή εκπροσώπου πελάτη",
    "Assinatura do representante do cliente"
  ],
  [
    "חתימת ראש צוות מאיה",
    "Maya team lead signature",
    "Υπογραφή επικεφαλής ομάδας Maya",
    "Assinatura do chefe de equipa Maya"
  ],
  [
    "שמירה וסגירת היומן",
    "Save and close diary",
    "Αποθήκευση και κλείσιμο ημερολογίου",
    "Guardar e fechar diário"
  ],
  [
    "דלק ושטיפומט — יבוא תנועות יומן לסאפ",
    "Fuel and car wash — import journal entries to SAP",
    "Καύσιμα και πλύσιμο — εισαγωγή λογιστικών εγγραφών στο SAP",
    "Combustível e lavagem — importar lançamentos para SAP"
  ],
  [
    "מעלים את דוח הריכוז החודשי של דלק (PDF) ומקבלים את קבצי היבוא לדלק, ובחודשים שיש בהם שטיפות גם לשטיפומט.",
    "Upload the monthly fuel summary (PDF) to receive fuel import files and, in months with car washes, car wash import files too.",
    "Μεταφορτώστε τη μηνιαία σύνοψη καυσίμων (PDF) για να λάβετε αρχεία εισαγωγής καυσίμων και, σε μήνες με πλυσίματα, αρχεία εισαγωγής πλυσίματος.",
    "Carregue o resumo mensal de combustível (PDF) para obter os ficheiros de importação de combustível e, nos meses com lavagens, também os ficheiros de importação de lavagens."
  ],
  [
    "מעבד...",
    "Processing...",
    "Επεξεργασία...",
    "A processar..."
  ],
  [
    "העלאת דוח דלק",
    "Upload fuel report",
    "Μεταφόρτωση αναφοράς καυσίμων",
    "Carregar relatório de combustível"
  ],
  [
    "שטיפומט",
    "Car wash",
    "Πλύσιμο αυτοκινήτου",
    "Lavagem de veículos"
  ],
  [
    "בחודש הזה אין שטיפות: אין חשבונית שטיפומט ואין דוח רחיצות בקובץ. אין מה לייבא לשטיפומט.",
    "No car washes this month: there is no car wash invoice or wash report in the file. There is nothing to import for car washes.",
    "Δεν υπάρχουν πλυσίματα αυτόν τον μήνα: δεν υπάρχει τιμολόγιο ή αναφορά πλυσίματος στο αρχείο. Δεν υπάρχουν δεδομένα πλυσίματος για εισαγωγή.",
    "Sem lavagens este mês: não há fatura nem relatório de lavagens no ficheiro. Não há dados de lavagens para importar."
  ],
  [
    "טבלת סוף שנה",
    "Year-end table",
    "Πίνακας τέλους έτους",
    "Tabela de fim de ano"
  ],
  [
    "דלק — יבוא לסאפ",
    "Fuel — import to SAP",
    "Καύσιμα — εισαγωγή στο SAP",
    "Combustível — importar para SAP"
  ],
  [
    "כביש 6 — יבוא לסאפ",
    "Route 6 — import to SAP",
    "Οδός 6 — εισαγωγή στο SAP",
    "Estrada 6 — importar para SAP"
  ],
  [
    "כביש 6 — יבוא תנועות יומן לסאפ",
    "Route 6 — import journal entries to SAP",
    "Οδός 6 — εισαγωγή λογιστικών εγγραφών στο SAP",
    "Estrada 6 — importar lançamentos para SAP"
  ],
  [
    "מעלים את חשבונית המס של כביש 6 (PDF), אפשר כמה חשבוניות יחד, ומקבלים את קבצי היבוא לסאפ.",
    "Upload Route 6 tax invoices (PDF), including several together, to receive SAP import files.",
    "Μεταφορτώστε τιμολόγια της Οδού 6 (PDF), ακόμη και πολλά μαζί, για να λάβετε αρχεία εισαγωγής SAP.",
    "Carregue faturas fiscais da Estrada 6 (PDF), incluindo várias em conjunto, para obter os ficheiros de importação para SAP."
  ],
  [
    "העלאת חשבוניות כביש 6",
    "Upload Route 6 invoices",
    "Μεταφόρτωση τιμολογίων Οδού 6",
    "Carregar faturas da Estrada 6"
  ],
  [
    "כרטיס בקובץ",
    "Account in file",
    "Λογαριασμός στο αρχείο",
    "Conta no ficheiro"
  ],
  [
    "שיוך לשורה מטבלת ההכנה",
    "Match to a preparation table row",
    "Αντιστοίχιση σε γραμμή πίνακα προετοιμασίας",
    "Associar a uma linha da tabela de preparação"
  ],
  [
    "יצירת כרטיס חדש",
    "Create new account",
    "Δημιουργία νέου λογαριασμού",
    "Criar nova conta"
  ],
  [
    "רכב ללא כרטיס",
    "Vehicle without an account",
    "Όχημα χωρίς λογαριασμό",
    "Veículo sem conta"
  ],
  [
    "בחירת שורה",
    "Choose row",
    "Επιλογή γραμμής",
    "Escolher linha"
  ],
  [
    "מספר כרטיס",
    "Account number",
    "Αριθμός λογαριασμού",
    "Número da conta"
  ],
  [
    "ליסינג/ מאיה",
    "Leasing / Maya",
    "Μίσθωση / Maya",
    "Leasing / Maya"
  ],
  [
    "ייבוא קובץ השכר/רכבים נכשל.",
    "Salary / vehicle file import failed.",
    "Η εισαγωγή αρχείου μισθών / οχημάτων απέτυχε.",
    "Falha ao importar o ficheiro de salários / veículos."
  ],
  [
    "ייבוא קובץ ההכנה/יתרות נכשל.",
    "Preparation / balances file import failed.",
    "Η εισαγωγή αρχείου προετοιμασίας / υπολοίπων απέτυχε.",
    "Falha ao importar o ficheiro de preparação / saldos."
  ],
  [
    "סוף שנה",
    "Year end",
    "Τέλος έτους",
    "Fim de ano"
  ],
  [
    "טבלת רכבים למאזן",
    "Vehicle table for the balance sheet",
    "Πίνακας οχημάτων για τον ισολογισμό",
    "Tabela de veículos para o balanço"
  ],
  [
    "מעלים את טבלת השכר/רכבים ואת טבלת ההכנה ליתרות יחד, והמערכת בונה מהן את הטבלה לרו\"ח.",
    "Upload the salary / vehicle table and the balance preparation table together. The system builds the accountant's table from them.",
    "Μεταφορτώστε μαζί τον πίνακα μισθών / οχημάτων και τον πίνακα προετοιμασίας υπολοίπων. Το σύστημα δημιουργεί από αυτά τον πίνακα του λογιστή.",
    "Carregue em conjunto a tabela de salários / veículos e a tabela de preparação de saldos. O sistema cria a tabela para o contabilista a partir delas."
  ],
  [
    "שנה",
    "Year",
    "Έτος",
    "Ano"
  ],
  [
    "יש לשייך את כל הרכבים לפני הייצוא",
    "Match all vehicles before exporting",
    "Αντιστοιχίστε όλα τα οχήματα πριν από την εξαγωγή",
    "Associe todos os veículos antes de exportar"
  ],
  [
    "שלב 1: טבלת שכר/רכבים",
    "Step 1: Salary / vehicle table",
    "Βήμα 1: Πίνακας μισθών / οχημάτων",
    "Passo 1: Tabela de salários / veículos"
  ],
  [
    "טרם הועלה קובץ",
    "No file uploaded yet",
    "Δεν έχει μεταφορτωθεί αρχείο ακόμη",
    "Ainda sem ficheiro carregado"
  ],
  [
    "העלאת קובץ שכר/רכבים",
    "Upload salary / vehicle file",
    "Μεταφόρτωση αρχείου μισθών / οχημάτων",
    "Carregar ficheiro de salários / veículos"
  ],
  [
    "שלב 2: טבלת הכנה/יתרות",
    "Step 2: Preparation / balances table",
    "Βήμα 2: Πίνακας προετοιμασίας / υπολοίπων",
    "Passo 2: Tabela de preparação / saldos"
  ],
  [
    "כרטיסים",
    "Accounts",
    "Λογαριασμοί",
    "Contas"
  ],
  [
    "העלאת קובץ הכנה/יתרות",
    "Upload preparation / balances file",
    "Μεταφόρτωση αρχείου προετοιμασίας / υπολοίπων",
    "Carregar ficheiro de preparação / saldos"
  ],
  [
    "סיכום שיוך",
    "Matching summary",
    "Σύνοψη αντιστοίχισης",
    "Resumo de associações"
  ],
  [
    "רכבים מקושרים",
    "Matched vehicles",
    "Αντιστοιχισμένα οχήματα",
    "Veículos associados"
  ],
  [
    "רכבים לא מקושרים",
    "Unmatched vehicles",
    "Μη αντιστοιχισμένα οχήματα",
    "Veículos sem associação"
  ],
  [
    "יומן עיבוד",
    "Processing log",
    "Αρχείο καταγραφής επεξεργασίας",
    "Registo de processamento"
  ],
  [
    "אזהרות",
    "Warnings",
    "Προειδοποιήσεις",
    "Avisos"
  ],
  [
    "תצוגה מקדימה",
    "Preview",
    "Προεπισκόπηση",
    "Pré-visualização"
  ],
  [
    "כרטיס",
    "Account",
    "Λογαριασμός",
    "Conta"
  ],
  [
    "מס' רכב",
    "Vehicle no.",
    "Αρ. κυκλοφορίας",
    "Matrícula"
  ],
  [
    "הוצאה במאזן",
    "Balance sheet expense",
    "Δαπάνη ισολογισμού",
    "Despesa no balanço"
  ],
  [
    "סה\"כ - אחזקת כלי רכב",
    "Total - vehicle maintenance",
    "Σύνολο - συντήρηση οχημάτων",
    "Total - manutenção de veículos"
  ],
  [
    "פרויקט פעיל",
    "Active project",
    "Ενεργό έργο",
    "Projeto ativo"
  ],
  [
    "עמודה",
    "Column",
    "Στήλη",
    "Coluna"
  ],
  [
    "הטעינה נכשלה.",
    "Loading failed.",
    "Η φόρτωση απέτυχε.",
    "Falha no carregamento."
  ],
  [
    "לא דווח החודש",
    "Not reported this month",
    "Δεν δηλώθηκε αυτόν τον μήνα",
    "Não reportado este mês"
  ],
  [
    "מערכת",
    "System",
    "Σύστημα",
    "Sistema"
  ],
  [
    "צור קובץ",
    "Create a file",
    "Δημιουργήστε αρχείο",
    "Crie um ficheiro"
  ],
  [
    "בתיקיית הפרויקט והוסף את הפרטים מ-Supabase:",
    "in the project folder and add the Supabase details:",
    "στον φάκελο του έργου και προσθέστε τα στοιχεία του Supabase:",
    "na pasta do projeto e adicione os dados do Supabase:"
  ],
  [
    "טוען רכב...",
    "Loading vehicle...",
    "Φόρτωση οχήματος...",
    "A carregar veículo..."
  ],
  [
    "הרכב לא נמצא",
    "Vehicle not found",
    "Το όχημα δεν βρέθηκε",
    "Veículo não encontrado"
  ],
  [
    "ביטוח",
    "Insurance",
    "Ασφάλιση",
    "Seguro"
  ],
  [
    "הצעות ביטוח",
    "Insurance quotes",
    "Προσφορές ασφάλισης",
    "Propostas de seguro"
  ],
  [
    "טסט",
    "Inspection",
    "Τεχνικός έλεγχος",
    "Inspeção"
  ],
  [
    "שיוכים",
    "Assignments",
    "Αναθέσεις",
    "Atribuições"
  ],
  [
    "אי אפשר להעביר את הרכב למסירה / שימוש לפני שיש פוליסה בתוקף.",
    "The vehicle cannot be handed over or used without a valid policy.",
    "Το όχημα δεν μπορεί να παραδοθεί ή να χρησιμοποιηθεί χωρίς έγκυρο ασφαλιστήριο.",
    "O veículo não pode ser entregue ou utilizado sem uma apólice válida."
  ],
  [
    "הסטטוס עודכן.",
    "Status updated.",
    "Η κατάσταση ενημερώθηκε.",
    "Estado atualizado."
  ],
  [
    "העדכון נכשל.",
    "Update failed.",
    "Η ενημέρωση απέτυχε.",
    "A atualização falhou."
  ],
  [
    "מכין קובץ...",
    "Preparing file...",
    "Προετοιμασία αρχείου...",
    "A preparar ficheiro..."
  ],
  [
    "מוריד מסמכים",
    "Downloading documents",
    "Λήψη εγγράφων",
    "A descarregar documentos"
  ],
  [
    "הקובץ נוצר. מסמכים שלא הורדו:",
    "File created. Documents not downloaded:",
    "Το αρχείο δημιουργήθηκε. Έγγραφα που δεν λήφθηκαν:",
    "Ficheiro criado. Documentos não descarregados:"
  ],
  [
    "הקובץ נוצר.",
    "File created.",
    "Το αρχείο δημιουργήθηκε.",
    "Ficheiro criado."
  ],
  [
    "הייצוא נכשל.",
    "Export failed.",
    "Η εξαγωγή απέτυχε.",
    "A exportação falhou."
  ],
  [
    "הרכב עודכן.",
    "Vehicle updated.",
    "Το όχημα ενημερώθηκε.",
    "Veículo atualizado."
  ],
  [
    "למחוק את הרכב וכל המסמכים והרשומות שלו? הפעולה אינה הפיכה. להוצאה משימוש יש לשנות סטטוס.",
    "Delete the vehicle and all its documents and records? This cannot be undone. To take it out of use, change its status instead.",
    "Διαγραφή του οχήματος και όλων των εγγράφων και εγγραφών του; Η ενέργεια είναι μη αναστρέψιμη. Για απόσυρση από χρήση, αλλάξτε την κατάστασή του.",
    "Eliminar o veículo e todos os seus documentos e registos? Esta ação é irreversível. Para o retirar de serviço, altere o estado."
  ],
  [
    "הרכב נמחק.",
    "Vehicle deleted.",
    "Το όχημα διαγράφηκε.",
    "Veículo eliminado."
  ],
  [
    "המחיקה נכשלה.",
    "Deletion failed.",
    "Η διαγραφή απέτυχε.",
    "A eliminação falhou."
  ],
  [
    "לרשימה",
    "Back to list",
    "Επιστροφή στη λίστα",
    "Voltar à lista"
  ],
  [
    "ייצוא מסמכים (ZIP)",
    "Export documents (ZIP)",
    "Εξαγωγή εγγράφων (ZIP)",
    "Exportar documentos (ZIP)"
  ],
  [
    "פרטי רכב",
    "Vehicle details",
    "Στοιχεία οχήματος",
    "Dados do veículo"
  ],
  [
    "נהג / מחזיק",
    "Driver / holder",
    "Οδηγός / κάτοχος",
    "Condutor / detentor"
  ],
  [
    "נכנס לחברה",
    "Joined company",
    "Είσοδος στην εταιρεία",
    "Entrada na empresa"
  ],
  [
    "חוזה ליסינג",
    "Lease contract",
    "Σύμβαση μίσθωσης",
    "Contrato de leasing"
  ],
  [
    "חשמלי",
    "Electric",
    "Ηλεκτρικό",
    "Elétrico"
  ],
  [
    "הוצא משימוש",
    "Out of service",
    "Εκτός χρήσης",
    "Fora de serviço"
  ],
  [
    "דוח",
    "Fine",
    "Πρόστιμο",
    "Multa"
  ],
  [
    "רשות",
    "Authority",
    "Αρχή",
    "Entidade"
  ],
  [
    "סכום לתשלום",
    "Amount payable",
    "Πληρωτέο ποσό",
    "Valor a pagar"
  ],
  [
    "היסטוריית סכום",
    "Amount history",
    "Ιστορικό ποσού",
    "Histórico de valores"
  ],
  [
    "סריקת הדוח",
    "Fine scan",
    "Σάρωση προστίμου",
    "Digitalização da multa"
  ],
  [
    "עדכון סכום (למשל אחרי חיוב ריבית)",
    "Update amount (for example, after interest)",
    "Ενημέρωση ποσού (π.χ. μετά από τόκους)",
    "Atualizar valor (por exemplo, após juros)"
  ],
  [
    "סכום חדש מהרשות (₪)",
    "New amount from authority (₪)",
    "Νέο ποσό από την αρχή (₪)",
    "Novo valor da entidade (₪)"
  ],
  [
    "הסכום עודכן.",
    "Amount updated.",
    "Το ποσό ενημερώθηκε.",
    "Valor atualizado."
  ],
  [
    "עדכון סכום",
    "Update amount",
    "Ενημέρωση ποσού",
    "Atualizar valor"
  ],
  [
    "למחוק את הדוח?",
    "Delete the fine?",
    "Διαγραφή του προστίμου;",
    "Eliminar a multa?"
  ],
  [
    "הדוח נמחק.",
    "Fine deleted.",
    "Το πρόστιμο διαγράφηκε.",
    "Multa eliminada."
  ],
  [
    "הדוח סומן כבערעור.",
    "The fine was marked as under appeal.",
    "Το πρόστιμο επισημάνθηκε ως υπό ένσταση.",
    "A multa foi marcada como em recurso."
  ],
  [
    "סימון ערעור",
    "Mark as under appeal",
    "Σήμανση ως υπό ένσταση",
    "Marcar como em recurso"
  ],
  [
    "הדוח סומן כמועבר לנהג.",
    "The fine was marked as transferred to the driver.",
    "Το πρόστιμο επισημάνθηκε ως μεταβιβασμένο στον οδηγό.",
    "A multa foi marcada como transferida para o condutor."
  ],
  [
    "סימון כמועבר לנהג",
    "Mark as transferred to driver",
    "Σήμανση ως μεταβιβασμένο στον οδηγό",
    "Marcar como transferida para o condutor"
  ],
  [
    "הדוח סומן כשולם.",
    "The fine was marked as paid.",
    "Το πρόστιμο επισημάνθηκε ως πληρωμένο.",
    "A multa foi marcada como paga."
  ],
  [
    "סימון כשולם",
    "Mark as paid",
    "Σήμανση ως πληρωμένο",
    "Marcar como paga"
  ],
  [
    "טבלת הדוחות עדיין לא קיימת במסד הנתונים. יש להריץ את המיגרציה.",
    "The fines table does not exist in the database yet. Run the migration.",
    "Ο πίνακας προστίμων δεν υπάρχει ακόμη στη βάση δεδομένων. Εκτελέστε τη μεταφορά.",
    "A tabela de multas ainda não existe na base de dados. Execute a migração."
  ],
  [
    "הדוח נשמר.",
    "Fine saved.",
    "Το πρόστιμο αποθηκεύτηκε.",
    "Multa guardada."
  ],
  [
    "טוען דוחות...",
    "Loading fines...",
    "Φόρτωση προστίμων...",
    "A carregar multas..."
  ],
  [
    "דוחות",
    "Fines",
    "Πρόστιμα",
    "Multas"
  ],
  [
    "סה\"כ פתוח לתשלום",
    "Total outstanding amount",
    "Συνολικό ανεξόφλητο ποσό",
    "Total em dívida"
  ],
  [
    "לרשימת הרכבים",
    "Back to vehicle list",
    "Επιστροφή στη λίστα οχημάτων",
    "Voltar à lista de veículos"
  ],
  [
    "פתוחים",
    "Open",
    "Ανοιχτά",
    "Em aberto"
  ],
  [
    "הכל",
    "All",
    "Όλα",
    "Todos"
  ],
  [
    "אין דוחות להצגה",
    "No fines to display",
    "Δεν υπάρχουν πρόστιμα για εμφάνιση",
    "Sem multas para apresentar"
  ],
  [
    "אפשר להעלות סריקה והמערכת תמלא את הפרטים.",
    "Upload a scan and the system will fill in the details.",
    "Μεταφορτώστε μια σάρωση και το σύστημα θα συμπληρώσει τα στοιχεία.",
    "Carregue uma digitalização e o sistema preencherá os dados."
  ],
  [
    "מס׳ דוח",
    "Fine no.",
    "Αρ. προστίμου",
    "N.º da multa"
  ],
  [
    "סכום",
    "Amount",
    "Ποσό",
    "Valor"
  ],
  [
    "טבלאות הרכבים עדיין לא קיימות במסד הנתונים. יש להריץ את המיגרציה.",
    "The vehicle tables do not exist in the database yet. Run the migration.",
    "Οι πίνακες οχημάτων δεν υπάρχουν ακόμη στη βάση δεδομένων. Εκτελέστε τη μεταφορά.",
    "As tabelas de veículos ainda não existem na base de dados. Execute a migração."
  ],
  [
    "הרכב נוסף.",
    "Vehicle added.",
    "Το όχημα προστέθηκε.",
    "Veículo adicionado."
  ],
  [
    "קושרו",
    "Linked",
    "Συνδέθηκαν",
    "Associados"
  ],
  [
    "נהגים למשתמשים",
    "drivers to users",
    "οδηγοί με χρήστες",
    "condutores a utilizadores"
  ],
  [
    "יובאו",
    "Imported",
    "Εισήχθησαν",
    "Importados"
  ],
  [
    "דולגו (כבר קיימים)",
    "Skipped (already exist)",
    "Παραλείφθηκαν (υπάρχουν ήδη)",
    "Ignorados (já existem)"
  ],
  [
    "ניהול הצי, ביטוחים, טסטים ומסמכים",
    "Manage fleet, insurance, inspections and documents",
    "Διαχείριση στόλου, ασφάλισης, τεχνικών ελέγχων και εγγράφων",
    "Gerir frota, seguros, inspeções e documentos"
  ],
  [
    "התאמת נהגים",
    "Match drivers",
    "Αντιστοίχιση οδηγών",
    "Associar condutores"
  ],
  [
    "ייבוא מטבלה",
    "Import from table",
    "Εισαγωγή από πίνακα",
    "Importar de tabela"
  ],
  [
    "חיפוש לפי מספר, דגם או נהג",
    "Search by number, model or driver",
    "Αναζήτηση με αριθμό, μοντέλο ή οδηγό",
    "Pesquisar por matrícula, modelo ou condutor"
  ],
  [
    "פעילים",
    "Active",
    "Ενεργά",
    "Ativos"
  ],
  [
    "אין רכבים התואמים לסינון",
    "No vehicles match the filter",
    "Δεν υπάρχουν οχήματα που ταιριάζουν στο φίλτρο",
    "Nenhum veículo corresponde ao filtro"
  ],
  [
    "עדיין אין רכבים במערכת",
    "No vehicles in the system yet",
    "Δεν υπάρχουν οχήματα στο σύστημα ακόμη",
    "Ainda não há veículos no sistema"
  ],
  [
    "אפשר להוסיף רכב או לייבא את הטבלה הקיימת.",
    "Add a vehicle or import the existing table.",
    "Προσθέστε όχημα ή εισαγάγετε τον υπάρχοντα πίνακα.",
    "Adicione um veículo ou importe a tabela existente."
  ],
  [
    "מקושר למשתמש במערכת",
    "Linked to a system user",
    "Συνδεδεμένο με χρήστη συστήματος",
    "Associado a um utilizador do sistema"
  ]
];

export const heAdditional = Object.fromEntries(entries.map(([key]) => [key, key]));
export const enAdditional = Object.fromEntries(entries.map(([key, en]) => [key, en]));
export const elAdditional = Object.fromEntries(entries.map(([key, , el]) => [key, el]));
export const ptAdditional = Object.fromEntries(entries.map(([key, , , pt]) => [key, pt]));
