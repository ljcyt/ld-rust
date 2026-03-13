// 文件上传区域组件
// 从主页面中提取的文件上传功能

import React, { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileTextIcon, UploadIcon, XCircleIcon } from 'lucide-react';
import { validateFile } from '@/lib/excel-parser';

interface FileUploadAreaProps {
  onFileSelected: (file: File) => void;
  selectedFile: File | null;
  fileError: string | null;
  onRemoveFile: () => void;
}

const FileUploadArea: React.FC<FileUploadAreaProps> = ({
  onFileSelected,
  selectedFile,
  fileError,
  onRemoveFile,
}) => {
  const [isDragActive, setIsDragActive] = useState(false);

  const extractDroppedFiles = (dataTransfer: DataTransfer): File[] => {
    if (dataTransfer.files && dataTransfer.files.length > 0) {
      return Array.from(dataTransfer.files);
    }

    if (dataTransfer.items && dataTransfer.items.length > 0) {
      return Array.from(dataTransfer.items)
        .filter((item) => item.kind === 'file')
        .map((item) => item.getAsFile())
        .filter((file): file is File => Boolean(file));
    }

    return [];
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const files = extractDroppedFiles(e.dataTransfer);
    if (files.length > 0) {
      onFileSelected(files[0]);
    }
  }, [onFileSelected]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      onFileSelected(event.target.files[0]);
    }
  };

  const handleClick = () => {
    if (!selectedFile) {
      document.getElementById('file-upload')?.click();
    }
  };

  return (
    <div className="w-full">
      <div
        onDragEnterCapture={handleDragEnter}
        onDragOverCapture={handleDragOver}
        onDropCapture={handleDrop}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-[var(--radius)] cursor-pointer transition-all duration-300 min-h-[160px] ${
          isDragActive
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : fileError
            ? 'border-destructive bg-destructive/5'
            : 'border-muted hover:border-primary/50 hover:bg-muted/30'
        }`}
      >
        {selectedFile ? (
          <div className="flex flex-col items-center justify-center space-y-3 text-primary">
            <div className="p-3 bg-primary/10 rounded-full">
              <FileTextIcon className="h-6 w-6" />
            </div>
            <div className="text-center space-y-0.5">
              <p className="font-semibold text-base">文件就绪</p>
              <p className="text-xs text-muted-foreground">{selectedFile.name}</p>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={(e) => { e.stopPropagation(); onRemoveFile(); }} 
              className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10 text-xs"
            >
              <XCircleIcon className="h-3.5 w-3.5 mr-1.5" />
              重新上传
            </Button>
          </div>
        ) : isDragActive ? (
          <div className="flex flex-col items-center justify-center space-y-3 text-primary">
            <div className="p-3 bg-primary/10 rounded-full animate-pulse">
              <UploadIcon className="h-6 w-6" />
            </div>
            <p className="font-semibold text-base">松开即刻上传</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="p-3 bg-muted rounded-full">
              <UploadIcon className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="text-center space-y-3">
              <div className="space-y-0.5">
                <p className="font-medium text-base">点击或拖拽文件至此</p>
                <p className="text-xs text-muted-foreground">支持 .xlsx 和 .xls 格式</p>
              </div>
              <div className="flex justify-center">
                <Label htmlFor="file-upload" className="cursor-pointer inline-flex">
                  <Button asChild variant="secondary" size="sm" className="px-6 h-8 text-xs" onClick={(e) => e.stopPropagation()}>
                    <span>选择文件</span>
                  </Button>
                  <Input
                    id="file-upload"
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                    accept=".xlsx,.xls"
                  />
                </Label>
              </div>
            </div>
          </div>
        )}
      </div>
      {fileError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{fileError}</p>
        </div>
      )}
    </div>
  );
};

export default FileUploadArea;
