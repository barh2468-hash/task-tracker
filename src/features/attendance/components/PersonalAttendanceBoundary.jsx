import { Component } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { t } from '../../language/LanguageContext.jsx';
import '../personal.css';

class ReportBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error('Personal attendance page failed:', error, info);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function PersonalAttendanceBoundary({ children }) {
  useTranslation();
  return (
    <ReportBoundary fallback={
      <section className="card" role="alert" aria-labelledby="personal-attendance-error-title">
        <h2 id="personal-attendance-error-title">{t('personalAttendanceRecovery.title')}</h2>
        <p>{t('personalAttendanceRecovery.help')}</p>
        <div className="personalReportActions">
          <button type="button" onClick={() => window.location.reload()}>
            {t('personalAttendanceRecovery.reload')}
          </button>
          <Link to="/app/attendance" className="ghost">{t('personalAttendanceRecovery.back')}</Link>
        </div>
      </section>
    }>
      {children}
    </ReportBoundary>
  );
}
