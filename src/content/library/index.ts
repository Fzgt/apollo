/**
 * 面试资料的内容层（/library 那个 tab）。
 *
 * 来源是本机 Obsidian vault `Znlm/resume-review` —— 按公司/项目分的学习笔记。
 * 目录约定与 frontmatter 字段见 `@/content/collection`；这一集合不用
 * day / level / status，它们只属于复习计划那套。
 */

import { buildCollection } from '../collection';

const RAW = import.meta.glob('./**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const collection = buildCollection(RAW, 'src/content/library');

export const librarySections = collection.sections;

export const allLibraryNotes = collection.notes;

export const getLibraryNote = collection.getNote;
