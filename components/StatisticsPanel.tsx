import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  BarChart3, 
  Calendar,
  FileText
} from 'lucide-react';
import { WorkOrderStats } from '@/types';

interface StatisticsPanelProps {
  stats: WorkOrderStats;
  onReset?: () => void;
}

const StatisticsPanel: React.FC<StatisticsPanelProps> = ({ stats, onReset }) => {
  // 计算成功率颜色
  const getSuccessRateColor = (rate: number) => {
    if (rate >= 90) return 'text-green-600';
    if (rate >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="w-full h-full flex items-start justify-center">
      <div className="w-full">
        {/* 简化的统计卡片 - 移除多余的宽度限制以实现对齐 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* 总体处理统计 */}
          <Card className="bg-card border-border hover:shadow-md transition-all duration-300 rounded-[var(--radius)]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2.5">
                  <div className="p-1.5 bg-primary/10 rounded-lg">
                    <BarChart3 className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-sm font-semibold text-foreground">总体累计</span>
                </div>
                {onReset && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onReset}
                    className="h-7 px-2 text-[11px]"
                  >
                    清理缓存
                  </Button>
                )}
              </div>
              <div className="space-y-3">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">处理总数</p>
                    <p className="text-2xl font-bold tracking-tight text-foreground">{stats.totalProcessed}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">成功率</p>
                    <p className={`text-lg font-bold ${getSuccessRateColor(stats.successRate)}`}>
                      {stats.successRate.toFixed(1)}%
                    </p>
                  </div>
                </div>
                <Progress 
                  value={stats.successRate} 
                  className="h-1.5 bg-muted"
                />
              </div>
            </CardContent>
          </Card>

          {/* 本月处理统计 */}
          <Card className="bg-card border-border hover:shadow-md transition-all duration-300 rounded-[var(--radius)]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2.5">
                  <div className="p-1.5 bg-accent/10 rounded-lg">
                    <Calendar className="h-4 w-4 text-accent-foreground" />
                  </div>
                  <span className="text-sm font-semibold text-foreground">本月概览</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">月度总量</p>
                    <p className="text-2xl font-bold tracking-tight text-foreground">{stats.thisMonthProcessed}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">月度成功</p>
                    <p className="text-lg font-bold text-green-600">{stats.thisMonthSuccess}</p>
                  </div>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-500"
                    style={{ 
                      width: `${stats.thisMonthProcessed > 0 
                        ? (stats.thisMonthSuccess / stats.thisMonthProcessed) * 100 
                        : 0}%` 
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 底部提示信息 */}
        <div className="text-center">
          <div className="inline-flex items-center space-x-2 px-4 py-2 bg-muted/50 rounded-full border border-border/50">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">上传 Excel 文件即可开始自动化录单</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatisticsPanel;
