// Pure alert rules for the fleet module. No I/O: index.ts loads the data,
// calls buildAlerts, de-duplicates against existing notifications and sends.

export type Period = 'day' | 'month';

export type Alert = {
  recipientId: string;
  type: string;
  title: string;
  body: string;
  url: string;
  period: Period;
};

type Vehicle = {
  id: string;
  plate_number: string;
  make_model: string;
  kind: string;
  status: string;
  driver_id: string | null;
  lease_end: string | null;
};

export type AlertInput = {
  today: string; // Israel local date, YYYY-MM-DD
  weekday: number; // 0 = Sunday
  vehicles: Vehicle[];
  policies: { vehicle_id: string; valid_to: string }[];
  inspections: { vehicle_id: string; valid_to: string }[];
  readingsThisMonth: { vehicle_id: string }[];
  openAssignments: { vehicle_id: string; driver_id: string | null; driver_name: string }[];
  fleetIds: string[];
  nameById: Record<string, string>;
  unpaidFines: {
    id: string;
    vehicle_id: string;
    driver_id: string | null;
    fine_number: string;
    amount_ils: number;
    due_date: string | null;
    status: string;
  }[];
};

const EXPIRY_MILESTONES = [60, 30, 14, 7, 0];
const LEASE_MILESTONES = [90, 60, 30, 14, 7, 0];
const ODOMETER_ESCALATION_DAY = 4;
const FINE_MILESTONES = [7, 3, 0];
const ACTIVE = ['in_use', 'in_service'];

export function daysBetween(from: string, to: string) {
  const a = Date.parse(`${from}T12:00:00Z`);
  const b = Date.parse(`${to}T12:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

const formatDate = (value: string) => {
  const [y, m, d] = value.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

function latestByVehicle(rows: { vehicle_id: string; valid_to: string }[]) {
  const map = new Map<string, string>();
  for (const row of rows) {
    const current = map.get(row.vehicle_id);
    if (!current || row.valid_to > current) map.set(row.vehicle_id, row.valid_to);
  }
  return map;
}

function isMilestone(daysLeft: number, milestones: number[]) {
  if (milestones.includes(daysLeft)) return true;
  // Overdue: repeat weekly until it is fixed.
  return daysLeft < 0 && (-daysLeft) % 7 === 0;
}

function expiryPhrase(daysLeft: number) {
  if (daysLeft > 0) return `בעוד ${daysLeft} ימים`;
  if (daysLeft === 0) return 'היום';
  return `לפני ${-daysLeft} ימים`;
}

export function buildAlerts(input: AlertInput): Alert[] {
  const alerts: Alert[] = [];
  const { today, vehicles, fleetIds } = input;
  const holderByVehicle = new Map<string, { id: string | null; name: string }>();
  const open = new Map(input.openAssignments.map((a) => [a.vehicle_id, a]));
  for (const vehicle of vehicles) {
    const assignment = open.get(vehicle.id);
    if (assignment) holderByVehicle.set(vehicle.id, { id: assignment.driver_id, name: assignment.driver_name });
    else if (vehicle.driver_id) holderByVehicle.set(vehicle.id, { id: vehicle.driver_id, name: input.nameById[vehicle.driver_id] || '' });
  }

  const push = (recipients: Iterable<string>, alert: Omit<Alert, 'recipientId'>) => {
    for (const recipientId of new Set(recipients)) alerts.push({ ...alert, recipientId });
  };

  const insurance = latestByVehicle(input.policies);
  const inspections = latestByVehicle(input.inspections);
  const live = vehicles.filter((vehicle) => vehicle.status !== 'retired');

  for (const vehicle of live) {
    const plate = vehicle.plate_number;
    const detail = vehicle.make_model;

    const insuranceEnd = insurance.get(vehicle.id);
    if (insuranceEnd) {
      const left = daysBetween(today, insuranceEnd);
      if (isMilestone(left, EXPIRY_MILESTONES)) {
        push(fleetIds, {
          type: 'vehicle_insurance_expiry',
          title: `ביטוח ${plate} פג ${expiryPhrase(left)}`,
          body: `${detail} · בתוקף עד ${formatDate(insuranceEnd)}`,
          url: `/app/vehicles/${vehicle.id}`,
          period: 'day',
        });
      }
    }

    const inspectionEnd = inspections.get(vehicle.id);
    if (inspectionEnd && vehicle.kind !== 'trailer') {
      const left = daysBetween(today, inspectionEnd);
      if (isMilestone(left, EXPIRY_MILESTONES)) {
        push(fleetIds, {
          type: 'vehicle_inspection_expiry',
          title: `טסט ${plate} פג ${expiryPhrase(left)}`,
          body: `${detail} · בתוקף עד ${formatDate(inspectionEnd)}`,
          url: `/app/vehicles/${vehicle.id}`,
          period: 'day',
        });
      }
    }

    if (vehicle.lease_end) {
      const left = daysBetween(today, vehicle.lease_end);
      if (left >= 0 && LEASE_MILESTONES.includes(left)) {
        push(fleetIds, {
          type: 'vehicle_lease_end',
          title: `חוזה ליסינג ${plate} מסתיים ${expiryPhrase(left)}`,
          body: `${detail} · סיום חוזה ${formatDate(vehicle.lease_end)}`,
          url: `/app/vehicles/${vehicle.id}`,
          period: 'day',
        });
      }
    }
  }

  // Weekly digest of data that was never entered (so 30 vehicles with no
  // policy yet produce one message a week, not thirty a day).
  if (input.weekday === 0) {
    const tracked = live.filter((vehicle) => ACTIVE.includes(vehicle.status));
    const noInsurance = tracked.filter((vehicle) => !insurance.has(vehicle.id));
    const noInspection = tracked.filter((vehicle) => vehicle.kind !== 'trailer' && !inspections.has(vehicle.id));
    const sample = (list: Vehicle[]) =>
      list.slice(0, 8).map((vehicle) => vehicle.plate_number).join(', ') + (list.length > 8 ? ` ועוד ${list.length - 8}` : '');
    if (noInsurance.length) {
      push(fleetIds, {
        type: 'vehicle_missing_data',
        title: `${noInsurance.length} רכבים ללא ביטוח במערכת`,
        body: sample(noInsurance),
        url: '/app/vehicles',
        period: 'day',
      });
    }
    if (noInspection.length) {
      push(fleetIds, {
        type: 'vehicle_missing_data',
        title: `${noInspection.length} רכבים ללא טסט במערכת`,
        body: sample(noInspection),
        url: '/app/vehicles',
        period: 'day',
      });
    }
  }

  // Monthly odometer: a few days into the month the secretary gets the list of
  // vehicles nobody has reported yet, to enter or chase herself.
  const reported = new Set(input.readingsThisMonth.map((reading) => reading.vehicle_id));
  const needReading = live.filter(
    (vehicle) => vehicle.status === 'in_use' && vehicle.kind !== 'trailer' && !reported.has(vehicle.id),
  );
  const dayOfMonth = Number(today.slice(8, 10));
  if (dayOfMonth >= ODOMETER_ESCALATION_DAY && needReading.length) {
    const lines = needReading.slice(0, 10).map((vehicle) => {
      const name = holderByVehicle.get(vehicle.id)?.name;
      return `${vehicle.plate_number} (${name || 'ללא נהג מקושר'})`;
    });
    push(fleetIds, {
      type: 'vehicle_odometer_escalation',
      title: 'דיווח ק"מ חודשי חסר',
      body: `${needReading.length} רכבים טרם דווחו: ${lines.join(', ')}${needReading.length > 10 ? ' ...' : ''}`,
      url: '/app/vehicles',
      period: 'month',
    });
  }

  // Unpaid fines: the secretary is reminded before the due date and weekly after it. The authority's current amount
  // is what is shown (late-payment increases arrive as a newer scan).
  const plateById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle.plate_number]));
  for (const fine of input.unpaidFines) {
    if (!fine.due_date) continue;
    const left = daysBetween(today, fine.due_date);
    if (!isMilestone(left, FINE_MILESTONES)) continue;
    const plate = plateById.get(fine.vehicle_id) || '';
    const label = fine.fine_number ? `דוח ${fine.fine_number}` : 'דוח';
    push(fleetIds, {
      type: 'vehicle_fine_due',
      title: `${label} (${plate}) ${left < 0 ? 'באיחור' : 'לתשלום'} ${left < 0 ? `של ${-left} ימים` : expiryPhrase(left)}`,
      body: `סכום לתשלום: ${fine.amount_ils} ₪ · עד ${formatDate(fine.due_date)}`,
      url: '/app/vehicles/fines',
      period: 'day',
    });
  }

  return alerts;
}
