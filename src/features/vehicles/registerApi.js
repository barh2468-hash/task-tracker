import { getVehiclePage, insertVehicle, updateVehicle, upsertVehicles } from '../../services/api/vehicleRegister.js';
import { parseVehicleMileage, toVehiclePayload } from './vehicleRegister.js';

export async function loadVehicles() {
  const records = [];
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await getVehiclePage(from, pageSize);
    if (error) throw error;
    records.push(...data);
    if (data.length < pageSize) return records;
  }
}

export async function saveVehicle(record) {
  // Mileage has its own inline save. A general edit must not overwrite a
  // newer odometer reading captured while this dialog was open.
  const { current_mileage: _currentMileage, ...details } = record;
  const payload = toVehiclePayload(details);
  const { data, error } = await (record.id ? updateVehicle(record.id, payload) : insertVehicle(payload));
  if (error) throw error;
  return data;
}

export async function importVehicles(records) {
  const { error } = await upsertVehicles(records.map(toVehiclePayload));
  if (error) throw error;
}

export async function saveVehicleMileage(id, mileage) {
  const { data, error } = await updateVehicle(id, { current_mileage: parseVehicleMileage(mileage) });
  if (error) throw error;
  return data;
}
