'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ReportWidget } from './types';
import { METRIC_DATA_SOURCES } from './types';

interface WidgetModalProps {
  open: boolean;
  onClose: () => void;
  editingWidget: ReportWidget | null;
  widgetType: string;
  setWidgetType: (v: string) => void;
  widgetTitle: string;
  setWidgetTitle: (v: string) => void;
  widgetDataSource: string;
  setWidgetDataSource: (v: string) => void;
  widgetSize: string;
  setWidgetSize: (v: string) => void;
  onAdd: () => void;
  onUpdate: () => void;
  onResetForm: () => void;
}

export function WidgetModal({
  open, onClose, editingWidget,
  widgetType, setWidgetType, widgetTitle, setWidgetTitle,
  widgetDataSource, setWidgetDataSource, widgetSize, setWidgetSize,
  onAdd, onUpdate, onResetForm,
}: WidgetModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4"
          >
            <h3 className="text-lg font-semibold text-white mb-4">
              {editingWidget ? 'Edit Widget' : 'Add Widget'}
            </h3>

            <div className="space-y-4">
              <div>
                <Label>Widget Type</Label>
                <Select value={widgetType} onValueChange={setWidgetType}>
                  <SelectTrigger className="mt-1 bg-white/5 border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chart">Chart</SelectItem>
                    <SelectItem value="table">Table</SelectItem>
                    <SelectItem value="metric">Metric</SelectItem>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="image">Image</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Title</Label>
                <Input
                  value={widgetTitle}
                  onChange={(e) => setWidgetTitle(e.target.value)}
                  placeholder="Widget title..."
                  className="mt-1 bg-white/5 border-white/10"
                />
              </div>

              <div>
                <Label>Data Source</Label>
                <Select value={widgetDataSource} onValueChange={setWidgetDataSource}>
                  <SelectTrigger className="mt-1 bg-white/5 border-white/10">
                    <SelectValue placeholder="Select data source" />
                  </SelectTrigger>
                  <SelectContent>
                    {METRIC_DATA_SOURCES.map(source => (
                      <SelectItem key={source.id} value={source.id}>
                        {source.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Size</Label>
                <Select value={widgetSize} onValueChange={setWidgetSize}>
                  <SelectTrigger className="mt-1 bg-white/5 border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small (1 column)</SelectItem>
                    <SelectItem value="medium">Medium (2 columns)</SelectItem>
                    <SelectItem value="large">Large (3 columns)</SelectItem>
                    <SelectItem value="full">Full Width (4 columns)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button
                onClick={editingWidget ? onUpdate : onAdd}
                className="flex-1 gradient-primary"
              >
                {editingWidget ? 'Update' : 'Add'} Widget
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  onClose();
                  onResetForm();
                }}
                className="flex-1 bg-white/5 border-white/10"
              >
                Cancel
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
