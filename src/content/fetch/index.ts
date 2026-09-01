/**
 * Fetch 面试专用笔记的内容层（/fetch 那个 tab）。
 *
 * 只服务一场面试：2026-09-10 的 Fetch 前端岗。内容按 JD 的分块组织，
 * 和 `content/library` 的通用项目笔记分开——那边讲我做过什么，
 * 这边讲这家公司要什么、我手上哪一条接得住。
 *
 * 目录约定与 frontmatter 字段见 `@/content/collection`；这一集合和资料集一样
 * 不用 day / level / status，那三个字段只属于复习计划那套。
 */

import { buildCollection } from '../collection';

const RAW = import.meta.glob('./**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const collection = buildCollection(RAW, 'src/content/fetch');

export const fetchSections = collection.sections;

export const allFetchNotes = collection.notes;

export const getFetchNote = collection.getNote;
