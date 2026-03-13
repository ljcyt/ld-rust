// 提交控制区域组件
// 从主页面中提取的提交控制功能

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { WorkOrder } from '@/types';

interface SubmitSectionProps {
  workOrders: WorkOrder[];
  isLoggedIn: boolean;
  isSubmitting: boolean;
  submissionMode: 'direct' | 'batch';
  setSubmissionMode: (mode: 'direct' | 'batch') => void;
  batchSize: number;
  setBatchSize: (size: number) => void;
  isMockEnabled: boolean;
  onToggleMock: (enabled: boolean) => void;
  onSubmitDirect: () => void;
  onSubmitBatch: () => void;
  onLogout: () => void;
}

/**
 * 提交控制区域组件
 * 提供提交模式选择和提交控制
 */
const SubmitSection: React.FC<SubmitSectionProps> = ({
  workOrders,
  isLoggedIn,
  isSubmitting,
  submissionMode,
  setSubmissionMode,
  batchSize,
  setBatchSize,
  isMockEnabled,
  onToggleMock,
  onSubmitDirect,
  onSubmitBatch,
  onLogout,
}) => {
  const hasWorkOrders = workOrders.length > 0;

  return (
    <div className="flex flex-col space-y-4 p-4 border rounded-lg shadow-sm bg-white">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">提交工单</h3>
        {isLoggedIn && (
          <Button variant="outline" onClick={onLogout} disabled={isSubmitting}>
            退出登录
          </Button>
        )}
      </div>

      {hasWorkOrders && (
        <>
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
            <div className="space-y-1">
              <p className="text-sm font-medium">模拟提交</p>
              <p className="text-xs text-muted-foreground">开启后不会真实提交到工单系统。</p>
            </div>
            <Switch
              checked={isMockEnabled}
              onCheckedChange={(checked) => onToggleMock(Boolean(checked))}
              disabled={isSubmitting}
            />
          </div>

          <RadioGroup
            value={submissionMode}
            onValueChange={(value: 'direct' | 'batch') => setSubmissionMode(value)}
            className="flex space-x-4"
            disabled={isSubmitting}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="direct" id="mode-direct" />
              <Label htmlFor="mode-direct">直接提交 (逐个)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="batch" id="mode-batch" />
              <Label htmlFor="mode-batch">批量提交 (后台任务)</Label>
            </div>
          </RadioGroup>

          {submissionMode === 'batch' && (
            <div className="flex items-center space-x-2">
              <Label htmlFor="batch-size">批次大小:</Label>
              <Input
                id="batch-size"
                type="number"
                value={batchSize}
                onChange={(e) => setBatchSize(Math.max(1, parseInt(e.target.value) || 1))}
                min="1"
                className="w-24"
                disabled={isSubmitting}
              />
            </div>
          )}

          <div className="flex space-x-4">
            <Button
              onClick={submissionMode === 'direct' ? onSubmitDirect : onSubmitBatch}
              disabled={isSubmitting || !hasWorkOrders}
              className="w-full"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submissionMode === 'direct' ? '开始直接提交' : '创建批量提交任务'}
            </Button>
          </div>
        </>
      )}
      {!hasWorkOrders && <p className="text-gray-500">请先上传并解析 Excel 文件。</p>}
    </div>
  );
};

export default SubmitSection;
