// 简化的提交结果组件
// 只显示成功/失败统计，不显示进度条和工单详情

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { WorkOrder, TaskProgressEvent } from '@/types';
import { CheckCircle, Loader2, BarChart3 } from 'lucide-react';

interface EnhancedSubmissionResultsProps {
  workOrders: WorkOrder[];
  submissionMode: 'direct' | 'batch';
  progressMessages: string[];
  currentTaskProgress: TaskProgressEvent | null;
  isSubmitting: boolean;
  showResults: boolean;
}

const EnhancedSubmissionResults: React.FC<EnhancedSubmissionResultsProps> = ({
  workOrders,
  submissionMode,
  progressMessages,
  currentTaskProgress,
  isSubmitting,
  showResults,
}) => {
  const totalWorkOrders = workOrders.length;
  const completedCount =
    submissionMode === 'direct'
      ? workOrders.filter((wo) => wo.status === 'success').length
      : currentTaskProgress?.completed_count || 0;
  const failedCount =
    submissionMode === 'direct'
      ? workOrders.filter((wo) => wo.status === 'failed').length
      : currentTaskProgress?.failed_count || 0;

  // 只在有工单且处理完成时显示
  if (!showResults || totalWorkOrders === 0 || isSubmitting) {
    return null;
  }

  return (
    <Card className="w-full max-w-4xl mx-auto shadow-sm hover:shadow-md transition-shadow">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <BarChart3 className="h-5 w-5" />
          <span>提交结果</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* 完成状态 */}
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <span className="text-green-700 font-medium">所有工单处理完成</span>
          </div>
          <p className="mt-1 text-sm text-green-600">
            成功: {completedCount} 个，失败: {failedCount} 个
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default EnhancedSubmissionResults;
