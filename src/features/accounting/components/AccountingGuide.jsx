import { AlertTriangle, BookOpen, ChevronDown } from 'lucide-react';
import { t } from '../../language/LanguageContext.jsx';

const cell = { padding: '5px 10px', borderBottom: '1px solid #e3ebf1', textAlign: 'right', fontSize: 12 };

/**
 * Collapsible step-by-step user guide for an accounting page.
 * `guide` shape: see ../guides.js. Open by default so first-time users see it.
 */
export default function AccountingGuide({ guide }) {
  return (
    <section className="card accountingGuide" style={{ padding: 0, overflow: 'hidden' }}>
      <details open>
        <summary
          style={{
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
            fontWeight: 900,
            background: 'linear-gradient(120deg,#edf7fb 0%,#fff 64%)',
            listStyle: 'none',
          }}
        >
          <BookOpen size={18} />
          <span style={{ flex: 1 }}>{t('מדריך לשימוש')} — {guide.title}</span>
          <ChevronDown size={16} aria-hidden="true" />
        </summary>

        <div style={{ padding: '4px 20px 18px', display: 'grid', gap: 14 }}>
          <p style={{ margin: '10px 0 0', color: '#52677d' }}>{guide.intro}</p>

          <ol style={{ margin: 0, paddingInlineStart: 22, display: 'grid', gap: 14 }}>
            {guide.steps.map((step) => (
              <li key={step.title}>
                <b>{step.title}</b>
                {step.body.map((line) => (
                  <p key={line} style={{ margin: '4px 0 0', lineHeight: 1.55 }}>{line}</p>
                ))}
                {step.table && (
                  <div style={{ overflowX: 'auto', marginTop: 8, maxWidth: 420 }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                      <thead>
                        <tr>
                          {step.table.head.map((head) => (
                            <th key={head} style={{ ...cell, background: '#f4f8fb' }}>{head}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {step.table.rows.map(([column, field]) => (
                          <tr key={column}>
                            <td style={{ ...cell, fontWeight: 800 }}>{column}</td>
                            <td style={cell}>{field}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {step.warning && (
                  <div className="equipmentNotice warning" style={{ marginTop: 8 }} role="note">
                    <AlertTriangle size={18} />
                    <div><span>{step.warning}</span></div>
                  </div>
                )}
              </li>
            ))}
          </ol>

          {guide.troubleshooting?.length > 0 && (
            <div>
              <b>{t('משהו לא עובד?')}</b>
              <dl style={{ margin: '6px 0 0', display: 'grid', gap: 8 }}>
                {guide.troubleshooting.map((item) => (
                  <div key={item.q}>
                    <dt style={{ fontWeight: 800 }}>{item.q}</dt>
                    <dd style={{ margin: '2px 0 0', color: '#52677d' }}>{item.a}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </details>
    </section>
  );
}
