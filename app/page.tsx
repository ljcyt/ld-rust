"use client"

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TauriApiClient } from '@/lib/tauri-api';
import { WorkOrder, UserCredentials, TaskProgressEvent, ExcelWorkOrder, SubmissionResult } from '@/types';
import { parseExcelFile, validateFile } from '@/lib/excel-parser';
import { processDirectSubmit, processBatchSubmitBackground, calculateEstimatedTime, calculateDirectEstimatedTime } from '@/lib/work-order-processor';

// 导入组件
import FileUploadArea from '@/components/FileUploadArea';
import LoginModal from '@/components/LoginModal';
import SubmitSection from '@/components/SubmitSection';
import EnhancedSubmissionResults from '@/components/EnhancedSubmissionResults';
import EnhancedProgressBar from '@/components/EnhancedProgressBar';
import StatisticsPanel from '@/components/StatisticsPanel';
import TaskHistory from '@/components/TaskHistory';
import TaskHistoryModal from '@/components/TaskHistoryModal';
import { useStatistics } from '@/hooks/use-statistics';
import { Upload, BarChart3, User, LogOut } from 'lucide-react';
import { appendTaskHistory, loadTaskHistory, resetTaskHistory, TaskHistoryItem } from '@/lib/task-history-cache';

export default function Home() {
  const isMockSubmitEnabled = (): boolean => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('mock_submit_enabled') === '1';
    }
    return typeof process !== 'undefined'
      && process.env
      && process.env.NEXT_PUBLIC_MOCK_SUBMIT === '1';
  };

  // 统计数据
  const { stats, isLoading: statsLoading, updateStats, resetStats } = useStatistics();
  
  // 状态管理
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [excelWorkOrders, setExcelWorkOrders] = useState<ExcelWorkOrder[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [credentials, setCredentials] = useState<UserCredentials | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // 提交相关状态
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionMode, setSubmissionMode] = useState<'direct' | 'batch'>('direct');
  const [batchSize, setBatchSize] = useState(5);
  const [progressMessages, setProgressMessages] = useState<string[]>([]);
  const [currentTaskProgress, setCurrentTaskProgress] = useState<TaskProgressEvent | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [isCancelling, setIsCancelling] = useState<{ [key: string]: boolean }>({});
  const [showFlowModal, setShowFlowModal] = useState(false);
  const [isMockSubmit, setIsMockSubmit] = useState(false);
  const [hasSubmissionResult, setHasSubmissionResult] = useState(false);
  const [isBatchCancelling, setIsBatchCancelling] = useState(false);
  const cancelBatchRef = useRef(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [taskHistoryItems, setTaskHistoryItems] = useState<TaskHistoryItem[]>([]);
  
  // 倒计时状态
  const [countdown, setCountdown] = useState<{ remaining: number; message: string } | null>(null);
  
  // 进度状态
  const [batchProgress, setBatchProgress] = useState<{
    currentBatch: number;
    totalBatches: number;
    completedOrders: number;
    totalOrders: number;
    estimatedTime: number;
  } | null>(null);
  const flowScrollRef = useRef<HTMLDivElement>(null);
  const progressSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isSubmitting) {
      setShowFlowModal(true);
    }
  }, [isSubmitting]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsMockSubmit(window.localStorage.getItem('mock_submit_enabled') === '1');
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setTaskHistoryItems(loadTaskHistory());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const preventDefault = (event: DragEvent) => {
      event.preventDefault();
    };
    window.addEventListener('dragover', preventDefault);
    window.addEventListener('drop', preventDefault);
    return () => {
      window.removeEventListener('dragover', preventDefault);
      window.removeEventListener('drop', preventDefault);
    };
  }, []);

  // 检查登录状态
  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const user = await TauriApiClient.getCurrentUser();
        if (user) {
          setCredentials(user);
          setIsLoggedIn(true);
        }
      } catch (error) {
        console.log('No user logged in');
      }
    };
    checkLoginStatus();
  }, []);

  // 文件处理
  const handleFileSelected = async (file: File) => {
    const error = validateFile(file);
    if (error) {
      setFileError(error);
      return;
    }

    setFileError(null);
    setSelectedFile(file);

    try {
      const parsedOrders = await parseExcelFile(file);
      setExcelWorkOrders(parsedOrders);

      const initialWorkOrders: WorkOrder[] = parsedOrders.map((order) => ({
        ...order,
        status: 'pending' as const,
        error_message: undefined,
      }));
      setWorkOrders(initialWorkOrders);
      setProgressMessages([]);
      setCurrentTaskProgress(null);
      setHasSubmissionResult(false);
      
      setShowFlowModal(true);
    } catch (error: any) {
      setFileError(error.message || '解析文件失败');
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFileError(null);
    setWorkOrders([]);
    setExcelWorkOrders([]);
    setProgressMessages([]);
    setCurrentTaskProgress(null);
    setHasSubmissionResult(false);
    setIsBatchCancelling(false);
    cancelBatchRef.current = false;
    setShowFlowModal(false);
    setShowLoginModal(false);
  };

  // 登录处理
  const handleLogin = async (username: string, password: string) => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      let user: UserCredentials;
      if (isMockSubmitEnabled()) {
        user = {
          token: 'mock-token',
          company_id: 'mock-company',
          user_id: 'mock-user',
          username: username,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        };
      } else {
        const response = await TauriApiClient.login(username, password);
        user = {
          token: response.token,
          company_id: response.company_id,
          user_id: response.user_id,
          username: username,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        };
      }
      setCredentials(user);
      setIsLoggedIn(true);
      setShowLoginModal(false);
      
      console.log('登录成功，准备执行提交...', { user, submissionMode });
      
      // 登录成功后自动执行提交
      setTimeout(() => {
        console.log('开始执行自动提交...');
        handleSubmitAfterLogin(password, user);
      }, 500);
    } catch (error: any) {
      setLoginError(error.message || '登录失败');
      setShowFlowModal(true);
      throw error;
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await TauriApiClient.logout();
      setCredentials(null);
      setIsLoggedIn(false);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const scrollToProgressInModal = () => {
    if (!flowScrollRef.current || !progressSectionRef.current) {
      return;
    }
    const container = flowScrollRef.current;
    const target = progressSectionRef.current;
    const offset = target.offsetTop - container.offsetTop;
    container.scrollTo({
      top: Math.max(0, offset - 8),
      behavior: 'smooth',
    });
  };

  // 提交处理 - 每次都需要登录
  const handleSubmit = async (mode: 'direct' | 'batch') => {
    if (!selectedFile) return;

    // 每次提交都需要登录，弹出登录模态框
    setShowLoginModal(true);
    setShowFlowModal(false);
    
    // 保存提交模式，登录成功后使用
    setSubmissionMode(mode);
  };

  // 登录成功后的提交处理
  const handleSubmitAfterLogin = async (password: string, userCredentials: UserCredentials) => {
    if (!selectedFile) {
      console.log('没有选中的文件，无法提交');
      return;
    }

    console.log('开始执行提交...', { submissionMode, workOrders: workOrders.length, userCredentials });
    setShowFlowModal(true);
    setIsSubmitting(true);
    setProgressMessages([]);
    setHasSubmissionResult(false);
    setIsBatchCancelling(false);
    cancelBatchRef.current = false;
    
    // 使用useEffect确保DOM更新后再滚动
    setTimeout(() => {
      scrollToProgressInModal();
    }, 100);

    try {
      let ordersToProcess = excelWorkOrders.length > 0 ? excelWorkOrders : [];

      if (ordersToProcess.length === 0) {
        ordersToProcess = await parseExcelFile(selectedFile);
        setExcelWorkOrders(ordersToProcess);
      }

      if (ordersToProcess.length === 0) {
        setProgressMessages(['没有可处理的工单']);
        return;
      }

      setWorkOrders(ordersToProcess.map((order) => ({
        ...order,
        status: 'pending' as const,
        error_message: undefined,
      })));

      const results: SubmissionResult[] = [];
      
      console.log('解析Excel数据完成，开始提交...', ordersToProcess.length);

      if (submissionMode === 'direct') {
        console.log('使用直接提交模式');
        
        // 计算预计时间
        const estimatedTime = calculateDirectEstimatedTime(ordersToProcess.length);
        setBatchProgress({
          currentBatch: 1,
          totalBatches: 1,
          completedOrders: 0,
          totalOrders: ordersToProcess.length,
          estimatedTime
        });
        
        await processDirectSubmit(ordersToProcess, userCredentials, password, results,
          (remaining, message) => {
            setCountdown({ remaining, message });
          },
          (completedOrders, totalOrders) => {
            setBatchProgress(prev => prev ? {
              ...prev,
              completedOrders,
              totalOrders
            } : null);
          }
        );
      } else {
        console.log('使用批量提交模式');
        const taskId = `task-${Date.now()}`;
        
        // 计算预计时间
        const estimatedTime = calculateEstimatedTime(ordersToProcess.length, batchSize, 30, 70);
        setBatchProgress({
          currentBatch: 0,
          totalBatches: Math.ceil(ordersToProcess.length / batchSize),
          completedOrders: 0,
          totalOrders: ordersToProcess.length,
          estimatedTime
        });
        
        await processBatchSubmitBackground(ordersToProcess, userCredentials, password, taskId, batchSize, results, 
          (remaining, message) => {
            setCountdown({ remaining, message });
          },
          (currentBatch, totalBatches, completedOrders, totalOrders) => {
            setBatchProgress(prev => prev ? {
              ...prev,
              currentBatch,
              totalBatches,
              completedOrders,
              totalOrders
            } : null);
          },
          () => cancelBatchRef.current
        );
      }
      
      console.log('提交完成，更新工单状态...', results);
      
      // 更新工单状态
      const updatedWorkOrders: WorkOrder[] = ordersToProcess.map((order, index) => {
        const result = results[index];
        return {
          ...order,
          status: (result?.status === 'success' ? 'success' : 'failed') as 'success' | 'failed',
          error_message: result?.error || undefined,
        };
      });
      setWorkOrders(updatedWorkOrders);

      // 更新统计数据
      const successCount = results.filter(r => r.status === 'success').length;
      const failedCount = ordersToProcess.length - successCount;
      await updateStats(successCount, failedCount);

      setProgressMessages(ordersToProcess.map((order, index) => {
        const result = results[index];
        return `${order.store_name}: ${result?.status === 'success' ? '成功' : '失败'}`;
      }));
      setHasSubmissionResult(true);

      const historyItem: TaskHistoryItem = {
        id: `history-${Date.now()}`,
        createdAt: new Date().toISOString(),
        fileName: selectedFile?.name || 'unknown',
        submissionMode,
        totalCount: results.length,
        successCount,
        failedCount,
        isMock: isMockSubmit,
        workOrders: updatedWorkOrders,
      };
      setTaskHistoryItems(appendTaskHistory(historyItem));
    } catch (error: any) {
      console.error('提交失败:', error);
      setProgressMessages([`提交失败: ${error.message}`]);
      setHasSubmissionResult(true);
    } finally {
      setIsSubmitting(false);
      setCountdown(null);
      setBatchProgress(null);
      setIsBatchCancelling(false);
    }
  };

  // 取消任务
  const handleCancelTask = async (taskId: string) => {
    setIsCancelling(prev => ({ ...prev, [taskId]: true }));
    try {
      await TauriApiClient.cancelTask(taskId);
      // 刷新任务列表
      const updatedTasks = await TauriApiClient.getTasks();
      setTasks(updatedTasks);
    } catch (error) {
      console.error('取消任务失败:', error);
    } finally {
      setIsCancelling(prev => ({ ...prev, [taskId]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-background/50">
      {/* 主要内容区域 - 进一步优化布局，使其更紧凑 */}
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        {/* 使用flex布局，让统计面板占满剩余空间 */}
        <div className={`flex flex-col ${!selectedFile ? 'h-[calc(100vh-3.5rem)] min-h-[550px]' : 'min-h-screen'} space-y-4`}>
          
          {/* 文件上传区域 - 固定高度 */}
          <Card className="w-full shadow-sm hover:shadow-md transition-all duration-300 border-border/50 bg-card/50 backdrop-blur-sm flex-shrink-0 rounded-[var(--radius)]">
            <CardHeader className="pb-3 pt-4 px-5">
              <CardTitle className="flex items-center justify-between text-base">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 bg-primary/10 rounded-lg">
                    <Upload className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-bold tracking-tight">导入工单</span>
                </div>
                
                {/* 用户信息和退出按钮 */}
                {isLoggedIn && credentials ? (
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-secondary rounded-full border border-border/50">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-[11px] font-medium">{credentials.username}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleLogout}
                      className="h-7 px-2 text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                    >
                      <LogOut className="h-3 w-3 mr-1" />
                      <span>退出</span>
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="text-[11px] font-medium text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full">
                      准备就绪
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => setShowHistoryModal(true)}
                    >
                      任务历史
                    </Button>
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-4 px-5">
              <FileUploadArea
                onFileSelected={handleFileSelected}
                selectedFile={selectedFile}
                fileError={fileError}
                onRemoveFile={handleRemoveFile}
              />
              
              {/* 工单预览 */}
              {workOrders.length > 0 && (
                <div className="mt-4 p-3 bg-muted/30 rounded-[var(--radius)] border border-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold">待处理工单 ({workOrders.length})</h4>
                    <Badge variant="outline" className="text-[9px] h-4 uppercase tracking-wider">PREVIEW</Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-32 overflow-y-auto pr-1">
                    {workOrders.slice(0, 10).map((order, index) => (
                      <div key={index} className="flex items-center space-x-2 text-[11px] p-1.5 bg-background/50 rounded-md border border-border/30">
                        <span className="text-muted-foreground font-mono">{String(index + 1).padStart(2, '0')}</span>
                        <span className="flex-1 font-medium truncate">{order.store_name}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => setShowFlowModal(true)}
                      disabled={isSubmitting}
                      className="h-8 shadow-sm hover:shadow-md transition-all active:scale-95 text-xs"
                    >
                      配置并开始提交
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 弹窗：提交方式 + 进度 + 结果 */}
          <Dialog
            open={showFlowModal}
            onOpenChange={(open) => {
              if (isSubmitting && !open) return;
              setShowFlowModal(open);
            }}
          >
            <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col overflow-hidden rounded-[var(--radius)]">
              <DialogHeader className="pb-2 flex-shrink-0">
                <DialogTitle className="text-base font-bold">工单处理</DialogTitle>
                <DialogDescription className="text-[11px]">
                  {isSubmitting ? '正在处理，请稍候...' : '选择提交方式并查看处理结果。'}
                </DialogDescription>
              </DialogHeader>
              <div
                ref={flowScrollRef}
                className="space-y-4 overflow-y-auto pr-2 flex-grow max-h-[60vh]"
              >
                <div className="rounded-xl border border-border/50 p-4 bg-muted/20">
                  <SubmitSection
                    workOrders={workOrders}
                    isLoggedIn={isLoggedIn}
                    isSubmitting={isSubmitting}
                    submissionMode={submissionMode}
                    setSubmissionMode={setSubmissionMode}
                    batchSize={batchSize}
                    setBatchSize={setBatchSize}
                    isMockEnabled={isMockSubmit}
                    onToggleMock={(enabled) => {
                      setIsMockSubmit(enabled);
                      if (typeof window !== 'undefined') {
                        window.localStorage.setItem('mock_submit_enabled', enabled ? '1' : '0');
                      }
                    }}
                    onSubmitDirect={() => handleSubmit('direct')}
                    onSubmitBatch={() => handleSubmit('batch')}
                    onLogout={handleLogout}
                  />
                </div>

                <div ref={progressSectionRef}>
                  <EnhancedProgressBar
                    batchProgress={batchProgress}
                    countdown={countdown}
                    isSubmitting={isSubmitting}
                  />
                </div>

                <EnhancedSubmissionResults
                  workOrders={workOrders}
                  submissionMode={submissionMode}
                  progressMessages={progressMessages}
                  currentTaskProgress={currentTaskProgress}
                  isSubmitting={isSubmitting}
                  showResults={hasSubmissionResult}
                />
              </div>
              {isSubmitting && submissionMode === 'batch' && (
                <DialogFooter>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setIsBatchCancelling(true);
                      cancelBatchRef.current = true;
                    }}
                    disabled={isBatchCancelling}
                  >
                    {isBatchCancelling ? '正在终止...' : '终止批量提交'}
                  </Button>
                </DialogFooter>
              )}
              {!isSubmitting && (
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowFlowModal(false)}>
                    关闭
                  </Button>
                </DialogFooter>
              )}
            </DialogContent>
          </Dialog>

          {/* 任务历史 */}
          {tasks.length > 0 && (
            <Card className="w-full shadow-sm hover:shadow-md transition-shadow flex-shrink-0">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center space-x-2 text-base">
                  <BarChart3 className="h-4 w-4" />
                  <span>任务历史</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <TaskHistory
                  tasks={tasks}
                  onCancelTask={handleCancelTask}
                  isCancelling={isCancelling}
                />
              </CardContent>
            </Card>
          )}

          {/* 统计信息面板 - 只在未选择文件时显示，占满剩余空间 */}
          {!selectedFile && (
            <div className="flex-1 w-full">
              <StatisticsPanel stats={stats} onReset={resetStats} />
            </div>
          )}
        </div>
      </div>

      {/* 登录模态框 */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => {
          setShowLoginModal(false);
          setLoginError(null);
          if (workOrders.length > 0 && !isSubmitting) {
            setShowFlowModal(true);
          }
        }}
        onLogin={handleLogin}
        isLoading={isLoggingIn}
        error={loginError}
      />

      <TaskHistoryModal
        open={showHistoryModal}
        onOpenChange={setShowHistoryModal}
        items={taskHistoryItems}
        onClear={() => {
          resetTaskHistory();
          setTaskHistoryItems([]);
        }}
      />
    </div>
  );
}
