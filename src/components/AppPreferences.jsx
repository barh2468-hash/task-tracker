import { useTranslation } from 'react-i18next';
import { ChevronDown, Settings2 } from 'lucide-react';
import { t } from '../features/language/LanguageContext.jsx';
import PwaControls from '../features/pwa/components/PwaControls.jsx';

export default function AppPreferences() {
  useTranslation();
  return (
    <details className="sidebarPreferences">
      <summary className="sidebarDisclosure">
        <Settings2 size={18} aria-hidden="true" />
        <span className="sidebarNavText">{t('העדפות אפליקציה')}</span>
        <ChevronDown className="sidebarChevron" size={15} aria-hidden="true" />
      </summary>
      <PwaControls />
    </details>
  );
}
