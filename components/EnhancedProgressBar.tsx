import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle, Circle, Loader2 } from 'lucide-react';

interface BatchProgress {
  currentBatch: number;
  totalBatches: number;
  completedOrders: number;
  totalOrders: number;
  estimatedTime: number;
}

interface Countdown {
  remaining: number;
  message: string;
}

interface EnhancedProgressBarProps {
  batchProgress: BatchProgress | null;
  countdown: Countdown | null;
  isSubmitting: boolean;
}

const EnhancedProgressBar: React.FC<EnhancedProgressBarProps> = ({
  batchProgress,
  countdown,
  isSubmitting
}) => {
  if (!batchProgress && !countdown && !isSubmitting) {
    return null;
  }

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}分${remainingSeconds}秒`;
    }
    return `${remainingSeconds}秒`;
  };

  const getProgressPercentage = (): number => {
    if (!batchProgress) return 0;
    return Math.round((batchProgress.completedOrders / batchProgress.totalOrders) * 100);
  };

  const getBatchProgressPercentage = (): number => {
    if (!batchProgress) return 0;
    const currentBatchOrders = Math.min(batchProgress.batchSize || 5, 
      batchProgress.totalOrders - (batchProgress.currentBatch - 1) * (batchProgress.batchSize || 5));
    const completedInBatch = batchProgress.completedOrders - (batchProgress.currentBatch - 1) * (batchProgress.batchSize || 5);
    return Math.round((completedInBatch / currentBatchOrders) * 100);
  };

  return (
    <Card className="w-full shadow-sm border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2 text-blue-700 text-base">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>
            {batchProgress?.totalBatches === 1 ? '直接提交进度' : '批量提交进度'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {/* 预计时间显示 */}
        {batchProgress && (
          <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-200">
            <div className="flex items-center space-x-2">
              <Clock className="h-3 w-3 text-blue-500" />
              <span className="text-xs font-medium text-gray-700">预计总时间</span>
            </div>
            <Badge variant="outline" className="text-blue-600 border-blue-300 text-xs px-2 py-1">
              {formatTime(batchProgress.estimatedTime)}
            </Badge>
          </div>
        )}

        {/* 批次进度 */}
        {batchProgress && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-700">
                {batchProgress.totalBatches === 1 ? '提交进度' : '批次进度'}
              </span>
              <span className="text-xs text-gray-500">
                {batchProgress.totalBatches === 1 
                  ? '直接提交模式' 
                  : `第 ${batchProgress.currentBatch} / ${batchProgress.totalBatches} 批次`
                }
              </span>
            </div>
            
            {/* 批次指示器 - 只在多批次时显示 */}
            {batchProgress.totalBatches > 1 && (
              <div className="flex space-x-1">
                {Array.from({ length: batchProgress.totalBatches }, (_, index) => {
                  const batchNumber = index + 1;
                  const isCompleted = batchNumber < batchProgress.currentBatch;
                  const isCurrent = batchNumber === batchProgress.currentBatch;
                  const isPending = batchNumber > batchProgress.currentBatch;
                  
                  return (
                    <div
                      key={batchNumber}
                      className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${
                        isCompleted 
                          ? 'bg-green-500' 
                          : isCurrent 
                          ? 'bg-blue-500' 
                          : 'bg-gray-200'
                      }`}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 总体进度 */}
        {batchProgress && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-700">总体进度</span>
              <span className="text-xs text-gray-500">
                {batchProgress.completedOrders} / {batchProgress.totalOrders} 工单
              </span>
            </div>
            <Progress value={getProgressPercentage()} className="h-2" />
            <div className="text-center text-sm font-medium text-blue-600">
              {getProgressPercentage()}%
            </div>
          </div>
        )}

        {/* 倒计时显示 */}
        {(countdown || isSubmitting) && (
          <div className="flex items-center justify-between gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
              <span className="text-orange-700 font-medium text-xs">等待中</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xl font-bold text-orange-600">{countdown ? countdown.remaining : 0}</span>
              <span className="text-xs text-orange-500">秒</span>
            </div>
            <div className="flex-1 min-w-0 text-orange-600 text-xs truncate">
              {countdown ? countdown.message : '等待中...'}
            </div>
          </div>
        )}

        {/* 状态指示器 */}
        <div className="flex items-center justify-center space-x-4 text-xs">
          <div className="flex items-center space-x-1">
            <CheckCircle className="h-3 w-3 text-green-500" />
            <span className="text-gray-600">已完成</span>
          </div>
          <div className="flex items-center space-x-1">
            <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />
            <span className="text-gray-600">处理中</span>
          </div>
          <div className="flex items-center space-x-1">
            <Circle className="h-3 w-3 text-gray-400" />
            <span className="text-gray-600">等待中</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default EnhancedProgressBar;
