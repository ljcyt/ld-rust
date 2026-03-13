import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { TaskHistoryItem } from '@/lib/task-history-cache';

interface TaskHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: TaskHistoryItem[];
  onClear: () => void;
}

const TaskHistoryModal: React.FC<TaskHistoryModalProps> = ({
  open,
  onOpenChange,
  items,
  onClear,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>任务历史</DialogTitle>
          <DialogDescription>可展开查看每次提交的工单明细与故障描述。</DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto pr-2 max-h-[65vh] space-y-3">
          {items.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-12">
              暂无历史记录
            </div>
          ) : (
            <Accordion type="multiple" className="space-y-2">
              {items.map((item) => (
                <AccordionItem key={item.id} value={item.id} className="border rounded-lg px-3">
                  <AccordionTrigger className="py-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 w-full text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{item.fileName}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {item.submissionMode === 'direct' ? '直接提交' : '批量提交'}
                        </Badge>
                        {item.isMock && (
                          <Badge variant="outline" className="text-[10px]">
                            模拟
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(item.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-3">
                    <div className="flex flex-wrap gap-2 mb-3">
                      <Badge variant="outline">总数 {item.totalCount}</Badge>
                      <Badge variant="outline">成功 {item.successCount}</Badge>
                      <Badge variant="outline">失败 {item.failedCount}</Badge>
                    </div>
                    <div className="space-y-2">
                      {item.workOrders.map((wo, index) => (
                        <div key={`${item.id}-${index}`} className="border rounded-md p-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{wo.store_name}</span>
                            <span
                              className={`text-xs font-semibold ${
                                wo.status === 'success' ? 'text-green-600' : 'text-red-600'
                              }`}
                            >
                              {wo.status === 'success' ? '成功' : '失败'}
                            </span>
                          </div>
                          <div className="mt-1 text-muted-foreground">
                            故障描述：{wo.description || '-'}
                          </div>
                          {wo.error_message && (
                            <div className="mt-1 text-destructive">
                              错误：{wo.error_message}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClear} disabled={items.length === 0}>
            清空历史
          </Button>
          <Button onClick={() => onOpenChange(false)}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TaskHistoryModal;
