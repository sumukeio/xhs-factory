"use client"; // 必须标记为客户端组件，因为用到了 useState

import { useState } from 'react';
import Link from 'next/link';
// 注意这里的路径别名 @/ 指向 src/
import EditorPanel from '@/components/EditorPanel';
import CanvasPreview from '@/components/CanvasPreview';
import { PostData } from '@/types';
import { Link as LinkIcon } from 'lucide-react';

export default function Home() {
  // === 初始化默认爆款数据 ===
  const [postData, setPostData] = useState<PostData>({
    layout: 'cover-big', // 默认大字报模式
    themeColor: 'bg-xhs-bg-cream', // 默认米白底色
    englishHook: 'AWAKENING',
    title: '长期主义的可怕复利',
    subTitle: '认知觉醒 · 商业思维',
    content: [
      "工作的本质就是一场交易。",
      "不要把工作看得太重，也不要太在意别人的看法。",
      "打工就打工，别占用私人时间来痛苦。",
      "该是自己手头的工作踏实完成，不是自己的任务礼貌拒绝。"
    ],
    tags: ['商业思维', '认知觉醒', '搞钱'],
    footerText: 'XHS FACTORY @ 2025'
  });

  return (
    <main className="flex flex-col w-full h-screen overflow-hidden bg-gray-50">
      {/* 顶部导航 */}
      <div className="flex-shrink-0 bg-white border-b shadow-sm px-6 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">XHS Factory</h1>
          <Link
            href="/crawler"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <LinkIcon className="w-4 h-4" />
            笔记爬取工具
          </Link>
        </div>
      </div>
      
      <div className="flex flex-1 overflow-hidden">
      {/* === 左侧：控制台 (固定宽度) === */}
      <div className="w-[400px] flex-shrink-0 border-r border-gray-200 bg-white h-full overflow-y-auto">
        <EditorPanel data={postData} onChange={setPostData} />
      </div>

      {/* === 右侧：实时预览区 (自适应宽度) === */}
      <div className="flex-1 h-full flex items-center justify-center bg-gray-100 relative">
        {/* 背景网格装饰 (可选) */}
        <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        
        <CanvasPreview data={postData} />
      </div>
      </div>
    </main>
  );
}