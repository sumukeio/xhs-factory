"use client";

import { useState, useEffect } from "react";
import { Note } from "@/types";
import { X, ChevronLeft, ChevronRight, Download, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface NotePreviewModalProps {
  note: Note | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload: (note: Note, selectedImageIndices: number[]) => void;
}

export default function NotePreviewModal({
  note,
  isOpen,
  onClose,
  onDownload,
}: NotePreviewModalProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedImages, setSelectedImages] = useState<Set<number>>(new Set());

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
    onDownload(note, Array.from(selectedImages).sort((a, b) => a - b));
    onClose();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-6xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900 truncate flex-1">
            {note.title}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              下载 ({selectedImages.size}/{note.images.length})
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-hidden flex">
          {/* 左侧：图片轮播 */}
          <div className="w-1/2 border-r bg-gray-100 relative flex items-center justify-center">
            {note.images.length > 0 ? (
              <>
                {/* 图片 */}
                <div className="relative w-full h-full flex items-center justify-center">
                  <img
                    src={note.images[currentImageIndex]}
                    alt={`${note.title} - 图片 ${currentImageIndex + 1}`}
                    className="max-w-full max-h-full object-contain"
                  />

                  {/* 左右箭头（桌面端） */}
                  {note.images.length > 1 && (
                    <>
                      <button
                        onClick={prevImage}
                        className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/90 hover:bg-white rounded-full shadow-lg transition-all"
                      >
                        <ChevronLeft className="w-6 h-6 text-gray-700" />
                      </button>
                      <button
                        onClick={nextImage}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/90 hover:bg-white rounded-full shadow-lg transition-all"
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

                {/* 图片选择区域（底部缩略图） */}
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-4">
                  <div className="flex gap-2 overflow-x-auto">
                    {note.images.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setCurrentImageIndex(idx);
                        }}
                        className={cn(
                          "relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all",
                          idx === currentImageIndex
                            ? "border-blue-600 scale-105"
                            : "border-transparent hover:border-gray-400"
                        )}
                      >
                        <img
                          src={img}
                          alt={`缩略图 ${idx + 1}`}
                          className="w-full h-full object-cover"
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

          {/* 右侧：文字内容 */}
          <div className="w-1/2 overflow-y-auto p-6">
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
