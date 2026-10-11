'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/client/components/ui/dialog';

export interface DetailModalProps<T = Record<string, unknown>> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  data: T | null;
  renderContent?: (data: T) => React.ReactNode;
}

export function DetailModal<T = Record<string, unknown>>({
  open,
  onOpenChange,
  title,
  data,
  renderContent,
}: DetailModalProps<T>) {
  if (!data) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {renderContent ? (
            renderContent(data)
          ) : (
            <div className="grid gap-4">
              {Object.entries(data as Record<string, unknown>).map(([key, value]) => (
                <div key={key} className="grid grid-cols-3 gap-4">
                  <div className="text-muted-foreground font-medium capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </div>
                  <div className="col-span-2">
                    {typeof value === 'boolean'
                      ? value
                        ? 'Yes'
                        : 'No'
                      : typeof value === 'object' && value !== null
                        ? JSON.stringify(value)
                        : String(value)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
