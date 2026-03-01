'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BarChart3, Table, TrendingUp, Type, Image as ImageIcon, Layout, Move, Settings, Trash2,
} from '@/components/icons';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ReportWidget } from './types';

interface SortableWidgetProps {
  widget: ReportWidget;
  onEdit: (widget: ReportWidget) => void;
  onDelete: (id: string) => void;
}

function getWidgetIcon(type: string) {
  switch (type) {
    case 'chart': return <BarChart3 className="h-4 w-4" />;
    case 'table': return <Table className="h-4 w-4" />;
    case 'metric': return <TrendingUp className="h-4 w-4" />;
    case 'text': return <Type className="h-4 w-4" />;
    case 'image': return <ImageIcon className="h-4 w-4" />;
    default: return <Layout className="h-4 w-4" />;
  }
}

function getSizeClass(size: string) {
  switch (size) {
    case 'small': return 'col-span-1';
    case 'medium': return 'col-span-2';
    case 'large': return 'col-span-3';
    case 'full': return 'col-span-4';
    default: return 'col-span-2';
  }
}

export function SortableWidget({ widget, onEdit, onDelete }: SortableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${getSizeClass(widget.size)}`}
    >
      <Card variant="glass" className={`${!widget.visible ? 'opacity-50' : ''}`}>
        <CardHeader className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div {...attributes} {...listeners} className="cursor-move">
                <Move className="h-4 w-4 text-gray-400" />
              </div>
              {getWidgetIcon(widget.type)}
              <span className="font-medium text-white">{widget.title}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => onEdit(widget)}>
                <Settings className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onDelete(widget.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="h-32 bg-white/5 rounded flex items-center justify-center">
            <span className="text-gray-400">
              {widget.type === 'chart' && 'Chart Preview'}
              {widget.type === 'table' && 'Table Preview'}
              {widget.type === 'metric' && (
                <div className="text-center">
                  <p className="text-3xl font-bold text-white">1,234</p>
                  <p className="text-sm text-gray-400">Sample Metric</p>
                </div>
              )}
              {widget.type === 'text' && 'Text Content'}
              {widget.type === 'image' && 'Image Placeholder'}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
