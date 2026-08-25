/**
 * 首页那块「一键复制」的常用链接。
 *
 * 加一条就往下面的数组里写一行。`value` 是进剪贴板的原文——网申表单要的是
 * 裸链接和裸邮箱，所以这里一律不带 `mailto:`、不带说明文字、结尾不带斜杠之外的东西。
 * `href` 只管点开，跟复制的内容是两回事。
 */

export interface QuickLink {
  /** 左侧标签，扫一眼定位用 */
  label: string;
  /** 复制进剪贴板的原文 */
  value: string;
  /** 点击右侧图标打开的地址；邮箱走 mailto */
  href: string;
}

export interface QuickLinkGroup {
  title: string;
  hint: string;
  links: QuickLink[];
}

export const quickLinkGroups: QuickLinkGroup[] = [
  {
    title: '身份',
    hint: '网申表单里那几个空',
    links: [
      { label: '邮箱', value: 'fzgt320@gmail.com', href: 'mailto:fzgt320@gmail.com' },
      { label: 'GitHub', value: 'https://github.com/Fzgt', href: 'https://github.com/Fzgt' },
      {
        label: 'LinkedIn',
        value: 'https://www.linkedin.com/in/fzgt/',
        href: 'https://www.linkedin.com/in/fzgt/',
      },
      {
        label: '简历直链',
        value: 'https://data-api.fzgt320.workers.dev/resume',
        href: 'https://data-api.fzgt320.workers.dev/resume',
      },
    ],
  },
  {
    title: '作品',
    hint: '被要「给个代码看看」的时候',
    links: [
      {
        label: 'WinterFell',
        value: 'https://github.com/Fzgt/CG-WinterFell',
        href: 'https://github.com/Fzgt/CG-WinterFell',
      },
      {
        label: 'Periplus',
        value: 'https://github.com/parthenon-labs/periplus',
        href: 'https://github.com/parthenon-labs/periplus',
      },
    ],
  },
];
