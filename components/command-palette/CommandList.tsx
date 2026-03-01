'use client';

import { ArrowRight } from '@/components/icons';
import type { CommandItem } from './types';

interface CommandListProps {
  groupedCommands: Record<string, CommandItem[]>;
  filteredCommands: CommandItem[];
  selectedIndex: number;
  search: string;
  onSelect: (cmd: CommandItem) => void;
  listRef: React.Ref<HTMLDivElement>;
}

export function CommandList({
  groupedCommands,
  filteredCommands,
  selectedIndex,
  search,
  onSelect,
  listRef,
}: CommandListProps) {
  return (
    <div ref={listRef} className="max-h-96 overflow-y-auto p-2">
      {Object.entries(groupedCommands).map(([category, items]) => (
        <div key={category} className="mb-4">
          <div className="px-2 py-1 text-xs text-gray-500 uppercase">
            {category}
          </div>
          {items.map((cmd) => {
            const Icon = cmd.icon;
            const isSelected = filteredCommands.indexOf(cmd) === selectedIndex;

            return (
              <button
                key={cmd.id}
                onClick={() => onSelect(cmd)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left
                  transition-colors duration-150
                  ${isSelected
                    ? 'bg-cyan-500/20 text-white'
                    : 'text-gray-300 hover:bg-white/5 hover:text-white'
                  }
                `}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{cmd.title}</div>
                  {cmd.description && (
                    <div className="text-xs text-gray-500 truncate">
                      {cmd.description}
                    </div>
                  )}
                </div>
                {isSelected && (
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                )}
              </button>
            );
          })}
        </div>
      ))}

      {filteredCommands.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No commands found for &quot;{search}&quot;
        </div>
      )}
    </div>
  );
}
