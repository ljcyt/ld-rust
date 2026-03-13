import { useState, useEffect, useCallback } from 'react';
import { WorkOrderStats } from '@/types';
import {
  appendStatsToCache,
  loadStatsFromCache,
  resetStatsCache,
  createInitialStats,
} from '@/lib/statistics-cache';

export const useStatistics = () => {
  const [stats, setStats] = useState<WorkOrderStats>(() => createInitialStats());
  const [isLoading, setIsLoading] = useState(true);

  // 从浏览器缓存加载统计数据
  const loadStats = useCallback(async () => {
    try {
      setIsLoading(true);
      const cachedStats = loadStatsFromCache();
      setStats(cachedStats);
    } catch (error) {
      console.error('加载统计数据失败:', error);
      setStats(createInitialStats());
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 更新统计数据
  const updateStats = useCallback(async (successCount: number, failedCount: number) => {
    try {
      const newStats = appendStatsToCache(successCount, failedCount);
      setStats(newStats);
    } catch (error) {
      console.error('更新统计数据失败:', error);
      setStats((prevStats) => ({
        ...prevStats,
        lastUpdated: new Date().toISOString(),
      }));
    }
  }, []);

  // 重置统计数据
  const resetStats = useCallback(async () => {
    try {
      const emptyStats = resetStatsCache();
      setStats(emptyStats);
    } catch (error) {
      console.error('重置统计数据失败:', error);
      setStats(createInitialStats());
    }
  }, []);

  // 获取今日统计
  const getTodayStats = useCallback(() => {
    return {
      processed: stats.todayProcessed,
      success: stats.todaySuccess,
      failed: stats.todayProcessed - stats.todaySuccess,
      successRate: stats.todayProcessed > 0 ? (stats.todaySuccess / stats.todayProcessed) * 100 : 0,
    };
  }, [stats]);

  // 获取本周统计
  const getThisWeekStats = useCallback(() => {
    return {
      processed: stats.thisWeekProcessed,
      success: stats.thisWeekSuccess,
      failed: stats.thisWeekProcessed - stats.thisWeekSuccess,
      successRate: stats.thisWeekProcessed > 0 ? (stats.thisWeekSuccess / stats.thisWeekProcessed) * 100 : 0,
    };
  }, [stats]);

  // 获取本月统计
  const getThisMonthStats = useCallback(() => {
    return {
      processed: stats.thisMonthProcessed,
      success: stats.thisMonthSuccess,
      failed: stats.thisMonthProcessed - stats.thisMonthSuccess,
      successRate: stats.thisMonthProcessed > 0 ? (stats.thisMonthSuccess / stats.thisMonthProcessed) * 100 : 0,
    };
  }, [stats]);

  // 初始化加载
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return {
    stats,
    isLoading,
    updateStats,
    resetStats,
    getTodayStats,
    getThisWeekStats,
    getThisMonthStats,
    refreshStats: loadStats,
  };
};
