/**
 * 界面文案的中英两份。
 *
 * 只放**界面骨架**的字：导航、按钮、占位符、空状态、无障碍标签。笔记、题库、
 * 博客的正文各有自己的两份来源（`.md` / `.en.md` 那一套），不从这里走。
 *
 * 写法：`{ en, zh }` 一对，取值一律经 `useLang().t()`。带数字的句子写成函数，
 * 因为中英的语序不同——「12 页」和「12 pages」只有前者能靠拼接凑出来。
 */

import type { Text } from "@/lib/i18n";

export const UI = {
  lang: {
    /** 按钮上显示的是**要切过去**的那一边，不是当前语言 */
    toEnglish: { en: "English", zh: "English" } satisfies Text,
    toChinese: { en: "中文", zh: "中文" } satisfies Text,
    switchTo: { en: "Switch to Chinese", zh: "切换到英文" } satisfies Text,
  },

  nav: {
    overview: { en: "Overview", zh: "总览" } satisfies Text,
    plan: { en: "Plan", zh: "计划" } satisfies Text,
    notes: { en: "Notes", zh: "资料" } satisfies Text,
    questions: { en: "Questions", zh: "题库" } satisfies Text,
    algorithms: { en: "Algorithms", zh: "算法" } satisfies Text,
    fetch: { en: "Fetch", zh: "Fetch" } satisfies Text,
    applications: { en: "Applications", zh: "投递" } satisfies Text,
    blog: { en: "Blog", zh: "博客" } satisfies Text,
    words: { en: "Words", zh: "生词" } satisfies Text,
    resume: { en: "Resume", zh: "简历" } satisfies Text,
    toggleTheme: { en: "Toggle theme", zh: "切换主题" } satisfies Text,
    openMenu: { en: "Open navigation menu", zh: "打开导航菜单" } satisfies Text,
    closeMenu: {
      en: "Close navigation menu",
      zh: "关闭导航菜单",
    } satisfies Text,
    menu: { en: "Navigation menu", zh: "导航菜单" } satisfies Text,
    repo: {
      en: "GitHub repository (opens in a new tab)",
      zh: "GitHub 仓库（新标签页打开）",
    } satisfies Text,
  },

  common: {
    loading: { en: "Loading…", zh: "加载中…" } satisfies Text,
    rendering: { en: "Rendering…", zh: "渲染中…" } satisfies Text,
    previous: { en: "Previous", zh: "上一篇" } satisfies Text,
    next: { en: "Next", zh: "下一篇" } satisfies Text,
    clearSearch: { en: "Clear search", zh: "清空搜索" } satisfies Text,
    collapseAll: { en: "Collapse all", zh: "全部收起" } satisfies Text,
    onThisPage: { en: "On this page", zh: "本页目录" } satisfies Text,
    updated: { en: "Updated", zh: "更新于" } satisfies Text,
    onGitHub: { en: "on GitHub", zh: "在 GitHub 上看" } satisfies Text,
  },

  footer: {
    private: {
      en: "Private notes, not indexed",
      zh: "私人笔记，不做索引",
    } satisfies Text,
  },

  notFound: {
    body: {
      en: "That page does not exist.",
      zh: "这个页面不存在。",
    } satisfies Text,
    back: { en: "Back to overview", zh: "回到总览" } satisfies Text,
  },

  status: {
    todo: { en: "Not started", zh: "未开始" } satisfies Text,
    doing: { en: "In progress", zh: "进行中" } satisfies Text,
    done: { en: "Done", zh: "已完成" } satisfies Text,
  },

  home: {
    intro: {
      en: "Everything the applications and interviews run on: form answers to search and paste, questions that were really asked, how each of the six roles is told, and a resume ready to send. Written locally in Markdown, live on push.",
      zh: "投递和面试要用的东西都在这儿：能搜能粘的网申答案、真的被问过的题、六段经历各自怎么讲，以及一份随时能发出去的简历。本地用 Markdown 写，推上去就是线上版。",
    } satisfies Text,
    statAnswers: { en: "Form answers", zh: "网申答案" } satisfies Text,
    statQuestions: { en: "Real questions", zh: "真题" } satisfies Text,
    statLibrary: { en: "Project notes", zh: "项目笔记" } satisfies Text,
    statNotes: { en: "Revision notes", zh: "复习笔记" } satisfies Text,

    cardApplyTitle: { en: "Filling a form", zh: "在填表" } satisfies Text,
    cardApplyBody: {
      en: "Search a keyword and copy from the icon on the right — no need to expand.",
      zh: "搜个关键词，点右边的图标直接复制——不用展开。",
    } satisfies Text,
    cardQuestionsTitle: {
      en: "Before an interview",
      zh: "面试前",
    } satisfies Text,
    cardQuestionsBody: {
      en: "Only questions that were really asked, in both languages, follow-ups included.",
      zh: "只收真的被问过的题，中英两份，追问也在。",
    } satisfies Text,
    cardResumeTitle: {
      en: "Sending the resume",
      zh: "要发简历",
    } satisfies Text,
    cardResumeBody: {
      en: "The web version is laid out against the PDF; the original is on the page.",
      zh: "网页版照着 PDF 排的，原件就在这一页上。",
    } satisfies Text,

    stillOpen: { en: "Still open", zh: "还没结的" } satisfies Text,
    openPages: (count: number): Text => ({
      en: `${count} pages`,
      zh: `${count} 页`,
    }),
    critical: {
      en: "Where they will dig in",
      zh: "会被追到底的",
    } satisfies Text,
    criticalPages: (count: number): Text => ({
      en: `${count} level-S pages`,
      zh: `${count} 页 S 级`,
    }),

    planTitle: {
      en: "The fourteen-day revision plan",
      zh: "十四天复习计划",
    } satisfies Text,
    planBody: (count: number): Text => ({
      en: `The fourteen days are done; ${count} pages remain under Plan, and both lists above are drawn from them.`,
      zh: `十四天已经跑完，计划下还留着 ${count} 页，上面两张表都是从里面挑的。`,
    }),

    maintainTitle: {
      en: "How to maintain this site",
      zh: "这个站怎么维护",
    } satisfies Text,
    maintain1a: { en: "Notes live at", zh: "笔记放在" } satisfies Text,
    maintain1b: {
      en: ". Drop a .md in and it appears in the navigation; the numeric filename prefix sets the order.",
      zh: "。丢一个 .md 进去就出现在导航里，文件名的数字前缀决定顺序。",
    } satisfies Text,
    maintain2a: {
      en: "Questions and form answers are TS data ——",
      zh: "题库和网申答案是 TS 数据 ——",
    } satisfies Text,
    maintain2b: { en: "and", zh: "和" } satisfies Text,
    maintain2c: {
      en: ". Add a group by writing one file and hanging it off the array.",
      zh: "。加一组就写一个文件，挂进数组。",
    } satisfies Text,
    maintain3: {
      en: 'Vercel deploys on push; the four numbers above and the "Still open" list are all computed, never edited by hand.',
      zh: "推上去 Vercel 就部署；上面那四个数和「还没结的」那张表都是算出来的，从不手写。",
    } satisfies Text,
    maintain4a: {
      en: "Away from the computer, edit in the browser with",
      zh: "不在电脑前就用",
    } satisfies Text,
    maintain4b: {
      en: "(or press",
      zh: "在浏览器里改（或者在仓库页面按",
    } satisfies Text,
    maintain4c: { en: "on the repository page).", zh: "）。" } satisfies Text,
  },

  links: {
    identity: { en: "Identity", zh: "身份信息" } satisfies Text,
    identityHint: {
      en: "The fields every application form asks for",
      zh: "每张申请表都会问的那几栏",
    } satisfies Text,
    work: { en: "Work", zh: "作品" } satisfies Text,
    workHint: {
      en: "For when someone asks to see the code",
      zh: "有人要看代码时给这个",
    } satisfies Text,
    email: { en: "Email", zh: "邮箱" } satisfies Text,
    resumeLink: { en: "Resume link", zh: "简历链接" } satisfies Text,
    copy: (label: string): Text => ({
      en: `Copy ${label}`,
      zh: `复制${label}`,
    }),
    copied: { en: "Copied", zh: "已复制" } satisfies Text,
  },

  notes: {
    searchNotes: { en: "Search notes", zh: "搜索笔记" } satisfies Text,
    searchPlaceholder: {
      en: "Search titles and body text…",
      zh: "搜标题和正文…",
    } satisfies Text,
    noMatches: { en: "No matches", zh: "没有命中" } satisfies Text,
    allNotes: { en: "All notes", zh: "全部笔记" } satisfies Text,
    openNav: { en: "Open note navigation", zh: "打开笔记导航" } satisfies Text,
    closeNav: {
      en: "Close note navigation",
      zh: "关闭笔记导航",
    } satisfies Text,
    day: (day: number): Text => ({ en: `Day ${day}`, zh: `第 ${day} 天` }),
    level: (level: string): Text => ({
      en: `Level ${level}`,
      zh: `${level} 级`,
    }),
    untranslated: {
      en: "Not translated yet — showing the original Chinese draft.",
      zh: "这一篇还没有英文版，英文模式下会显示中文原文。",
    } satisfies Text,
    editOnGitHub: {
      en: "Edit this page on GitHub",
      zh: "在 GitHub 上编辑这一页",
    } satisfies Text,
    missing: {
      en: "# Page not found\n\nThat note does not exist.",
      zh: "# 没有这一页\n\n这篇笔记不存在。",
    } satisfies Text,
  },

  questions: {
    searchPlaceholder: {
      en: "Search questions — across bullets, either language",
      zh: "搜题目 —— 跨 bullet，中英都能搜",
    } satisfies Text,
    searchLabel: { en: "Search questions", zh: "搜索题目" } satisfies Text,
    unit: { en: "questions", zh: "题" } satisfies Text,
    hintFiltered: {
      en: "Search spans every bullet; click any item on the left to leave the search",
      zh: "搜索跨全部 bullet；点左边任意一条就退出搜索",
    } satisfies Text,
    hint: {
      en: "Questions that were asked, and how to answer them. The code lives under Notes; this page is only about the sentence you say.",
      zh: "被问过的题，以及该怎么答。代码出处在「资料」里，这一页只管出口的那句话。",
    } satisfies Text,
    random: { en: "Random question", zh: "随机抽一题" } satisfies Text,
    expandGroup: { en: "Expand this group", zh: "展开这一组" } satisfies Text,
    empty: { en: "No questions here yet", zh: "这一组还没有题" } satisfies Text,
    noMatches: {
      en: "No matching questions",
      zh: "没有匹配的题",
    } satisfies Text,
    main: { en: "Main", zh: "主问" } satisfies Text,
    followup: { en: "Follow-up", zh: "追问" } satisfies Text,
    toWrite: { en: "To write", zh: "待写" } satisfies Text,
    showOther: { en: "中文", zh: "English" } satisfies Text,
    hideOther: { en: "Hide Chinese", zh: "收起英文" } satisfies Text,
    phrases: {
      en: "English you can say out loud",
      zh: "可以直接说出口的英文",
    } satisfies Text,
  },

  applications: {
    searchPlaceholder: {
      en: "Search — company, question or keyword",
      zh: "搜索 —— 公司、题目或关键词",
    } satisfies Text,
    searchLabel: {
      en: "Search form answers",
      zh: "搜索网申答案",
    } satisfies Text,
    unit: { en: "answers", zh: "条" } satisfies Text,
    hint: {
      en: "Answers already pasted into application forms. Copy from the icon on the right; expand a row only to check it.",
      zh: "已经粘进过申请表的答案。点右边的图标复制，展开只是为了核对。",
    } satisfies Text,
    companyOnly: { en: "This company only", zh: "仅限这一家" } satisfies Text,
    noMatches: {
      en: "No matching answers",
      zh: "没有匹配的答案",
    } satisfies Text,
    copyAnswer: { en: "Copy answer", zh: "复制答案" } satisfies Text,
    /** 答案正文一律是英文原件：粘进英文表单的字，翻译了就废了 */
    englishOnly: {
      en: "",
      zh: "答案正文保持英文原样 —— 这些字是要粘进英文申请表的。",
    } satisfies Text,
  },

  dictionary: {
    title: { en: "Technical Dictionary", zh: "技术生词本" } satisfies Text,
    introA: {
      en: "Words this site made me look up. Press",
      zh: "这个站逼我查过的词。任意页面按",
    } satisfies Text,
    introB: {
      en: "anywhere to add one; open a card for the English definition and an example.",
      zh: "就能加一个；点开卡片看英文释义和例句。",
    } satisfies Text,
    queueTitle: {
      en: "Waiting for definitions",
      zh: "等着补释义",
    } satisfies Text,
    copyList: { en: "Copy list", zh: "复制列表" } satisfies Text,
    clearQueue: { en: "Clear the queue", zh: "清空队列" } satisfies Text,
    queueBody: {
      en: "These live in this browser only. Copy the list, hand it over, and the words come back below in the table — in both languages.",
      zh: "这些只存在这个浏览器里。把列表复制出去交给我，词会带着中英两份回到下面的表里。",
    } satisfies Text,
    remove: (term: string): Text => ({
      en: `Remove ${term}`,
      zh: `移除 ${term}`,
    }),
    searchPlaceholder: {
      en: "Search the dictionary",
      zh: "搜索生词本",
    } satisfies Text,
    unit: { en: "words", zh: "词" } satisfies Text,
    emptyDictionary: {
      en: "No words yet — press w while reading to start",
      zh: "还没有词 —— 读的时候按 w 就能加第一个",
    } satisfies Text,
    emptyMatch: {
      en: "Nothing matches that",
      zh: "没有匹配的词",
    } satisfies Text,
    tabWords: { en: "Words", zh: "生词本" } satisfies Text,
    tabPhrases: { en: "Interview phrasebook", zh: "面试速查" } satisfies Text,
    collections: { en: "Collections", zh: "词库" } satisfies Text,
    tags: { en: "Tags", zh: "标签" } satisfies Text,
    topics: { en: "Topics", zh: "话题" } satisfies Text,
    all: { en: "All", zh: "全部" } satisfies Text,
  },

  phrasebook: {
    intro: {
      en: "Chinese on the left, the word to actually say on the right — and a red ✗ on the literal translation that will trip you up. Search either side; open a row for synonyms, usage, pronunciation and one sentence you can say as is.",
      zh: "左边中文，右边该说的英文；红色 ✗ 是会拖后腿的直译。中英都能搜；点开一条看同义词、用法、读音，和一句能原样念出去的例句。",
    } satisfies Text,
    searchPlaceholder: {
      en: "Search in Chinese or English — 解析 / downside",
      zh: "中英都能搜 —— 解析 / downside",
    } satisfies Text,
    unit: { en: "entries", zh: "条" } satisfies Text,
    emptyMatch: { en: "Nothing matches that", zh: "没有匹配的" } satisfies Text,
  },

  capture: {
    open: {
      en: "Add a word to the dictionary (press w)",
      zh: "加一个生词（按 w）",
    } satisfies Text,
    dialog: { en: "Add a word", zh: "加一个生词" } satisfies Text,
    field: { en: "Word", zh: "生词" } satisfies Text,
    close: { en: "Close", zh: "关闭" } satisfies Text,
    placeholder: {
      en: "A word you did not know — type it, press Enter",
      zh: "一个你不认识的词 —— 打进去，回车",
    } satisfies Text,
    added: (term: string): Text => ({
      en: `Queued “${term}” — keep typing to add another`,
      zh: `“${term}” 已入队 —— 可以接着敲下一个`,
    }),
    duplicate: (term: string): Text => ({
      en: `“${term}” was already in the queue`,
      zh: `“${term}” 已经在队列里了`,
    }),
    known: (term: string): Text => ({
      en: `“${term}” is already in the dictionary`,
      zh: `“${term}” 生词本里已经有了`,
    }),
    idle: {
      en: "Definitions get written later. This step only catches the word.",
      zh: "释义以后再补，这一步只负责把词抓住。",
    } satisfies Text,
    waiting: (count: number): Text => ({
      en: `${count} waiting →`,
      zh: `${count} 个待补 →`,
    }),
    goToDictionary: { en: "Dictionary →", zh: "生词本 →" } satisfies Text,
  },

  blog: {
    title: { en: "Blog", zh: "博客" } satisfies Text,
    sourceA: {
      en: "Posts live in the issues of",
      zh: "文章写在",
    } satisfies Text,
    sourceB: (count: number): Text => ({
      en: `, synced at build time · ${count} posts`,
      zh: ` 的 issues 里，构建时同步 · ${count} 篇`,
    }),
    syncedSnapshot: { en: "Updated", zh: "更新于" } satisfies Text,
    categories: { en: "Categories", zh: "分类" } satisfies Text,
    allCategories: { en: "All posts", zh: "全部文章" } satisfies Text,
    indexError: (reason: string): Text => ({
      en: `Could not read the post list: ${reason}`,
      zh: `读不到文章列表：${reason}`,
    }),
    searchPlaceholder: {
      en: "Search titles, summaries, tags…",
      zh: "搜标题、摘要、标签…",
    } satisfies Text,
    searchLabel: { en: "Search posts", zh: "搜索文章" } satisfies Text,
    showing: { en: "showing", zh: "显示" } satisfies Text,
    unit: { en: "posts", zh: "篇" } satisfies Text,
    shownOf: (shown: number, total: number): Text => ({
      en: `${shown} of ${total} posts`,
      zh: `${total} 篇里显示 ${shown} 篇`,
    }),
    unreadOnly: { en: "Unread only", zh: "只看未读" } satisfies Text,
    showUnreadOnly: { en: "Show unread only", zh: "只显示未读" } satisfies Text,
    noneMatch: (total: number): Text => ({
      en: `${total} posts in total, but none match the current filters`,
      zh: `一共 ${total} 篇，但当前筛选一篇都没匹配上`,
    }),
    resetFilters: { en: "Reset filters", zh: "清空筛选" } satisfies Text,
    allPosts: { en: "All posts", zh: "全部文章" } satisfies Text,
    written: { en: "Written", zh: "写于" } satisfies Text,
    bodyError: (reason: string): Text => ({
      en: `${reason}. You can open it`,
      zh: `${reason}。你可以`,
    }),
    read: { en: "Read", zh: "已读" } satisfies Text,
    unread: { en: "Unread", zh: "未读" } satisfies Text,
    markRead: { en: "Mark read", zh: "标已读" } satisfies Text,
    markAsRead: { en: "Mark as read", zh: "标记为已读" } satisfies Text,
    markAsUnread: { en: "Mark as unread", zh: "标记为未读" } satisfies Text,
    viewOnGitHub: { en: "View on GitHub", zh: "在 GitHub 上看" } satisfies Text,
    openPost: (title: string): Text => ({
      en: `Read ${title}`,
      zh: `阅读 ${title}`,
    }),
    writtenOn: (date: string): Text => ({
      en: `Written ${date}`,
      zh: `写于 ${date}`,
    }),
    /** 中文模式下正文回到 issues 原文，只有这一篇还没抓到时才说话 */
    onlyEnglish: {
      en: "",
      zh: "这一篇只有英文译文，暂时没取到中文原文。",
    } satisfies Text,
  },

  resume: {
    title: { en: "Resume", zh: "简历" } satisfies Text,
    subtitle: {
      en: "Laid out against the PDF · the original is in the download",
      zh: "照着 PDF 排的 · 原件在下载里",
    } satisfies Text,
    englishOnly: { en: "English only", zh: "只看英文" } satisfies Text,
    sideBySide: { en: "Side by side", zh: "中英对照" } satisfies Text,
    openPdf: { en: "Open PDF", zh: "打开 PDF" } satisfies Text,
    downloadPdf: { en: "Download PDF", zh: "下载 PDF" } satisfies Text,
  },
} as const;
