'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  X, 
  Move, 
  Settings, 
  Maximize2, 
  Minimize2,
  MoreVertical 
} from '@/components/icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface WidgetConfig {
  id: string;
  type: 'stats' | 'chart' | 'activity' | 'quick-actions' | 'calendar' | 'goals';
  title: string;
  size: 'small' | 'medium' | 'large' | 'full';
  position: { x: number; y: number };
  visible: boolean;
  data?: any;
}

interface DashboardWidgetProps {
  widget: WidgetConfig;
  onRemove: (id: string) => void;
  onResize: (id: string, size: WidgetConfig['size']) => void;
  onConfigure: (id: string) => void;
  isDragging?: boolean;
  children: React.ReactNode;
}

export function DashboardWidget({
  widget,
  onRemove,
  onResize,
  onConfigure,
  isDragging = false,
  children
}: DashboardWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const getSizeClasses = () => {
    switch (widget.size) {
      case 'small':
        return 'col-span-1 row-span-1';
      case 'medium':
        return 'col-span-2 row-span-1';
      case 'large':
        return 'col-span-2 row-span-2';
      case 'full':
        return 'col-span-4 row-span-2';
      default:
        return 'col-span-1 row-span-1';
    }
  };
  
  return (
    <Card
      variant="glass"
      className={`
        relative group transition-all duration-200
        ${getSizeClasses()}
        ${isDragging ? 'opacity-50 cursor-move' : 'hover:scale-[1.02]'}
        ${isExpanded ? 'z-50 fixed inset-4 !col-span-1 !row-span-1' : ''}
      `}
      data-widget-id={widget.id}
    >
      {/* Widget Controls */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-gray-400 hover:text-white"
            aria-label={isExpanded ? 'Minimise widget' : 'Maximise widget'}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-gray-400 hover:text-white"
                aria-label="Widget options"
              >
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-gray-900 border-gray-800">
              <DropdownMenuItem onClick={() => onConfigure(widget.id)}>
                <Settings className="mr-2 h-4 w-4" />
                Configure
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onResize(widget.id, 'small')}>
                Small
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onResize(widget.id, 'medium')}>
                Medium
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onResize(widget.id, 'large')}>
                Large
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onRemove(widget.id)}
                className="text-red-400"
              >
                <X className="mr-2 h-4 w-4" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* Drag Handle */}
      <div 
        className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-move"
        data-drag-handle
      >
        <Move className="h-4 w-4 text-gray-400" />
      </div>
      
      {/* Widget Content */}
      <div className={isExpanded ? 'h-full overflow-auto' : ''}>
        {children}
      </div>
    </Card>
  );
}

// Widget Library
export const widgetLibrary = [
  { id: 'stats', type: 'stats', title: 'Key Metrics', size: 'medium' },
  { id: 'engagement-chart', type: 'chart', title: 'Engagement Chart', size: 'large' },
  { id: 'activity-feed', type: 'activity', title: 'Recent Activity', size: 'medium' },
  { id: 'quick-actions', type: 'quick-actions', title: 'Quick Actions', size: 'small' },
  { id: 'calendar', type: 'calendar', title: 'Content Calendar', size: 'large' },
  { id: 'goals', type: 'goals', title: 'Goals & Milestones', size: 'medium' },
];

// Default dashboard layout
export const defaultDashboardLayout: WidgetConfig[] = [
  { id: '1', type: 'stats', title: 'Key Metrics', size: 'large', position: { x: 0, y: 0 }, visible: true },
  { id: '2', type: 'chart', title: 'Engagement Trends', size: 'large', position: { x: 2, y: 0 }, visible: true },
  { id: '3', type: 'activity', title: 'Recent Activity', size: 'medium', position: { x: 0, y: 1 }, visible: true },
  { id: '4', type: 'quick-actions', title: 'Quick Actions', size: 'small', position: { x: 2, y: 1 }, visible: true },
];