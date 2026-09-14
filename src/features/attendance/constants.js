export const attendanceTypeOptions = [
  { value: 'field', label: 'עבודה בשטח', timed: true },
  { value: 'office', label: 'משרד', timed: true },
  { value: 'vacation', label: 'חופש', timed: false },
  { value: 'sick', label: 'מחלה', timed: false },
  { value: 'reserve_duty', label: 'מילואים', timed: false },
];

export const attendanceTypeLabel = Object.fromEntries(
  attendanceTypeOptions.map((item) => [item.value, item.label]),
);
