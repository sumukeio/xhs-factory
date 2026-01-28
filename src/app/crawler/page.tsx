"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Note, ParseRequest } from "@/types";
import {
  Loader2,
  Link as LinkIcon,
  CheckSquare,
  Square,
  Download,
  Trash2,
  RotateCcw,
  X,
  MoreVertical,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import NotePreviewModal from "@/components/NotePreviewModal";
import FolderPicker from "@/components/FolderPicker";

const STORAGE_KEY_NOTES = "xhs_crawler_notes";
const STORAGE_KEY_TRASH = "xhs_crawler_trash";
const STORAGE_KEY_DEFAULT_DIR = "xhs_crawler_default_dir";
const DISPLAY_LIMIT = 20; // 预览区默认最多显示20个

export default function CrawlerPage() {
  const [urlInput, setUrlInput] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [trash, setTrash] = useState<Note[]>([]);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [previewNote, setPreviewNote] = useState<Note | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [baseDir, setBaseDir] = useState("backend/downloads");
  const [useDefaultDir, setUseDefaultDir] = useState(false);
  const [activeTab, setActiveTab] = useState<"main" | "trash">("main");
  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastValueRef = useRef<string>("");

  // 从localStorage加载数据
  useEffect(() => {
    const savedNotes = localStorage.getItem(STORAGE_KEY_NOTES);
    const savedTrash = localStorage.getItem(STORAGE_KEY_TRASH);
    const savedDefaultDir = localStorage.getItem(STORAGE_KEY_DEFAULT_DIR);
    
    if (savedNotes) {
      try {
        setNotes(JSON.parse(savedNotes));
      } catch (e) {
        console.error("加载笔记失败:", e);
      }
    }
    if (savedTrash) {
      try {
        setTrash(JSON.parse(savedTrash));
      } catch (e) {
        console.error("加载回收站失败:", e);
      }
    }
    if (savedDefaultDir) {
      setBaseDir(savedDefaultDir);
      setUseDefaultDir(true);
    }
  }, []);

  // 保存到localStorage
  const saveNotes = useCallback((newNotes: Note[]) => {
    setNotes(newNotes);
    localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(newNotes));
  }, []);

  const saveTrash = useCallback((newTrash: Note[]) => {
    setTrash(newTrash);
    localStorage.setItem(STORAGE_KEY_TRASH, JSON.stringify(newTrash));
  }, []);

  // 处理文件夹选择
  const handleSelectFolder = () => {
    setIsFolderPickerOpen(true);
  };

  // 文件夹选择回调
  const handleFolderSelected = (path: string) => {
    setBaseDir(path);
  };

  // 处理"设为默认"复选框变化
  const handleUseDefaultDirChange = (checked: boolean) => {
    setUseDefaultDir(checked);
    if (checked) {
      // 保存为默认文件夹
      localStorage.setItem(STORAGE_KEY_DEFAULT_DIR, baseDir);
    } else {
      // 清除默认文件夹
      localStorage.removeItem(STORAGE_KEY_DEFAULT_DIR);
    }
  };

  // 当baseDir变化时，如果已勾选"设为默认"，则更新localStorage
  useEffect(() => {
    if (useDefaultDir && baseDir) {
      localStorage.setItem(STORAGE_KEY_DEFAULT_DIR, baseDir);
    }
  }, [baseDir, useDefaultDir]);

  // 提取链接（从粘贴内容中自动提取）
  const extractUrls = (text: string): string[] => {
    const urlRegex =
      /https?:\/\/(www\.)?(xiaohongshu\.com|xhslink\.com)\/[^\s]+/gi;
    const matches = text.match(urlRegex);
    return matches ? [...new Set(matches)] : [];
  };

  // 处理粘贴事件（支持 Ctrl+V 和右键粘贴）
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData("text");
    if (!pastedText) return;

    const urls = extractUrls(pastedText);
    if (urls.length > 0) {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentText = urlInput;
      
      // 如果当前文本不为空且光标位置不在末尾，则添加换行
      const separator = 
        currentText && 
        start > 0 && 
        !currentText.substring(0, start).endsWith("\n") 
          ? "\n" 
          : "";
      
      // 构建新文本：光标前的内容 + 分隔符 + 提取的链接 + 光标后的内容
      const newText = 
        currentText.substring(0, start) + 
        separator + 
        urls.join("\n") + 
        (separator && currentText.substring(end) ? "\n" : "") +
        currentText.substring(end);
      
      setUrlInput(newText);
      lastValueRef.current = newText;
      
      // 设置光标位置到插入内容之后
      setTimeout(() => {
        const newPosition = start + separator.length + urls.join("\n").length;
        textarea.setSelectionRange(newPosition, newPosition);
        textarea.focus();
      }, 0);
    }
  };

  // 监听输入变化，检测可能的右键粘贴（作为备用处理）
  useEffect(() => {
    lastValueRef.current = urlInput;
  }, [urlInput]);

  // 处理输入变化（处理右键粘贴后的情况）
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const oldValue = lastValueRef.current;
    
    // 如果内容突然大幅增加（可能是粘贴操作），尝试智能处理
    if (newValue.length > oldValue.length + 30) {
      const newUrls = extractUrls(newValue);
      const oldUrls = extractUrls(oldValue);
      
      // 如果检测到新链接，且是粘贴操作（内容大幅增加）
      if (newUrls.length > oldUrls.length) {
        // 检查是否包含非链接内容（说明是直接粘贴的原始文本）
        const pastedContent = newValue.substring(oldValue.length);
        const hasNonUrlContent = pastedContent
          .split("\n")
          .some(line => {
            const trimmed = line.trim();
            return trimmed && !extractUrls(trimmed).length;
          });
        
        // 如果包含非链接内容，说明用户粘贴了包含链接的文本
        // 自动提取链接并格式化（仅在包含非链接内容时处理）
        if (hasNonUrlContent && newUrls.length > 0) {
          const textarea = e.target;
          const start = textarea.selectionStart;
          const beforeCursor = newValue.substring(0, start);
          const afterCursor = newValue.substring(start);
          
          // 提取所有链接
          const allUrls = extractUrls(newValue);
          const existingUrls = extractUrls(oldValue);
          const newUniqueUrls = allUrls.filter(url => !existingUrls.includes(url));
          
          if (newUniqueUrls.length > 0) {
            // 找到光标前最后一个换行符的位置
            const lastNewlineIndex = beforeCursor.lastIndexOf("\n");
            const beforeLastLine = beforeCursor.substring(0, lastNewlineIndex + 1);
            const lastLine = beforeCursor.substring(lastNewlineIndex + 1);
            
            // 构建新文本：保留光标前的完整行，添加新链接，保留光标后的内容
            const separator = beforeLastLine && !beforeLastLine.endsWith("\n") ? "\n" : "";
            const newText = 
              beforeLastLine + 
              separator + 
              newUniqueUrls.join("\n") + 
              (afterCursor && !afterCursor.startsWith("\n") ? "\n" : "") +
              afterCursor;
            
            setUrlInput(newText);
            lastValueRef.current = newText;
            
            // 设置光标位置
            setTimeout(() => {
              const newPosition = beforeLastLine.length + 
                                  separator.length + 
                                  newUniqueUrls.join("\n").length;
              textarea.setSelectionRange(newPosition, newPosition);
              textarea.focus();
            }, 0);
            return;
          }
        }
      }
    }
    
    setUrlInput(newValue);
    lastValueRef.current = newValue;
  };

  // 批量解析
  const handleParse = async () => {
    const urls = extractUrls(urlInput)
      .map((url) => url.trim())
      .filter((url) => url.length > 0);

    if (urls.length === 0) {
      alert("请粘贴至少一个小红书笔记链接！");
      return;
    }

    setIsParsing(true);
    try {
      const res = await fetch("/api/batch-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls } as ParseRequest),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.message || "解析失败");
      }

      // 转换数据格式并添加时间戳
      const newNotes: Note[] = data.notes.map((n: any) => ({
        ...n,
        createdAt: Date.now(),
        isDeleted: false,
      }));

      // 合并到现有笔记（去重）
      const existingIds = new Set(notes.map((n) => n.id));
      const uniqueNewNotes = newNotes.filter((n: Note) => !existingIds.has(n.id));
      const updatedNotes = [...notes, ...uniqueNewNotes];

      saveNotes(updatedNotes);
      setUrlInput(""); // 清空输入框

      if (data.failed && data.failed.length > 0) {
        alert(
          `解析完成：成功 ${data.notes.length} 个，失败 ${data.failed.length} 个`
        );
      } else {
        alert(`成功解析 ${data.notes.length} 个笔记！`);
      }
    } catch (err: any) {
      console.error(err);
      alert("解析失败：" + err.message);
    } finally {
      setIsParsing(false);
    }
  };

  // 下载笔记（选择性下载）
  const handleDownload = async (
    note: Note,
    selectedImageIndices: number[]
  ) => {
    try {
      const BACKEND_BASE =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

      const res = await fetch(`${BACKEND_BASE}/api/selective_download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note_data: {
            title: note.title,
            content: note.content,
            tags: note.tags,
            images: note.images,
            origin_url: note.url,
          },
          selected_image_indices:
            selectedImageIndices.length === note.images.length
              ? null
              : selectedImageIndices,
          base_dir: baseDir || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.detail || data?.message || "下载失败");
      }

      alert(`✅ 下载成功！已保存到：${data.folder}`);
    } catch (err: any) {
      console.error(err);
      alert("下载失败：" + err.message);
    }
  };

  // 批量下载
  const handleBatchDownload = async () => {
    if (selectedNoteIds.size === 0) {
      alert("请先选择要下载的笔记！");
      return;
    }

    const selectedNotes = notes.filter((n) => selectedNoteIds.has(n.id));
    let successCount = 0;
    let failCount = 0;

    for (const note of selectedNotes) {
      try {
        await handleDownload(note, note.images.map((_, i) => i)); // 下载全部图片
        successCount++;
      } catch (e) {
        failCount++;
      }
    }

    alert(`批量下载完成：成功 ${successCount} 个，失败 ${failCount} 个`);
    setSelectedNoteIds(new Set());
    setIsBatchMode(false);
  };

  // 批量删除（移到回收站）
  const handleBatchDelete = () => {
    if (selectedNoteIds.size === 0) {
      alert("请先选择要删除的笔记！");
      return;
    }

    if (!confirm(`确定要删除选中的 ${selectedNoteIds.size} 个笔记吗？`)) {
      return;
    }

    const selectedNotes = notes.filter((n) => selectedNoteIds.has(n.id));
    const remainingNotes = notes.filter((n) => !selectedNoteIds.has(n.id));

    // 标记为已删除并移到回收站
    const deletedNotes = selectedNotes.map((n) => ({
      ...n,
      isDeleted: true,
    }));

    saveNotes(remainingNotes);
    saveTrash([...trash, ...deletedNotes]);
    setSelectedNoteIds(new Set());
    setIsBatchMode(false);
  };

  // 批量恢复
  const handleBatchRestore = () => {
    if (selectedNoteIds.size === 0) {
      alert("请先选择要恢复的笔记！");
      return;
    }

    const selectedNotes = trash.filter((n) => selectedNoteIds.has(n.id));
    const remainingTrash = trash.filter((n) => !selectedNoteIds.has(n.id));

    const restoredNotes = selectedNotes.map((n) => ({
      ...n,
      isDeleted: false,
    }));

    saveNotes([...notes, ...restoredNotes]);
    saveTrash(remainingTrash);
    setSelectedNoteIds(new Set());
    setIsBatchMode(false);
  };

  // 批量永久删除
  const handleBatchPermanentDelete = () => {
    if (selectedNoteIds.size === 0) {
      alert("请先选择要删除的笔记！");
      return;
    }

    if (
      !confirm(
        `确定要永久删除选中的 ${selectedNoteIds.size} 个笔记吗？删除后不可恢复！`
      )
    ) {
      return;
    }

    const remainingTrash = trash.filter((n) => !selectedNoteIds.has(n.id));
    saveTrash(remainingTrash);
    setSelectedNoteIds(new Set());
    setIsBatchMode(false);
  };

  // 切换选中状态
  const toggleNoteSelection = (noteId: string) => {
    const newSelected = new Set(selectedNoteIds);
    if (newSelected.has(noteId)) {
      newSelected.delete(noteId);
    } else {
      newSelected.add(noteId);
    }
    setSelectedNoteIds(newSelected);
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    const currentNotes = activeTab === "main" ? notes : trash;
    if (selectedNoteIds.size === currentNotes.length) {
      setSelectedNoteIds(new Set());
    } else {
      setSelectedNoteIds(new Set(currentNotes.map((n) => n.id)));
    }
  };

  const displayNotes = activeTab === "main" ? notes : trash;
  const visibleNotes = showMore
    ? displayNotes
    : displayNotes.slice(0, DISPLAY_LIMIT);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">
              小红书笔记爬取工具
            </h1>
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab("main")}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  activeTab === "main"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                )}
              >
                工作台
              </button>
              <button
                onClick={() => setActiveTab("trash")}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors relative",
                  activeTab === "trash"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                )}
              >
                回收站
                {trash.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {trash.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === "main" ? (
          <>
            {/* === 解析区 === */}
            <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                链接解析
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    小红书笔记链接（支持批量，每行一个或粘贴包含链接的文本）
                  </label>
                  <textarea
                    ref={textareaRef}
                    value={urlInput}
                    onChange={handleInputChange}
                    onPaste={handlePaste}
                    placeholder="粘贴小红书笔记链接，支持多个链接（每行一个）或包含链接的文本...&#10;支持 Ctrl+V 或右键粘贴"
                    rows={6}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono text-sm"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleParse}
                    disabled={isParsing}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isParsing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        解析中...
                      </>
                    ) : (
                      <>
                        <LinkIcon className="w-4 h-4" />
                        开始解析
                      </>
                    )}
                  </button>
                  <div className="flex-1 space-y-2">
                    <label className="text-xs text-gray-500 block">
                      保存根目录：
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={baseDir}
                        onChange={(e) => setBaseDir(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="例如：D:\XHSNotes 或 backend/downloads"
                      />
                      <button
                        type="button"
                        onClick={handleSelectFolder}
                        className="px-4 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors inline-flex items-center gap-2 whitespace-nowrap"
                        title="选择文件夹（需要浏览器支持）"
                      >
                        <FolderOpen className="w-4 h-4" />
                        选择文件夹
                      </button>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useDefaultDir}
                        onChange={(e) => handleUseDefaultDirChange(e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span>设为默认文件夹（后续下载将自动使用此路径）</span>
                    </label>
                  </div>
                </div>
              </div>
            </section>

            {/* === 预览区 === */}
            <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => {
                      setIsBatchMode(!isBatchMode);
                      setSelectedNoteIds(new Set());
                    }}
                    className={cn(
                      "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                      isBatchMode
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    )}
                  >
                    {isBatchMode ? (
                      <>
                        <CheckSquare className="w-4 h-4" />
                        批量操作中
                      </>
                    ) : (
                      <>
                        <Square className="w-4 h-4" />
                        批量选中
                      </>
                    )}
                  </button>
                  {isBatchMode && (
                    <>
                      <button
                        onClick={toggleSelectAll}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        {selectedNoteIds.size === notes.length
                          ? "取消全选"
                          : "全选"}
                      </button>
                      <span className="text-sm text-gray-500">
                        已选中 {selectedNoteIds.size} 个
                      </span>
                    </>
                  )}
                </div>
                {isBatchMode && selectedNoteIds.size > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleBatchDownload}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      一键下载
                    </button>
                    <button
                      onClick={handleBatchDelete}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      批量删除
                    </button>
                  </div>
                )}
              </div>

              {notes.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <LinkIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>暂无笔记，请在上方输入链接开始解析</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {visibleNotes.map((note) => (
                      <div
                        key={note.id}
                        className={cn(
                          "group relative bg-white border rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition-all",
                          isBatchMode && "cursor-default",
                          selectedNoteIds.has(note.id) &&
                            "ring-2 ring-blue-600 border-blue-600"
                        )}
                        onClick={() => {
                          if (isBatchMode) {
                            toggleNoteSelection(note.id);
                          } else {
                            setPreviewNote(note);
                            setIsPreviewOpen(true);
                          }
                        }}
                      >
                        {/* 封面图 */}
                        <div className="aspect-square bg-gray-100 relative overflow-hidden">
                          {note.coverImage ? (
                            <img
                              src={note.coverImage}
                              alt={note.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              无图片
                            </div>
                          )}
                          {/* 选中标记 */}
                          {isBatchMode && (
                            <div className="absolute top-2 left-2">
                              {selectedNoteIds.has(note.id) ? (
                                <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
                                  <CheckSquare className="w-4 h-4 text-white" />
                                </div>
                              ) : (
                                <div className="w-6 h-6 bg-white/80 rounded border-2 border-gray-300" />
                              )}
                            </div>
                          )}
                        </div>
                        {/* 标题 */}
                        <div className="p-3">
                          <p className="text-sm font-medium text-gray-900 line-clamp-2">
                            {note.title}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {notes.length > DISPLAY_LIMIT && (
                    <div className="mt-6 text-center">
                      <button
                        onClick={() => setShowMore(!showMore)}
                        className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        {showMore ? "收起" : `查看更多 (${notes.length - DISPLAY_LIMIT} 个)`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          </>
        ) : (
          /* === 回收站 === */
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">回收站</h2>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => {
                    setIsBatchMode(!isBatchMode);
                    setSelectedNoteIds(new Set());
                  }}
                  className={cn(
                    "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    isBatchMode
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  )}
                >
                  {isBatchMode ? (
                    <>
                      <CheckSquare className="w-4 h-4" />
                      批量操作中
                    </>
                  ) : (
                    <>
                      <Square className="w-4 h-4" />
                      批量选中
                    </>
                  )}
                </button>
                {isBatchMode && (
                  <>
                    <button
                      onClick={toggleSelectAll}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      {selectedNoteIds.size === trash.length
                        ? "取消全选"
                        : "全选"}
                    </button>
                    {selectedNoteIds.size > 0 && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleBatchRestore}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                        >
                          <RotateCcw className="w-4 h-4" />
                          批量恢复
                        </button>
                        <button
                          onClick={handleBatchPermanentDelete}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          批量删除
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {trash.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Trash2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>回收站为空</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {trash.map((note) => (
                  <div
                    key={note.id}
                    className={cn(
                      "group relative bg-white border rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition-all",
                      isBatchMode && "cursor-default",
                      selectedNoteIds.has(note.id) &&
                        "ring-2 ring-blue-600 border-blue-600"
                    )}
                    onClick={() => {
                      if (isBatchMode) {
                        toggleNoteSelection(note.id);
                      } else {
                        setPreviewNote(note);
                        setIsPreviewOpen(true);
                      }
                    }}
                  >
                    <div className="aspect-square bg-gray-100 relative overflow-hidden">
                      {note.coverImage ? (
                        <img
                          src={note.coverImage}
                          alt={note.title}
                          className="w-full h-full object-cover opacity-60"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          无图片
                        </div>
                      )}
                      {isBatchMode && (
                        <div className="absolute top-2 left-2">
                          {selectedNoteIds.has(note.id) ? (
                            <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
                              <CheckSquare className="w-4 h-4 text-white" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 bg-white/80 rounded border-2 border-gray-300" />
                          )}
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-medium text-gray-900 line-clamp-2">
                        {note.title}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* 预览弹窗 */}
      <NotePreviewModal
        note={previewNote}
        isOpen={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
          setPreviewNote(null);
        }}
        onDownload={handleDownload}
      />

      {/* 文件夹选择对话框 */}
      <FolderPicker
        isOpen={isFolderPickerOpen}
        onClose={() => setIsFolderPickerOpen(false)}
        onSelect={handleFolderSelected}
        currentPath={baseDir}
      />
    </div>
  );
}
