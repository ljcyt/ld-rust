import { WorkOrder } from '@/types';

export interface TaskHistoryItem {
  id: string;
  createdAt: string;
  fileName: string;
  submissionMode: 'direct' | 'batch';
  totalCount: number;
  successCount: number;
  failedCount: number;
  isMock: boolean;
  workOrders: WorkOrder[];
}

const HISTORY_STORAGE_KEY = 'work_order_task_history_v1';
const MAX_HISTORY_ENTRIES = 200;

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

const safeParseJson = <T>(value: string | null, fallback: T): T => {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.warn('⚠️ 解析历史缓存失败:', error);
    return fallback;
  }
};

export const loadTaskHistory = (): TaskHistoryItem[] => {
  const storage = getStorage();
  if (!storage) {
    return [];
  }
  return safeParseJson<TaskHistoryItem[]>(storage.getItem(HISTORY_STORAGE_KEY), []);
};

export const appendTaskHistory = (item: TaskHistoryItem): TaskHistoryItem[] => {
  const storage = getStorage();
  const existing = storage
    ? safeParseJson<TaskHistoryItem[]>(storage.getItem(HISTORY_STORAGE_KEY), [])
    : [];
  const next = [item, ...existing].slice(0, MAX_HISTORY_ENTRIES);
  if (storage) {
    try {
      storage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      console.warn('⚠️ 写入历史缓存失败:', error);
    }
  }
  return next;
};

export const resetTaskHistory = (): void => {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  try {
    storage.removeItem(HISTORY_STORAGE_KEY);
  } catch (error) {
    console.warn('⚠️ 清理历史缓存失败:', error);
  }
};
