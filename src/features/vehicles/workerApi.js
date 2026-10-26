import {
  approveForm,
  getFormSignature,
  getVehicleForms,
  getVehicleFuelReports,
  rpcAvailableVehicles,
  rpcDeclareVehicle,
  rpcMyForms,
  rpcMyFuelReports,
  rpcMyVehicles,
  rpcReportFuel,
  rpcReportOdometer,
} from '../../services/api/vehicleWorker.js';
import { createUserNotification } from '../notifications/api.js';
import { declarationErrorMessage } from './utils/declarationRules.js';

function unwrap(result) {
  if (result.error) {
    const friendly = declarationErrorMessage(result.error);
    if (friendly) throw new Error(friendly);
    throw result.error;
  }
  return result.data;
}

/** True when the worker functions have not been created yet (migration not applied). */
export function isWorkerFlowMissing(error) {
  return error?.code === '42883' || error?.code === 'PGRST202' || error?.code === '42P01' || error?.code === 'PGRST205';
}

// ---- worker side
export async function loadMyVehicleOverview() {
  const [vehicles, available, forms, fuelReports] = await Promise.all([
    rpcMyVehicles().then(unwrap),
    rpcAvailableVehicles().then(unwrap),
    rpcMyForms().then(unwrap),
    rpcMyFuelReports().then(unwrap),
  ]);
  return { vehicles: vehicles || [], available: available || [], forms: forms || [], fuelReports: fuelReports || [] };
}

export async function reportMyOdometer(vehicleId, km) {
  unwrap(await rpcReportOdometer(vehicleId, Number(km)));
}

export async function reportMyFuel({ vehicleId, month, liters, amount }) {
  unwrap(await rpcReportFuel({
    vehicleId,
    month,
    liters: Number(liters),
    amount: amount === '' || amount == null ? null : Number(amount),
  }));
}

/** form: see validateDeclaration in utils/declarationRules.js. Returns the new form id. */
export async function submitDeclaration(form) {
  return unwrap(await rpcDeclareVehicle({
    action: form.action,
    vehicleId: form.vehicleId,
    returnedVehicleId: form.returnedVehicleId || null,
    use: form.use,
    isRegular: Boolean(form.isRegular),
    odometer: form.odometer === '' || form.odometer == null ? null : Number(form.odometer),
    returnedOdometer: form.returnedOdometer === '' || form.returnedOdometer == null ? null : Number(form.returnedOdometer),
    place: form.place,
    happenedAt: form.happenedAt ? new Date(form.happenedAt).toISOString() : null,
    checklist: form.checklist,
    signature: form.signature,
    liabilityAck: Boolean(form.liabilityAck),
  }));
}

// ---- manager side (vehicle card)
export async function loadVehicleForms(vehicleId) {
  const result = await getVehicleForms(vehicleId);
  return result.error ? [] : result.data || [];
}

export async function loadVehicleFuelReports(vehicleId) {
  const result = await getVehicleFuelReports(vehicleId);
  return result.error ? [] : result.data || [];
}

export async function loadFormSignature(formId) {
  const result = await getFormSignature(formId);
  return result.error ? '' : result.data?.signature_data || '';
}

export async function approveDeclaration(form, vehicle, user) {
  await unwrap(await approveForm(form.id, user.id));
  if (form.user_id) {
    await createUserNotification(
      form.user_id,
      'vehicle_declaration',
      `טופס הרכב ${vehicle.plate_number} אושר`,
      `${user.name || 'מנהל'} אישר/ה את הטופס.`,
    );
  }
}
