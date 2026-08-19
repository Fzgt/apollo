/**
 * 复习计划的内容层（/docs 那个 tab）。
 *
 * 目录约定与 frontmatter 字段见 `@/content/collection`。
 * 这一集合额外用到 day / level / status 三个字段：它们驱动首页看板。
 */

import { buildCollection } from '../collection';

export type { Note, NoteFrontmatter, NoteSection, NoteStatus } from '../collection';

const RAW = import.meta.glob('./**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const collection = buildCollection(RAW, 'src/content/notes');

export const noteSections = collection.sections;

export const allNotes = collection.notes;

/** 按复习日排序的笔记，day 为 0（总览）和 99（速查）的排除在外 */
export const dayNotes = allNotes
  .filter((note) => note.day >= 1 && note.day <= 14)
  .sort((a, b) => a.day - b.day);

export const getNote = collection.getNote;

export const firstNote = allNotes[0];
