import React from 'react';
import { PostData, LayoutStyle } from '@/types';

interface EditorPanelProps {
  data: PostData;
  onChange: (newData: PostData) => void;
}

export default function EditorPanel({ data, onChange }: EditorPanelProps) {
  
  const handleChange = (key: keyof PostData, value: any) => {
    onChange({ ...data, [key]: value });
  };

  const handleContentChange = (val: string) => {
      // 简单的按行分割
      handleChange('content', val.split('\n'));
  }

  return (
    <div className="w-full h-full p-6 bg-white border-r border-gray-200 overflow-y-auto">
      <h2 className="text-xl font-bold mb-6 text-gray-800">🏭 XHS 工厂控制台</h2>
      
      <div className="space-y-6">
        {/* 布局选择 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">选择布局</label>
          <div className="flex space-x-2">
            {['cover-big', 'list-simple'].map((layout) => (
                <button
                    key={layout}
                    onClick={() => handleChange('layout', layout)}
                    className={`px-3 py-2 text-sm rounded-md border ${data.layout === layout ? 'bg-black text-white' : 'bg-gray-50'}`}
                >
                    {layout === 'cover-big' ? '封面模式' : '正文清单'}
                </button>
            ))}
          </div>
        </div>

        {/* 颜色选择 */}
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">背景色调</label>
            <div className="flex space-x-2">
                {[
                    {name: '米白', cls: 'bg-xhs-bg-cream'}, 
                    {name: '雾蓝', cls: 'bg-xhs-bg-blue'}, 
                    {name: '灰绿', cls: 'bg-xhs-bg-green'},
                    {name: '暗黑', cls: 'bg-xhs-bg-dark text-white'}
                ].map((theme) => (
                    <button
                        key={theme.cls}
                        onClick={() => handleChange('themeColor', theme.cls)}
                        className={`w-8 h-8 rounded-full border-2 ${theme.cls.split(' ')[0]} ${data.themeColor === theme.cls ? 'border-black' : 'border-transparent'}`}
                        title={theme.name}
                    />
                ))}
            </div>
        </div>

        {/* 文本输入区 */}
        <div className="space-y-4">
            <input 
                type="text" 
                value={data.englishHook} 
                onChange={(e) => handleChange('englishHook', e.target.value)}
                className="w-full p-2 border rounded text-sm"
                placeholder="英文装饰词 (如: COGNITIVE)"
            />
             <input 
                type="text" 
                value={data.title} 
                onChange={(e) => handleChange('title', e.target.value)}
                className="w-full p-2 border rounded text-lg font-bold"
                placeholder="核心大标题"
            />
             <input 
                type="text" 
                value={data.subTitle} 
                onChange={(e) => handleChange('subTitle', e.target.value)}
                className="w-full p-2 border rounded text-sm"
                placeholder="副标题"
            />
            
            <textarea
                value={data.content.join('\n')}
                onChange={(e) => handleContentChange(e.target.value)}
                className="w-full p-2 border rounded text-sm h-32"
                placeholder="正文内容（每行生成一个列表项）..."
            />
        </div>
      </div>
    </div>
  );
}