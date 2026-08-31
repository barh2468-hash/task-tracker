export const statuses = [
  "בעבודה בשטח",
  "עבר לשרטוט",
  "נדרש GPR",
  "מחכה להיתרים",
  "הושלם",
] as const;

export const statusProgress: Record<string, number> = {
  "בעבודה בשטח": 25,
  "נדרש GPR": 35,
  "מחכה להיתרים": 10,
  "עבר לשרטוט": 75,
  הושלם: 100,
};

export const reviewStatus = "נשלח להגהה";

export const appStatuses = (statuses as readonly string[]).includes(reviewStatus)
  ? statuses
  : [...statuses, reviewStatus];
