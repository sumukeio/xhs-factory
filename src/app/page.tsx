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
    <main className="flex flex-col w-full min-h-screen sm:h-screen overflow-hidden bg-gray-50">
      {/* 顶部导航 */}
      <div className="flex-shrink-0 bg-white border-b shadow-sm px-4 py-3 sm:px-6 sm:py-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">XHS Factory</h1>
          <Link
            href="/crawler"
            className="inline-flex items-center gap-2 px-4 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 items-center justify-center bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors touch-manipulation shrink-0"
          >
            <LinkIcon className="w-4 h-4" />
            <span className="whitespace-nowrap">笔记爬取工具</span>
          </Link>
        </div>
      </div>

      {/* 小屏：上下布局；大屏：左右布局 */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0">
        {/* 左侧/上方：控制台 */}
        <div className="w-full md:w-[400px] md:flex-shrink-0 border-b md:border-b-0 md:border-r border-gray-200 bg-white md:h-full overflow-y-auto max-h-[50vh] md:max-h-none">
          <EditorPanel data={postData} onChange={setPostData} />
        </div>

        {/* 右侧/下方：实时预览区 */}
        <div className="flex-1 min-h-[50vh] md:min-h-0 md:h-full flex items-center justify-center bg-gray-100 relative p-4">
          <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
          <CanvasPreview data={postData} />
        </div>
      </div>
    </main>
  );
}