'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock } from '@/components/icons';
import { notify } from '@/lib/notifications';

interface ScheduleModalProps {
  open: boolean;
  onClose: () => void;
  scheduleFrequency: string;
  setScheduleFrequency: (v: string) => void;
  scheduleTime: string;
  setScheduleTime: (v: string) => void;
  scheduleRecipients: string;
  setScheduleRecipients: (v: string) => void;
  scheduleFormat: string;
  setScheduleFormat: (v: string) => void;
}

export function ScheduleModal({
  open, onClose,
  scheduleFrequency, setScheduleFrequency,
  scheduleTime, setScheduleTime,
  scheduleRecipients, setScheduleRecipients,
  scheduleFormat, setScheduleFormat,
}: ScheduleModalProps) {
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
            <h3 className="text-lg font-semibold text-white mb-4">Schedule Report</h3>

            <div className="space-y-4">
              <div>
                <Label>Frequency</Label>
                <Select value={scheduleFrequency} onValueChange={setScheduleFrequency}>
                  <SelectTrigger className="mt-1 bg-white/5 border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Time</Label>
                <Input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="mt-1 bg-white/5 border-white/10"
                />
              </div>

              <div>
                <Label>Recipients (comma-separated emails)</Label>
                <Input
                  value={scheduleRecipients}
                  onChange={(e) => setScheduleRecipients(e.target.value)}
                  placeholder="email1@example.com, email2@example.com"
                  className="mt-1 bg-white/5 border-white/10"
                />
              </div>

              <div>
                <Label>Format</Label>
                <Select value={scheduleFormat} onValueChange={setScheduleFormat}>
                  <SelectTrigger className="mt-1 bg-white/5 border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="csv">CSV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button
                onClick={() => {
                  onClose();
                  notify.success('Report scheduled successfully');
                }}
                className="flex-1 gradient-primary"
              >
                <Clock className="h-4 w-4 mr-2" />
                Schedule
              </Button>
              <Button
                variant="outline"
                onClick={onClose}
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
