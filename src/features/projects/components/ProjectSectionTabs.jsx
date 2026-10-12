import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { t } from '../../language/LanguageContext.jsx';

export default function ProjectSectionTabs({ children }) {
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
      <div ref={tabsRef} className="projectSectionTabs" role="tablist" aria-label={t('פרטי הפרויקט')}>
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
