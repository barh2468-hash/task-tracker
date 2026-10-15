import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { t } from '../../language/LanguageContext.jsx';
import { useTranslation } from 'react-i18next';

export default function ProjectSectionTabs({ children }) {
  useTranslation();
  const tabsRef = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const tabs = tabsRef.current;
    const updateEdges = () => {
      const bounds = tabs.getBoundingClientRect();
      const items = [...tabs.children].map((item) => item.getBoundingClientRect());
      // Use visible bounds so the arrows work in both RTL and LTR layouts.
      const left = items.some((item) => item.left < bounds.left - 2);
      const right = items.some((item) => item.right > bounds.right + 2);
      setEdges((previous) =>
        previous.left === left && previous.right === right ? previous : { left, right },
      );
    };
    const observer = new ResizeObserver(updateEdges);
    observer.observe(tabs);
    [...tabs.children].forEach((item) => observer.observe(item));
    tabs.addEventListener('scroll', updateEdges, { passive: true });
    updateEdges();
    return () => {
      observer.disconnect();
      tabs.removeEventListener('scroll', updateEdges);
    };
  }, []);

  function scrollTabs(direction) {
    const tabs = tabsRef.current;
    tabs.scrollBy({
      left: direction * Math.max(128, tabs.clientWidth * 0.75),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  }

  return (
    <div className="projectSectionTabsWrapper">
      <div
        ref={tabsRef}
        className="projectSectionTabs"
        role="tablist"
        tabIndex={-1}
        aria-label={t('פרטי הפרויקט')}
        onKeyDown={(event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          const tabs = [...tabsRef.current.querySelectorAll('[role="tab"]')];
          const current = tabs.indexOf(document.activeElement);
          if (current < 0) return;
          event.preventDefault();
          const rtl = getComputedStyle(tabsRef.current).direction === 'rtl';
          const direction = (event.key === 'ArrowRight' ? 1 : -1) * (rtl ? -1 : 1);
          const next =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? tabs.length - 1
                : (current + direction + tabs.length) % tabs.length;
          tabs[next].focus();
          tabs[next].click();
          tabs[next].scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }}
      >
        {children}
      </div>
      {edges.left && (
        <button
          type="button"
          className="projectTabsScrollArrow projectTabsScrollLeft"
          aria-label={t('גלילת לשוניות שמאלה')}
          title={t('גלילת לשוניות שמאלה')}
          onClick={() => scrollTabs(-1)}
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
      )}
      {edges.right && (
        <button
          type="button"
          className="projectTabsScrollArrow projectTabsScrollRight"
          aria-label={t('גלילת לשוניות ימינה')}
          title={t('גלילת לשוניות ימינה')}
          onClick={() => scrollTabs(1)}
        >
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
