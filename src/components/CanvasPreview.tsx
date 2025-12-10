import React from 'react';
import { PostData } from '@/types';
import { cn } from '@/lib/utils'; // 需自己简单实现或直接用 classnames

interface CanvasPreviewProps {
  data: PostData;
}

export default function CanvasPreview({ data }: CanvasPreviewProps) {
  // iPhone 13 Pro Max 比例模拟 (容器缩放，但内部保持高分辨率比例)
  // 实际渲染时，我们是用真实像素 1080x1440
  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-100 p-8 overflow-hidden">
      <div 
        id="xhs-canvas"
        className={cn(
          "w-[375px] h-[500px] shadow-2xl relative flex flex-col overflow-hidden transition-colors duration-300",
          data.themeColor
        )}
        style={{
            // 模拟 3:4 比例
            aspectRatio: '3/4', 
        }}
      >
        {/* === 布局 A: 大字报封面 === */}
        {data.layout === 'cover-big' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center relative z-10">
            <div className="font-xhs-bold text-xs tracking-[0.4em] opacity-40 uppercase mb-8">
              {data.englishHook}
            </div>
            
            <h1 className="font-xhs-bold text-5xl leading-none tracking-tighter text-xhs-text-main drop-shadow-sm mb-4">
              {data.title}
            </h1>
            
            <div className="w-12 h-1 bg-xhs-text-main opacity-20 my-4 rounded-full"></div>
            
            <h2 className="font-xhs-bold text-lg tracking-widest text-xhs-text-sub">
              {data.subTitle}
            </h2>

            {/* 底部标签 */}
            <div className="absolute bottom-8 flex space-x-2 opacity-50">
                {data.tags.map((tag, i) => (
                    <span key={i} className="text-[10px] font-bold border border-current px-2 py-0.5 rounded-full">
                        {tag}
                    </span>
                ))}
            </div>
          </div>
        )}

        {/* === 布局 B: 清单正文 === */}
        {data.layout === 'list-simple' && (
          <div className="flex-1 flex flex-col p-8">
            <div className="flex items-center space-x-2 mb-8 opacity-80 border-b border-black/10 pb-4">
                <div className="w-8 h-8 rounded-full bg-xhs-text-main text-white flex items-center justify-center text-xs font-bold">
                    P1
                </div>
                <h2 className="font-xhs-bold text-xl text-xhs-text-main">{data.title}</h2>
            </div>
            
            <div className="flex-1 space-y-6">
                {data.content.map((item, index) => (
                    <div key={index} className="flex group">
                        <div className="font-xhs-bold text-2xl mr-4 opacity-20 italic">
                            {index + 1}
                        </div>
                        <p className="font-xhs-serif text-sm leading-relaxed text-xhs-text-main text-justify-cjk">
                            {item}
                        </p>
                    </div>
                ))}
            </div>
             <div className="mt-auto pt-4 text-[10px] text-center opacity-30 tracking-widest uppercase">
                {data.footerText}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}