import { localizedField } from '../../../utils/localizedField.js';

// The project's name in the current UI language (Hebrew when no usable
// translation exists). Use for display only; search, exports, emails and
// notification text keep the Hebrew `project.name`.
export function projectName(project, language) {
  return localizedField(project, 'name', language);
}
