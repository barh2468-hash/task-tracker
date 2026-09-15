import {
  createFieldEquipmentRecord,
  createFieldEquipmentImport,
  deleteFieldEquipmentImport,
  getFieldEquipmentRecords,
  getLatestFieldEquipmentImport,
  insertFieldEquipmentRecords,
  updateFieldEquipmentImport,
  updateFieldEquipmentRecord,
} from '../../services/api/fieldEquipment.js';

function throwIfError(result) {
  if (result.error) throw result.error;
  return result.data;
}

export async function loadLatestEquipmentSnapshot() {
  const equipmentImport = throwIfError(await getLatestFieldEquipmentImport());
  if (!equipmentImport) return { equipmentImport: null, records: [] };
  const records = throwIfError(await getFieldEquipmentRecords(equipmentImport.id)) || [];
  return { equipmentImport, records };
}

export async function saveEquipmentSnapshot(parsed, importedBy) {
  const equipmentImport = throwIfError(
    await createFieldEquipmentImport({
      title: parsed.title,
      source_file_name: parsed.sourceFileName,
      source_period: parsed.sourcePeriod,
      raw_headers: parsed.rawHeaders,
      display_headers: parsed.displayHeaders,
      record_count: parsed.records.length,
      encoding_warning: parsed.encodingWarning,
      imported_by: importedBy,
    }),
  );

  try {
    const rows = parsed.records.map((record) => ({
      import_id: equipmentImport.id,
      source_row_number: record.source_row_number,
      worker_name: record.worker_name,
      source_name_unreadable: record.source_name_unreadable,
      section_name: record.section_name,
      source_section: record.source_section,
      checked_item_count: record.checked_item_count,
      cells: record.cells,
    }));

    for (let index = 0; index < rows.length; index += 250) {
      throwIfError(await insertFieldEquipmentRecords(rows.slice(index, index + 250)));
    }
  } catch (error) {
    await deleteFieldEquipmentImport(equipmentImport.id);
    throw error;
  }

  return { equipmentImport, records: parsed.records };
}

export async function saveEquipmentRecord(recordId, payload) {
  return throwIfError(await updateFieldEquipmentRecord(recordId, payload));
}

export async function addEquipmentRecord(importId, payload, nextRecordCount) {
  const record = throwIfError(
    await createFieldEquipmentRecord({
      ...payload,
      import_id: importId,
    }),
  );
  const equipmentImport = throwIfError(
    await updateFieldEquipmentImport(importId, { record_count: nextRecordCount }),
  );
  return { record, equipmentImport };
}
