export type LayoutStyle = 'cover-big' | 'list-simple' | 'quote-classic';

export interface PostData {
  layout: LayoutStyle;
  themeColor: string; // Tailwind class like 'bg-xhs-bg-cream'
  englishHook: string;
  title: string;
  subTitle: string;
  content: string[]; // 数组，方便列表渲染
  tags: string[];
  footerText: string;
}