// 任务历史组件
// 从主页面中提取的任务历史功能

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Task } from '@/types';
import { Loader2 } from 'lucide-react';

interface TaskHistoryProps {
  tasks: Task[];
  onCancelTask: (taskId: string) => void;
  isCancelling: { [key: string]: boolean };
}

/**
 * 任务历史组件
 * 显示历史任务列表和状态
 */
const TaskHistory: React.FC<TaskHistoryProps> = ({ tasks, onCancelTask, isCancelling }) => {
  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>任务历史</CardTitle>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="text-gray-500 text-center">暂无任务历史。</p>
        ) : (
          <ScrollArea className="h-[300px] w-full rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>任务ID</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>进度</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium text-xs">{task.id.substring(0, 8)}...</TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          task.status === 'Completed'
                            ? 'bg-green-100 text-green-800'
                            : task.status === 'Failed'
                            ? 'bg-red-100 text-red-800'
                            : task.status === 'InProgress'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {task.status}
                      </span>
                    </TableCell>
                    <TableCell>{task.completed_count}/{task.total_count}</TableCell>
                    <TableCell className="text-xs">{new Date(task.created_at).toLocaleString()}</TableCell>
                    <TableCell>
                      {task.status === 'InProgress' || task.status === 'Pending' ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => onCancelTask(task.id)}
                          disabled={isCancelling[task.id]}
                        >
                          {isCancelling[task.id] && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          取消
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" disabled>
                          查看详情
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default TaskHistory;