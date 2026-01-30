"use client";

import { useState, useEffect } from "react";
import { FolderOpen, ChevronLeft, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface FolderPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  currentPath?: string;
}

interface FolderItem {
  name: string;
  path: string;
  is_directory: boolean;
}

interface BrowseResponse {
  current_path: string;
  items: FolderItem[];
  parent_path: string | null;
}

export default function FolderPicker({
  isOpen,
  onClose,
  onSelect,
  currentPath,
}: FolderPickerProps) {
  const [currentDir, setCurrentDir] = useState<string>("");
  const [items, setItems] = useState<FolderItem[]>([]);
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string>("");

  // 浏览文件夹
  const browseFolder = async (path?: string, setAsSelected: boolean = false) => {
    setIsLoading(true);
    setError(null);
    try {
      // 使用 Next.js API 路由代理请求，避免 CORS 问题
      const res = await fetch("/api/browse-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });

      const data: any = await res.json();

      if (!res.ok) {
        throw new Error(
          data?.detail ||
            data?.message ||
            (typeof data === "string" ? data : JSON.stringify(data))
        );
      }

      setCurrentDir(data.current_path);
      setItems(data.items || []);
      setParentPath(data.parent_path ?? null);
      // 如果设置了setAsSelected，或者当前没有选中路径，则选中当前文件夹
      if (setAsSelected || !selectedPath) {
        setSelectedPath(data.current_path);
      }
    } catch (err: any) {
      console.error("浏览文件夹失败:", err);
      setError(err.message || "浏览文件夹失败");
    } finally {
      setIsLoading(false);
    }
  };

  // 打开对话框时初始化
  useEffect(() => {
    if (isOpen) {
      // 重置选中路径
      setSelectedPath("");
      // 浏览到指定路径或默认路径，并设置为选中
      browseFolder(currentPath, true);
    }
  }, [isOpen, currentPath]);

  // 进入子文件夹
  const enterFolder = (item: FolderItem) => {
    if (item.is_directory) {
      browseFolder(item.path);
    }
  };

  // 选择文件夹（点击选中，双击进入）
  const selectFolder = (item: FolderItem) => {
    setSelectedPath(item.path);
  };

  // 返回上一级
  const goUp = () => {
    if (parentPath) {
      browseFolder(parentPath);
    }
  };

  // 确认选择
  const handleConfirm = () => {
    if (selectedPath) {
      onSelect(selectedPath);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">选择保存文件夹</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* 当前路径 */}
        <div className="px-4 py-2 bg-gray-50 border-b">
          <div className="flex items-center gap-2">
            {parentPath && (
              <button
                onClick={goUp}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
                title="返回上一级"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
            )}
            <div className="flex-1 text-sm text-gray-600 truncate">
              {currentDir}
            </div>
          </div>
        </div>

        {/* 文件夹列表 */}
        <div className="flex-1 overflow-y-auto p-4">
          {error ? (
            <div className="text-center py-8 text-red-600">{error}</div>
          ) : isLoading ? (
            <div className="text-center py-8 text-gray-400">加载中...</div>
          ) : (
            <div className="space-y-1">
              {/* 当前文件夹选项 */}
              {currentDir && (
                <div
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer border-2",
                    selectedPath === currentDir
                      ? "bg-blue-50 border-blue-300"
                      : "border-transparent"
                  )}
                  onClick={() => setSelectedPath(currentDir)}
                >
                  <FolderOpen className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <span className="flex-1 text-sm text-gray-900 font-medium">
                    📁 当前文件夹（{currentDir.split(/[/\\]/).pop() || currentDir}）
                  </span>
                  {selectedPath === currentDir && (
                    <Check className="w-4 h-4 text-blue-600" />
                  )}
                </div>
              )}
              
              {/* 子文件夹列表 */}
              {items.length === 0 ? (
                <div className="text-center py-4 text-gray-400 text-sm">
                  当前文件夹下没有子文件夹
                </div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.path}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer",
                      selectedPath === item.path && "bg-blue-50 border border-blue-200"
                    )}
                    onClick={() => selectFolder(item)}
                    onDoubleClick={() => enterFolder(item)}
                  >
                    <FolderOpen className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <span className="flex-1 text-sm text-gray-900">{item.name}</span>
                    {selectedPath === item.path && (
                      <Check className="w-4 h-4 text-blue-600" />
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* 底部操作 */}
        <div className="px-4 py-3 border-t bg-gray-50 flex items-center justify-between">
          <div className="flex-1 text-xs text-gray-500">
            已选择：{selectedPath}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedPath}
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              确认选择
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
