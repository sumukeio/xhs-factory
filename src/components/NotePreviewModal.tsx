"use client";

import { useState, useEffect } from "react";
import { Note } from "@/types";
import { X, ChevronLeft, ChevronRight, Download, Check, Copy } from "lucide-react";
import { cn, getProxyImageUrl } from "@/lib/utils";

interface NotePreviewModalProps {
  note: Note | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload: (note: Note, selectedImageIndices: number[], includeText: boolean) => void;
}

export default function NotePreviewModal({
  note,
  isOpen,
  onClose,
  onDownload,
}: NotePreviewModalProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedImages, setSelectedImages] = useState<Set<number>>(new Set());
  const [includeText, setIncludeText] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    if (note && isOpen) {
      // 重置状态
      setCurrentImageIndex(0);
      setSelectedImages(new Set(note.images.map((_, i) => i))); // 默认全选
    }
  }, [note, isOpen]);

  if (!isOpen || !note) return null;

  const toggleImageSelection = (index: number) => {
    const newSelected = new Set(selectedImages);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedImages(newSelected);
  };

  const handleDownload = () => {
    onDownload(note, Array.from(selectedImages).sort((a, b) => a - b), includeText);
    onClose();
  };

  const handleCopyText = async () => {
    const text = [
      note.title,
      "",
      note.content,
      "",
      note.tags.length ? "标签: " + note.tags.join(", ") : "",
      note.url ? "来源链接: " + note.url : "",
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      alert("复制失败，请手动选择复制");
    }
  };

  const nextImage = () => {
    if (note.images.length > 0) {
      setCurrentImageIndex((prev) => (prev + 1) % note.images.length);
    }
  };

  const prevImage = () => {
    if (note.images.length > 0) {
      setCurrentImageIndex(
        (prev) => (prev - 1 + note.images.length) % note.images.length
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="relative w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-6xl sm:rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 p-3 sm:p-4 border-b bg-gray-50 flex-shrink-0">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 truncate flex-1 min-w-0">
            {note.title}
          </h2>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none shrink-0">
              <input
                type="checkbox"
                checked={includeText}
                onChange={(e) => setIncludeText(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="whitespace-nowrap">同时下载文本</span>
            </label>
            <button
              onClick={handleDownload}
              className="min-h-[44px] sm:min-h-0 inline-flex items-center gap-2 px-4 py-2.5 sm:py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors touch-manipulation"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span className="whitespace-nowrap">下载 ({selectedImages.size}/{note.images.length})</span>
            </button>
            <button
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-2 hover:bg-gray-200 active:bg-gray-300 rounded-lg transition-colors touch-manipulation flex items-center justify-center"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* 内容区：移动端上下布局，桌面端左右布局 */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0">
          {/* 左侧/上方：图片轮播 */}
          <div className="w-full md:w-1/2 h-[40vh] md:h-auto min-h-[200px] border-b md:border-b-0 md:border-r border-gray-200 bg-gray-100 relative flex items-center justify-center flex-shrink-0">
            {note.images.length > 0 ? (
              <>
                {/* 图片 */}
                <div className="relative w-full h-full flex items-center justify-center">
                  <img
                    src={getProxyImageUrl(note.images[currentImageIndex])}
                    alt={`${note.title} - 图片 ${currentImageIndex + 1}`}
                    className="max-w-full max-h-full object-contain"
                    onError={(e) => {
                      // 如果代理失败，尝试直接使用原URL
                      const target = e.target as HTMLImageElement;
                      if (target.src !== note.images[currentImageIndex]) {
                        target.src = note.images[currentImageIndex];
                      }
                    }}
                  />

                  {/* 左右箭头：移动端加大点击区域 */}
                  {note.images.length > 1 && (
                    <>
                      <button
                        onClick={prevImage}
                        className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-2 sm:p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center bg-white/90 hover:bg-white active:bg-gray-100 rounded-full shadow-lg transition-all touch-manipulation"
                      >
                        <ChevronLeft className="w-6 h-6 text-gray-700" />
                      </button>
                      <button
                        onClick={nextImage}
                        className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-2 sm:p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center bg-white/90 hover:bg-white active:bg-gray-100 rounded-full shadow-lg transition-all touch-manipulation"
                      >
                        <ChevronRight className="w-6 h-6 text-gray-700" />
                      </button>
                    </>
                  )}

                  {/* 图片索引指示器 */}
                  {note.images.length > 1 && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                      {note.images.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentImageIndex(idx)}
                          className={cn(
                            "w-2 h-2 rounded-full transition-all",
                            idx === currentImageIndex
                              ? "bg-blue-600 w-6"
                              : "bg-white/60 hover:bg-white/80"
                          )}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* 图片选择区域（底部缩略图）：移动端略大便于点击 */}
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-2 sm:p-4">
                  <div className="flex gap-2 overflow-x-auto pb-safe">
                    {note.images.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentImageIndex(idx)}
                        className={cn(
                          "relative flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 transition-all touch-manipulation",
                          idx === currentImageIndex
                            ? "border-blue-600 scale-105"
                            : "border-transparent hover:border-gray-400 active:border-gray-500"
                        )}
                      >
                        <img
                          src={getProxyImageUrl(img)}
                          alt={`缩略图 ${idx + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // 如果代理失败，尝试直接使用原URL
                            const target = e.target as HTMLImageElement;
                            if (target.src !== img) {
                              target.src = img;
                            }
                          }}
                        />
                        {/* 选中标记 */}
                        <div
                          className={cn(
                            "absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center transition-all",
                            selectedImages.has(idx)
                              ? "bg-blue-600"
                              : "bg-white/60"
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleImageSelection(idx);
                          }}
                        >
                          {selectedImages.has(idx) && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-gray-400">暂无图片</div>
            )}
          </div>

          {/* 右侧/下方：文字内容 */}
          <div className="w-full md:w-1/2 overflow-y-auto p-4 sm:p-6 flex-1 min-h-0">
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {note.title}
                </h3>
                {note.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {note.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="prose prose-sm max-w-none">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-sm font-medium text-gray-500">正文</span>
                  <button
                    type="button"
                    onClick={handleCopyText}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                      copySuccess
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    )}
                  >
                    <Copy className="w-4 h-4" />
                    {copySuccess ? "已复制" : "一键复制"}
                  </button>
                </div>
                <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                  {note.content}
                </div>
              </div>

              <div className="pt-4 border-t text-xs text-gray-500">
                <p>来源链接：</p>
                <a
                  href={note.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline break-all"
                >
                  {note.url}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
