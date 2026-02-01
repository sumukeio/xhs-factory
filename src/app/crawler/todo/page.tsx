"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Note, ParseRequest, TodoItem } from "@/types";
import { Loader2, ListTodo, Check, X, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY_NOTES = "xhs_crawler_notes";
const STORAGE_KEY_PARSE_HISTORY = "xhs_crawler_parse_history";
const STORAGE_KEY_TODO = "xhs_crawler_todo";
const PARSE_HISTORY_MAX = 30;

function extractUrls(text: string): string[] {
  const urlRegex =
    /https?:\/\/(www\.)?(xiaohongshu\.com|xhslink\.com)\/[^\s]+/gi;
  const matches = text.match(urlRegex);
  return matches ? [...new Set(matches)] : [];
}

export default function TodoPage() {
  const [todoItems, setTodoItems] = useState<TodoItem[]>([]);
  const [todoInput, setTodoInput] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY_TODO);
    if (saved) {
      try {
        setTodoItems(JSON.parse(saved));
      } catch {
        /* ignore */
      }
    }
  }, []);

  const saveTodoItems = useCallback((items: TodoItem[]) => {
    setTodoItems(items);
    localStorage.setItem(STORAGE_KEY_TODO, JSON.stringify(items));
  }, []);

  const doParseUrls = async (
    urls: string[],
    options?: { markTodoParsed?: boolean }
  ): Promise<{ notes: Note[]; failed: string[] }> => {
    const res = await fetch("/api/batch-parse-stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls } as ParseRequest),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.message || "解析失败");
    }
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    if (!reader) throw new Error("无法读取流式响应");

    let buffer = "";
    let data: { notes: any[]; failed: any[] } = { notes: [], failed: [] };
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";
      for (const chunk of lines) {
        const match = chunk.match(/^data:\s*(.+)$/m);
        if (!match) continue;
        try {
          const event = JSON.parse(match[1].trim()) as {
            type: string;
            current?: number;
            total?: number;
            notes?: any[];
            failed?: any[];
          };
          if (event.type === "progress" && event.current != null && event.total != null) {
            setParseProgress({ current: event.current, total: event.total });
          } else if (event.type === "done") {
            data = { notes: event.notes || [], failed: event.failed || [] };
          }
        } catch {
          /* ignore */
        }
      }
    }
    if (buffer) {
      const match = buffer.match(/^data:\s*(.+)$/m);
      if (match) {
        try {
          const event = JSON.parse(match[1].trim()) as { type: string; notes?: any[]; failed?: any[] };
          if (event.type === "done") data = { notes: event.notes || [], failed: event.failed || [] };
        } catch {
          /* ignore */
        }
      }
    }

    const newNotes: Note[] = data.notes.map((n: any) => ({
      ...n,
      createdAt: Date.now(),
      isDeleted: false,
    }));
    let prev: Note[] = [];
    try {
      const rawNotes = localStorage.getItem(STORAGE_KEY_NOTES);
      if (rawNotes) prev = JSON.parse(rawNotes);
    } catch {
      /* 忽略损坏数据 */
    }
    const existingIds = new Set(prev.map((n) => n.id));
    const uniqueNewNotes = newNotes.filter((n: Note) => !existingIds.has(n.id));
    const nextNotes = [...prev, ...uniqueNewNotes];
    localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(nextNotes));

    const successUrls = new Set(data.notes.map((n: any) => n.url));
    const failedList = (data.failed || []).map((f: { url: string }) => f.url);
    if (options?.markTodoParsed && successUrls.size > 0) {
      setTodoItems((prevItems) => {
        const next = prevItems.map((item) =>
          successUrls.has(item.url) ? { ...item, parsed: true } : item
        );
        localStorage.setItem(STORAGE_KEY_TODO, JSON.stringify(next));
        return next;
      });
    }

    const allRequestedUrls = [...new Set(urls)];
    let parseHistory: string[] = [];
    try {
      const rawHistory = localStorage.getItem(STORAGE_KEY_PARSE_HISTORY);
      if (rawHistory) parseHistory = JSON.parse(rawHistory);
    } catch {
      /* 忽略损坏数据 */
    }
    const newHistory = [
      ...allRequestedUrls,
      ...parseHistory.filter((u) => !allRequestedUrls.includes(u)),
    ].slice(0, PARSE_HISTORY_MAX);
    localStorage.setItem(STORAGE_KEY_PARSE_HISTORY, JSON.stringify(newHistory));
    setParseProgress({ current: urls.length, total: urls.length });
    return { notes: uniqueNewNotes, failed: failedList };
  };

  const handleParseFromTodo = async () => {
    const unparsed = todoItems.filter((item) => !item.parsed).map((item) => item.url);
    if (unparsed.length === 0) {
      alert("没有待解析的链接，或已全部解析完成。");
      return;
    }
    setIsParsing(true);
    setParseProgress({ current: 0, total: unparsed.length });
    try {
      const { notes: added, failed } = await doParseUrls(unparsed, { markTodoParsed: true });
      if (failed.length > 0) {
        alert(
          `解析完成：成功 ${added.length} 个，失败 ${failed.length} 个。失败的链接仍保留为未解析，可稍后重试。`
        );
      } else {
        alert(`成功解析 ${added.length} 个笔记！可返回工作台查看。`);
      }
    } catch (err: unknown) {
      console.error(err);
      alert("解析失败：" + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsParsing(false);
    }
  };

  const handleAddToTodo = () => {
    const urls = extractUrls(todoInput)
      .map((u) => u.trim())
      .filter((u) => u.length > 0);
    if (urls.length === 0) {
      alert("请粘贴或输入至少一个小红书笔记链接。");
      return;
    }
    const existing = new Set(todoItems.map((i) => i.url));
    const toAdd: TodoItem[] = urls.filter((u) => !existing.has(u)).map((url) => ({ url, parsed: false }));
    const skipped = urls.length - toAdd.length;
    if (toAdd.length === 0) {
      alert("这些链接已在待办库中，已自动忽略重复。");
      setTodoInput("");
      return;
    }
    saveTodoItems([...todoItems, ...toAdd]);
    setTodoInput("");
    if (skipped > 0) {
      alert(`已添加 ${toAdd.length} 条。${skipped} 条与已有链接重复，已自动忽略。`);
    }
  };

  const removeTodoItem = (url: string) => {
    saveTodoItems(todoItems.filter((i) => i.url !== url));
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-safe">
      <div className="bg-white border-b shadow-sm sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/crawler"
              className="p-2 -ml-2 rounded-lg text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors touch-manipulation flex items-center justify-center"
              title="返回工作台"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
              <ListTodo className="w-5 h-5 text-blue-600 shrink-0" />
              待办库
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4 sm:px-6 sm:py-6">
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
          <p className="text-sm text-gray-500 mb-3">
            把链接粘贴进下方输入框并点击「添加到待办库」。<strong>已存在的链接会自动忽略（去重）</strong>。点击「一键解析」只解析未解析的链接，解析成功的会标注为已解析。
          </p>
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <textarea
              value={todoInput}
              onChange={(e) => setTodoInput(e.target.value)}
              onPaste={(e) => {
                const text = e.clipboardData.getData("text");
                const urls = extractUrls(text);
                if (urls.length > 0) {
                  e.preventDefault();
                  setTodoInput((prev) => (prev ? prev + "\n" + urls.join("\n") : urls.join("\n")));
                }
              }}
              placeholder="粘贴链接（每行一个或包含链接的文本）"
              rows={3}
              className="flex-1 min-h-[80px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono text-sm"
            />
            <button
              type="button"
              onClick={handleAddToTodo}
              className="min-h-[44px] sm:min-h-0 px-4 py-2.5 sm:py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 active:bg-gray-300 transition-colors text-sm font-medium whitespace-nowrap touch-manipulation"
            >
              添加到待办库
            </button>
          </div>
          {todoItems.length > 0 && (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                <span className="text-sm text-gray-600">
                  共 {todoItems.length} 条，未解析 {todoItems.filter((i) => !i.parsed).length} 条
                </span>
                <button
                  type="button"
                  onClick={handleParseFromTodo}
                  disabled={isParsing || todoItems.every((i) => i.parsed)}
                  className="w-full sm:w-auto min-h-[44px] sm:min-h-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
                >
                  {isParsing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      解析中... {parseProgress.current}/{parseProgress.total}
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      一键解析（仅未解析）
                    </>
                  )}
                </button>
              </div>
              {isParsing && parseProgress.total > 0 && (
                <div className="mb-3">
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-600 h-full transition-all duration-300"
                      style={{ width: `${(parseProgress.current / parseProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
              <ul className="rounded-lg border border-gray-200 divide-y divide-gray-100 max-h-[50vh] overflow-y-auto">
                {todoItems.map((item) => (
                  <li
                    key={item.url}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm font-mono",
                      item.parsed && "bg-gray-50 text-gray-500"
                    )}
                  >
                    <span className="flex-1 truncate" title={item.url}>
                      {item.url}
                    </span>
                    {item.parsed && (
                      <span className="flex-shrink-0 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                        已解析
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeTodoItem(item.url)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors touch-manipulation"
                      title="从待办库移除"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
        <p className="text-center">
          <Link
            href="/crawler"
            className="text-blue-600 hover:underline text-sm"
          >
            返回工作台
          </Link>
        </p>
      </div>
    </div>
  );
}
