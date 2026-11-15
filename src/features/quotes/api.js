import { quoteAction } from '../../services/api/quotes.js';
export const serverQuotes = {
  load: () => quoteAction('load'),
  save: (state, revision) => quoteAction('save', { state, revision }),
  action: quoteAction,
};
