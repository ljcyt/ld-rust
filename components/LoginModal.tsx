// 登录模态框组件
// 从主页面中提取的登录功能

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (username: string, password: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLogin, isLoading, error }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberPassword, setRememberPassword] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  // 从localStorage加载保存的账号密码
  useEffect(() => {
    if (isOpen) {
      const savedUsername = localStorage.getItem('saved_username');
      const savedPassword = localStorage.getItem('saved_password');
      const savedRemember = localStorage.getItem('remember_password');
      
      if (savedUsername) setUsername(savedUsername);
      if (savedPassword && savedRemember === 'true') {
        setPassword(savedPassword);
        setRememberPassword(true);
      }
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    // 验证输入
    if (!username.trim() || !password.trim()) {
      return;
    }
    
    // 保存或清除账号密码
    if (rememberPassword) {
      localStorage.setItem('saved_username', username);
      localStorage.setItem('saved_password', password);
      localStorage.setItem('remember_password', 'true');
    } else {
      localStorage.removeItem('saved_username');
      localStorage.removeItem('saved_password');
      localStorage.removeItem('remember_password');
    }
    
    await onLogin(username, password);
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // 处理用户名输入框的回车键
  const handleUsernameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      e.preventDefault();
      // 如果用户名不为空，聚焦到密码输入框
      if (username.trim()) {
        passwordRef.current?.focus();
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px] rounded-[var(--radius)]">
        <DialogHeader className="space-y-2 pb-2">
          <DialogTitle className="text-2xl font-bold tracking-tight">欢迎回来</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            请输入您的凭据以访问工单系统
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4" onKeyDown={handleKeyDown}>
          <div className="space-y-2">
            <Label htmlFor="username" className="text-sm font-semibold">
              用户名
            </Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={handleUsernameKeyDown}
              className="rounded-[var(--radius)] border-border/50 focus:ring-primary/20"
              disabled={isLoading}
              placeholder="您的用户名"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-semibold">
              密码
            </Label>
            <Input
              ref={passwordRef}
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              className="rounded-[var(--radius)] border-border/50 focus:ring-primary/20"
              disabled={isLoading}
              placeholder="您的登录密码"
            />
          </div>
          <div className="flex items-center space-x-2 pt-1">
            <Checkbox
              id="remember"
              checked={rememberPassword}
              onCheckedChange={(checked) => setRememberPassword(checked as boolean)}
              disabled={isLoading}
              className="rounded-sm"
            />
            <Label htmlFor="remember" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              记住登录信息
            </Label>
          </div>
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-[var(--radius)]">
              <p className="text-destructive text-xs text-center font-medium">{error}</p>
            </div>
          )}
        </div>
        <DialogFooter className="pt-2">
          <Button onClick={onClose} variant="ghost" disabled={isLoading} className="flex-1">
            取消
          </Button>
          <Button type="submit" onClick={handleSubmit} disabled={isLoading} className="flex-1 shadow-sm shadow-primary/20">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "立即登录"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LoginModal;
