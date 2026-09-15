import { useState } from 'react';
import { ExternalLink, FileCheck2 } from 'lucide-react';
import { t } from '../../language/LanguageContext.jsx';
import { useMessage } from '../../../context/MessageContext.jsx';
import * as storageApi from '../../../services/api/storage.js';

const BUCKET = 'sick-leave-certificates';

export default function SickCertificateLink({ certificate, compact = false }) {
  const { setMessage } = useMessage();
  const [loading, setLoading] = useState(false);

  if (!certificate?.file_path) return <span className="muted">{t('לא צורף אישור')}</span>;

  async function openCertificate() {
    if (loading) return;
    const popup = window.open('', '_blank');
    if (popup) popup.opener = null;
    setLoading(true);
    try {
      const { data, error } = await storageApi.createSignedUrl(
        BUCKET,
        certificate.file_path,
        60 * 10,
      );
      if (error) throw error;
      if (popup) popup.location.href = data.signedUrl;
      else window.location.assign(data.signedUrl);
    } catch (error) {
      popup?.close();
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      className={`sickCertificateLink ${compact ? 'compact' : ''}`}
      onClick={openCertificate}
      disabled={loading}
      title={certificate.original_name || t('צפייה באישור מחלה')}
    >
      <FileCheck2 size={compact ? 15 : 18} />
      <span>{loading ? t('פותח...') : certificate.original_name || t('צפייה באישור מחלה')}</span>
      <ExternalLink size={compact ? 13 : 15} />
    </button>
  );
}
