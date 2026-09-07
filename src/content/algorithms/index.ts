/**
 * 算法题解的内容层（/algorithms 那个 tab）。
 *
 * 目录里的 .md **全部由 `npm run sync:algorithms` 生成**，源是本机的
 * `Algorithm/既然巅峰留不住，那就重走来时路`。不要手改这里的文件，下一次同步会覆盖；
 * 要改就改源目录里的题解，再跑一次同步。
 */

import { buildCollection } from '../collection';

const RAW = import.meta.glob('./**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const collection = buildCollection(RAW, 'src/content/algorithms');

export const algorithmSections = collection.sections;

export const allAlgorithmNotes = collection.notes;

export const getAlgorithmNote = collection.getNote;
