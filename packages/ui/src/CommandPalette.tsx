import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Navigation, Zap, Layers, CornerDownLeft, X } from 'lucide-react';
import { CommandItem } from './types';
import { cn } from './utils';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  items: CommandItem[];
  placeholder?: string;
}

export function CommandPalette({
  isOpen,
  onClose,
  items,
  placeholder = 'Type a command, module, or search term...',
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter items
  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    const lower = query.toLowerCase();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(lower) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(lower)) ||
        (item.keywords && item.keywords.some((k) => k.toLowerCase().includes(lower)))
    );
  }, [items, query]);

  // Group by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    for (const item of filteredItems) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return groups;
  }, [filteredItems]);

  // Reset index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < filteredItems.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filteredItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filteredItems[selectedIndex];
      if (selected) {
        if (selected.onSelect) selected.onSelect();
        if (selected.href && typeof window !== 'undefined') {
          window.location.href = selected.href;
        }
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  let flatIndexCounter = -1;

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Navigation':
        return <Navigation className="w-3.5 h-3.5 text-brand" aria-hidden="true" />;
      case 'Actions':
        return <Zap className="w-3.5 h-3.5 text-stable" aria-hidden="true" />;
      default:
        return <Layers className="w-3.5 h-3.5 text-muted" aria-hidden="true" />;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-overlay backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-surface-raised rounded-xl shadow-2xl border border-border overflow-hidden transform transition-all"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-border">
          <Search className="w-4 h-4 text-muted mr-3 shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            aria-label="Search commands"
            className="w-full text-sm bg-transparent border-0 text-text placeholder:text-subtle focus:outline-none focus:ring-0"
          />
          <kbd className="hidden sm:inline-block text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-surface-subtle text-muted border border-border">
            Esc
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-3">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted">
              No matching commands or navigation routes found.
            </div>
          ) : (
            Object.entries(groupedItems).map(([category, catItems]) => (
              <div key={category} className="space-y-1">
                <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold text-muted uppercase tracking-wider">
                  {getCategoryIcon(category)}
                  <span>{category}</span>
                </div>
                {catItems.map((item) => {
                  flatIndexCounter++;
                  const isSelected = flatIndexCounter === selectedIndex;
                  const itemIndex = flatIndexCounter;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        if (item.onSelect) item.onSelect();
                        if (item.href && typeof window !== 'undefined') {
                          window.location.href = item.href;
                        }
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(itemIndex)}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs transition-colors cursor-pointer select-none',
                        isSelected
                          ? 'bg-info-bg text-info font-medium'
                          : 'text-text hover:bg-surface-subtle'
                      )}
                    >
                      <div>
                        <div className="font-medium">{item.title}</div>
                        {item.subtitle && (
                          <div className="text-[11px] text-muted">
                            {item.subtitle}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <span className="flex items-center gap-1 text-[10px] text-brand">
                          <span>Select</span>
                          <CornerDownLeft className="w-3 h-3" aria-hidden="true" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-surface-subtle text-[11px] text-muted">
          <span>Navigate with ↑ and ↓</span>
          <span>Press Enter to select</span>
        </div>
      </div>
    </div>
  );
}
