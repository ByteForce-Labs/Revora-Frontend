import React, { useState, useEffect } from 'react';

export interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onTabChange, className = '' }) => {
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const activeIndex = tabs.findIndex(tab => tab.id === activeTab);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let newIndex = index;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        newIndex = index > 0 ? index - 1 : tabs.length - 1;
        break;
      case 'ArrowRight':
        e.preventDefault();
        newIndex = index < tabs.length - 1 ? index + 1 : 0;
        break;
      case 'Home':
        e.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        newIndex = tabs.length - 1;
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        onTabChange(tabs[index].id);
        return;
      default:
        return;
    }

    onTabChange(tabs[newIndex].id);
    setFocusedIndex(newIndex);
  };

  useEffect(() => {
    if (activeIndex >= 0) {
      setFocusedIndex(activeIndex);
    }
  }, [activeIndex]);

  return (
    <div className={`tabs-container ${className} overflow-x-auto`} role="tablist" aria-label="Activity feed filters">
      <div className="flex gap-2 min-w-max sm:flex-wrap">
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTab;
          const isFocused = index === focusedIndex;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={`tab-btn flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${isActive
                  ? 'bg-primary text-white border border-primary/20'
                  : 'bg-glass-bg border border-glass-border text-muted hover:bg-glass-border/50 hover:text-text-main'}
                } ${isFocused ? 'ring-2 ring-primary ring-offset-2 ring-offset-bg-color' : ''}
                }`}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              id={`tab-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
            >
              <span className={`tab-label ${isActive ? 'text-white' : 'text-muted'}`}>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`tab-badge px-2 py-0.5 rounded-full text-xs font-semibold ${isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-glass-border/50 text-muted'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Tabs;