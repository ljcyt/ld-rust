import { WorkOrderStats } from '@/types';

/**
 * 统计日志条目结构
 * 仅在浏览器本地缓存中使用
 */
interface StatsLogEntry {
  timestamp: string;
  successCount: number;
  failedCount: number;
}

const LOG_STORAGE_KEY = 'work_order_stats_log_v2';
const SUMMARY_STORAGE_KEY = 'work_order_stats_summary_v2';
const MAX_LOG_ENTRIES = 1000;

const getStorage = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage;
  } catch (error) {
    console.warn('⚠️ 无法访问 localStorage:', error);
    return null;
  }
};

const buildEmptyStats = (): WorkOrderStats => ({
  totalProcessed: 0,
  totalSuccess: 0,
  totalFailed: 0,
  successRate: 0,
  todayProcessed: 0,
  todaySuccess: 0,
  thisWeekProcessed: 0,
  thisWeekSuccess: 0,
  thisMonthProcessed: 0,
  thisMonthSuccess: 0,
  lastUpdated: new Date().toISOString(),
});

const safeParseJson = <T>(value: string | null): T | null => {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.warn('⚠️ 解析缓存数据失败:', error);
    return null;
  }
};

const persistSummary = (storage: Storage | null, summary: WorkOrderStats) => {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(SUMMARY_STORAGE_KEY, JSON.stringify(summary));
  } catch (error) {
    console.warn('⚠️ 写入统计总结失败:', error);
  }
};

const pruneEntries = (entries: StatsLogEntry[]): StatsLogEntry[] => {
  if (entries.length <= MAX_LOG_ENTRIES) {
    return entries;
  }
  return entries.slice(entries.length - MAX_LOG_ENTRIES);
};

const computeStatsFromEntries = (entries: StatsLogEntry[]): WorkOrderStats => {
  if (!entries.length) {
    return buildEmptyStats();
  }

  let totalSuccess = 0;
  let totalFailed = 0;
  let todaySuccess = 0;
  let todayFailed = 0;
  let weekSuccess = 0;
  let weekFailed = 0;
  let monthSuccess = 0;
  let monthFailed = 0;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  const dayOfWeek = startOfWeek.getDay();
  const diffToMonday = (dayOfWeek + 6) % 7;
  startOfWeek.setDate(startOfWeek.getDate() - diffToMonday);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  entries.forEach((entry) => {
    const entryDate = new Date(entry.timestamp);
    if (Number.isNaN(entryDate.getTime())) {
      return;
    }

    totalSuccess += entry.successCount;
    totalFailed += entry.failedCount;

    if (entryDate >= startOfToday) {
      todaySuccess += entry.successCount;
      todayFailed += entry.failedCount;
    }

    if (entryDate >= startOfWeek) {
      weekSuccess += entry.successCount;
      weekFailed += entry.failedCount;
    }

    if (entryDate >= startOfMonth) {
      monthSuccess += entry.successCount;
      monthFailed += entry.failedCount;
    }
  });

  const totalProcessed = totalSuccess + totalFailed;
  const successRate = totalProcessed > 0
    ? Number(((totalSuccess / totalProcessed) * 100).toFixed(2))
    : 0;

  return {
    totalProcessed,
    totalSuccess,
    totalFailed,
    successRate,
    todayProcessed: todaySuccess + todayFailed,
    todaySuccess,
    thisWeekProcessed: weekSuccess + weekFailed,
    thisWeekSuccess: weekSuccess,
    thisMonthProcessed: monthSuccess + monthFailed,
    thisMonthSuccess: monthSuccess,
    lastUpdated: now.toISOString(),
  };
};

export const loadStatsFromCache = (): WorkOrderStats => {
  const storage = getStorage();
  if (!storage) {
    return buildEmptyStats();
  }

  const cachedSummary = safeParseJson<WorkOrderStats>(storage.getItem(SUMMARY_STORAGE_KEY));
  if (cachedSummary) {
    return {
      ...cachedSummary,
      lastUpdated: new Date().toISOString(),
    };
  }

  const entries = safeParseJson<StatsLogEntry[]>(storage.getItem(LOG_STORAGE_KEY)) || [];
  const summary = computeStatsFromEntries(entries);
  persistSummary(storage, summary);
  return summary;
};

export const appendStatsToCache = (successCount: number, failedCount: number): WorkOrderStats => {
  const storage = getStorage();

  if (!storage) {
    const entries: StatsLogEntry[] = successCount === 0 && failedCount === 0
      ? []
      : [{ timestamp: new Date().toISOString(), successCount, failedCount }];
    return computeStatsFromEntries(entries);
  }

  if (successCount === 0 && failedCount === 0) {
    const summary = loadStatsFromCache();
    const updatedSummary = {
      ...summary,
      lastUpdated: new Date().toISOString(),
    };
    persistSummary(storage, updatedSummary);
    return updatedSummary;
  }

  const existingEntries = safeParseJson<StatsLogEntry[]>(storage.getItem(LOG_STORAGE_KEY)) || [];
  existingEntries.push({
    timestamp: new Date().toISOString(),
    successCount,
    failedCount,
  });

  const prunedEntries = pruneEntries(existingEntries);

  try {
    storage.setItem(LOG_STORAGE_KEY, JSON.stringify(prunedEntries));
  } catch (error) {
    console.warn('⚠️ 写入统计日志失败:', error);
  }

  const summary = computeStatsFromEntries(prunedEntries);
  persistSummary(storage, summary);
  return summary;
};

export const resetStatsCache = (): WorkOrderStats => {
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(LOG_STORAGE_KEY);
      storage.removeItem(SUMMARY_STORAGE_KEY);
    } catch (error) {
      console.warn('⚠️ 清理统计缓存失败:', error);
    }
  }
  return buildEmptyStats();
};

export const createInitialStats = buildEmptyStats;
