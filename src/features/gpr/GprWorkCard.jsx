import { ArrowLeft, CalendarDays, Mail, MapPin, Pencil, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { t, useLanguage } from '../language/LanguageContext.jsx';
import { localeForLanguage } from '../language/locale.js';
import { orderName } from './model.js';
import { GprChecklist, GprQuickStatus } from './GprProgress.jsx';

export default function GprWorkCard({ order, busy, onChange, onOpen, onEdit }) {
  useTranslation();
  const { language } = useLanguage();
  return (
    <article className={`gprWorkCard gprAccent-${order.status}`} aria-busy={busy}>
      <header>
        <span className="gprCardSource">
          <Mail size={13} aria-hidden="true" />
          {t(order.source_email ? 'gpr.fromEmail' : 'gpr.manual')}
          {order.order_number && <bdi>{t('gpr.orderCode', { number: order.order_number })}</bdi>}
        </span>
        <span className={`pill gprStatus gprStatus-${order.status}`}>
          {t(`gpr.status.${order.status}`)}
        </span>
      </header>
      <button
        className="gprCardTitle"
        type="button"
        onClick={onOpen}
        aria-label={t('gpr.open', { name: orderName(order, t) })}
      >
        <h3 dir="auto">{orderName(order, t)}</h3>
      </button>
      <div className="gprCardMeta">
        <span>
          <MapPin size={14} aria-hidden="true" />
          <bdi>{order.location || t('gpr.missingLocation')}</bdi>
        </span>
        <span>
          <UserRound size={14} aria-hidden="true" />
          <bdi>{order.contact_name || t('gpr.missingContact')}</bdi>
        </span>
        {order.scheduled_for && (
          <span>
            <CalendarDays size={14} aria-hidden="true" />
            {new Intl.DateTimeFormat(localeForLanguage(language), {
              timeZone: 'Asia/Hebron',
              dateStyle: 'medium',
            }).format(new Date(`${order.scheduled_for}T12:00:00Z`))}
          </span>
        )}
      </div>
      {order.client_name && (
        <p className="gprCardClient" dir="auto">
          {order.client_name}
        </p>
      )}
      <GprChecklist order={order} busy={busy} onChange={onChange} />
      <GprQuickStatus order={order} busy={busy} onChange={onChange} />
      <footer>
        <button className="ghost smallBtn" type="button" onClick={onOpen}>
          <Mail size={15} />
          {t('gpr.detailsAndMail')}
          <ArrowLeft size={14} className="gprDirectional" />
        </button>
        <button className="ghost smallBtn" type="button" onClick={onEdit} disabled={busy}>
          <Pencil size={14} />
          {t('gpr.edit')}
        </button>
      </footer>
    </article>
  );
}
