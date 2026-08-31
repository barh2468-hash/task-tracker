import { reviewStatus } from "@/src/constants/statuses";

export function getStatusClass(status: string) {
  return status === reviewStatus
    ? "review"
    : status === "הושלם"
      ? "done"
      : status === "עבר לשרטוט"
        ? "drafting"
        : status === "נדרש GPR"
          ? "gpr"
          : status === "מחכה להיתרים"
            ? "permits"
            : "field";
}
