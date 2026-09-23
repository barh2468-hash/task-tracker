export type StatusEmailTheme = {
  accent: string;
  background: string;
  border: string;
  text: string;
};

const DEFAULT_STATUS_THEME: StatusEmailTheme = {
  accent: '#ef7d32',
  background: '#fff2df',
  border: '#f6c981',
  text: '#a45c00',
};

const STATUS_EMAIL_THEMES: Record<string, StatusEmailTheme> = {
  'בעבודה בשטח': DEFAULT_STATUS_THEME,
  'נדרש GPR': {
    accent: '#258fc4',
    background: '#e3f3fe',
    border: '#9ed5ef',
    text: '#0870ad',
  },
  'מחכה להיתרים': {
    accent: '#d65f19',
    background: '#ffede4',
    border: '#fdba8c',
    text: '#bd4d17',
  },
  'עבר לשרטוט': {
    accent: '#7c4dcc',
    background: '#f0e8fc',
    border: '#cbb4ef',
    text: '#7040aa',
  },
  'נשלח להגהה': {
    accent: '#e11d48',
    background: '#ffe4e6',
    border: '#fda4af',
    text: '#be123c',
  },
  'עבר לבקרה': {
    accent: '#16a34a',
    background: '#dcfce7',
    border: '#86efac',
    text: '#087a36',
  },
  הושלם: {
    accent: '#0f9b63',
    background: '#e4f8eb',
    border: '#86ddb0',
    text: '#08783a',
  },
};

export function getStatusEmailTheme(status?: string | null): StatusEmailTheme {
  return (status && STATUS_EMAIL_THEMES[status]) || DEFAULT_STATUS_THEME;
}
