// This controls visibility only. The server independently checks its private access table.
const quoteUserIds = new Set([
  '8b93c4e8-df14-4eb5-b2fc-b6ace307cb94', // Bar
  'c03434ca-a07e-4040-a431-69fbfffb3c75', // Peleg
]);
export function canUseQuotes(userId) {
  return typeof userId === 'string' && quoteUserIds.has(userId);
}
