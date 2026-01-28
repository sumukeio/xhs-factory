import React, { useState } from 'react';
import { PostData } from '@/types';
import { cn } from '@/lib/utils';
import { Loader2, Sparkles, Link as LinkIcon } from 'lucide-react';

interface EditorPanelProps {
  data: PostData;
  onChange: (data: PostData) => void;
}

export default function EditorPanel({ data, onChange }: EditorPanelProps) {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // === 核心逻辑：调用 Python 后端 ===
  const handleGenerate = async () => {
    if (!url) return alert('请先粘贴小红书笔记链接！');
    
    setIsLoading(true);
    try {
      // 1. 发送请求给 Next.js 的 API 路由 (会自动转发给 Python)
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) throw new Error('生成失败，请检查链接或后端服务');

      const result = await res.json();

      // === 智能合并策略 (新增) ===
      // 如果图片里识别出了文字(ocrText)，我们把它插到内容的最前面
      // 这样你可以直接看到大字报上的重点，而不仅仅是正文
      let finalContent = result.content || [];
      
      if (result.ocrText) {
         // 按换行符分割，并过滤掉空行
         const ocrLines = result.ocrText.split('\n').filter((l: string) => l.trim().length > 0);
         // 合并：图片文字在前，正文在后
         finalContent = [...ocrLines, ...finalContent];
         console.log("AI 识别到的图片文字:", ocrLines);
      }

      // 2. 将后端返回的数据合并到当前状态中
      onChange({
        ...data, // 保留原有的布局和样式设置
        title: result.title,
        englishHook: result.englishHook || 'NEW ARRIVAL',
        
        // 智能提取：
        // 现在的逻辑是：合并后的第一行文字自动作为副标题，剩下的作为正文列表
        subTitle: finalContent[0] || '点击编辑副标题', 
        content: finalContent.slice(1), 
        
        tags: result.tags,
        images: result.images, // 保存图片链接供后续使用
      });

      const successMsg = result.ocrText 
        ? '🎉 抓取成功！已从图片中提取了文字信息。' 
        : '🎉 抓取成功！内容已自动填入。';
      alert(successMsg);

    } catch (error) {
      console.error(error);
      alert('❌ 抓取失败，请确保 backend/main.py 正在运行。');
    } finally {
      setIsLoading(false);
    }
  };

  // 通用字段修改器
  const handleChange = (key: keyof PostData, value: any) => {
    onChange({ ...data, [key]: value });
  };

  return (
    <div className="flex flex-col h-full bg-white shadow-sm">
      {/* 顶部标题 */}
      <div className="p-4 border-b flex items-center gap-2 bg-gray-50">
        <span className="text-xl">🏭</span>
        <h2 className="font-bold text-gray-800">XHS 工厂控制台</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        
        {/* === 模块 1: AI 智能采集 === */}
        <section className="space-y-3 bg-blue-50 p-4 rounded-xl border border-blue-100">
          <div className="flex items-center gap-2 text-blue-800 font-bold text-sm">
            <Sparkles className="w-4 h-4" />
            AI 一键生成
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <LinkIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="在此粘贴小红书链接..."
                className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : '生成'}
            </button>
          </div>
          <p className="text-[10px] text-blue-400">
            * 支持自动抓取标题、正文、标签及无水印配图
          </p>
        </section>

        {/* === 模块 2: 布局与配色 === */}
        <section className="space-y-4">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">视觉风格</label>
          
          {/* 布局选择 */}
          <div className="grid grid-cols-2 gap-2">
            {['cover-big', 'list-simple'].map((layout) => (
              <button
                key={layout}
                onClick={() => handleChange('layout', layout)}
                className={cn(
                  "py-2 px-4 text-xs font-medium rounded-lg border transition-all",
                  data.layout === layout 
                    ? "bg-gray-900 text-white border-gray-900" 
                    : "bg-white text-gray-600 hover:bg-gray-50"
                )}
              >
                {layout === 'cover-big' ? '大字报封面' : '正文清单'}
              </button>
            ))}
          </div>

          {/* 颜色选择 */}
          <div className="flex gap-3">
            {[
              { name: '米白', value: 'bg-xhs-bg-cream', hex: '#FDFBF7' },
              { name: '雾蓝', value: 'bg-xhs-bg-blue', hex: '#D8E2EB' },
              { name: '森绿', value: 'bg-xhs-bg-green', hex: '#E0E5DF' },
              { name: '黑金', value: 'bg-xhs-bg-dark', hex: '#1A1A1A' },
            ].map((color) => (
              <button
                key={color.value}
                onClick={() => handleChange('themeColor', color.value)}
                className={cn(
                  "w-8 h-8 rounded-full border-2 shadow-sm transition-transform hover:scale-110",
                  data.themeColor === color.value ? "border-blue-500 scale-110" : "border-transparent"
                )}
                style={{ backgroundColor: color.hex }}
                title={color.name}
              />
            ))}
          </div>
        </section>

        {/* === 模块 3: 内容编辑 === */}
        <section className="space-y-4">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">文案内容</label>
          
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">英文 Hook (装饰)</label>
              <input
                value={data.englishHook}
                onChange={(e) => handleChange('englishHook', e.target.value)}
                className="w-full p-2 text-sm border rounded-md font-mono"
              />
            </div>
            
            <div>
              <label className="text-xs text-gray-500 mb-1 block">主标题</label>
              <input
                value={data.title}
                onChange={(e) => handleChange('title', e.target.value)}
                className="w-full p-2 text-sm border rounded-md font-bold"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">副标题 / 第一段</label>
              <input
                value={data.subTitle}
                onChange={(e) => handleChange('subTitle', e.target.value)}
                className="w-full p-2 text-sm border rounded-md"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">正文列表 (每行一段)</label>
              <textarea
                value={data.content.join('\n')}
                onChange={(e) => handleChange('content', e.target.value.split('\n'))}
                rows={6}
                className="w-full p-2 text-sm border rounded-md resize-none leading-relaxed"
              />
            </div>

             <div>
              <label className="text-xs text-gray-500 mb-1 block">底部标签</label>
              <input
                value={data.tags.join(' ')}
                onChange={(e) => handleChange('tags', e.target.value.split(' '))}
                className="w-full p-2 text-sm border rounded-md text-blue-500"
                placeholder="用空格分隔标签"
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}