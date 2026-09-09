/**
 * Task-board client half: registers the 任务 tab in conversation.view
 * (between 文件 and 论文). Personal, user-maintained — no agent-facing
 * surface. Settings live in the UnPlugin settings page (paperspace owns the
 * page; the task-board section is rendered there).
 */
import React from 'react';
import TasksView, { type TasksLocale } from './view';
import stylesCss from './styles.css';

const NS = 'dsh-unknownue-plugins.tasks';

/**
 * The composer (input box) belongs to the chat view — hide it while the
 * tasks tab owns the conversation view. DSH renders the composer for the
 * active view regardless of which tab it is, so the seat is hidden via CSS
 * when the tasks root is present in the active conversation (the same
 * approach paperspace uses).
 */
const CHROME_CSS = `
[data-phase='active']:has(.dsh-tasks) [data-composer-seat],
[class*='scrollBody']:has(.dsh-tasks) [class*='composerSeat'] {
  display: none !important;
}
`;

const zh: Record<string, string> = {
  'view.label': '任务',
  'mode.board': '看板',
  'mode.list': '列表',
  'board.new': '新建任务',
  'board.refresh': '刷新',
  'board.empty': '还没有任务。点「新建任务」开始。',
  'board.loadFailed': '加载失败：',
  'board.revision': '数据版本',
  'board.archiveAll': '全部归档',
  'board.archiveAllConfirm': '确定归档「完成」列的 {n} 张卡片？',
  'list.title': '标题',
  'list.status': '状态',
  'list.priority': '优先级',
  'list.due': '截止',
  'list.tags': '标签',
  'list.updated': '更新于',
  'archive.open': '已归档',
  'archive.title': '已归档任务',
  'archive.searchPlaceholder': '搜索标题或正文…',
  'archive.empty': '还没有已归档的任务。',
  'archive.noMatch': '没有匹配的任务。',
  'archive.createdAt': '创建于',
  'archive.completedAt': '完成于',
  'status.todo': '待办',
  'status.in_progress': '进行中',
  'status.blocked': '阻塞',
  'status.done': '完成',
  'priority.low': '低',
  'priority.medium': '中',
  'priority.high': '高',
  'editor.title': '任务',
  'editor.newTitle': '新建任务',
  'editor.editTitle': '编辑任务',
  'editor.body': '描述（Markdown）',
  'editor.status': '状态',
  'editor.priority': '优先级',
  'editor.due': '截止日期',
  'due.none': '无',
  'due.point': '单点',
  'due.range': '范围',
  'due.at': '截止时间',
  'due.start': '开始',
  'due.end': '结束',
  'due.invalid': '截止时间无效：需填写日期，且范围开始不能晚于结束。',
  'editor.save': '保存',
  'editor.cancel': '取消',
  'editor.archive': '归档',
  'editor.restore': '恢复',
  'editor.delete': '删除',
  'editor.deleteConfirm': '确定永久删除该任务？此操作不可撤销。',
  'todos.title': '子任务',
  'todos.empty': '暂无子任务。',
  'todos.addPlaceholder': '新增子任务，回车或点「添加」',
  'todos.add': '添加',
  'todos.toggle': '勾选子任务',
  'todos.edit': '编辑子任务',
  'todos.remove': '删除子任务',
  'todos.expand': '展开全部',
  'todos.collapse': '收起',
  'todos.presets': '快捷添加预定义子任务',
  'todos.preset.requirements': '需求确认',
  'todos.preset.design': '方案设计',
  'todos.preset.implement': '编码实现',
  'todos.preset.selfcheck': '自测验证',
  'todos.preset.review': '代码评审',
  'todos.preset.docs': '更新文档',
  'tags.title': '标签',
  'tags.addPlaceholder': '新增标签，回车添加',
  'tags.suggestions': '已有标签：',
  'tags.remove': '移除标签',
};

const en: Record<string, string> = {
  'view.label': 'Tasks',
  'mode.board': 'Board',
  'mode.list': 'List',
  'board.new': 'New task',
  'board.refresh': 'Refresh',
  'board.empty': 'No tasks yet. Click "New task" to start.',
  'board.loadFailed': 'Failed to load:',
  'board.revision': 'Revision',
  'board.archiveAll': 'Archive all',
  'board.archiveAllConfirm': 'Archive all {n} cards in the Done column?',
  'list.title': 'Title',
  'list.status': 'Status',
  'list.priority': 'Priority',
  'list.due': 'Due',
  'list.tags': 'Tags',
  'list.updated': 'Updated',
  'archive.open': 'Archived',
  'archive.title': 'Archived tasks',
  'archive.searchPlaceholder': 'Search title or content…',
  'archive.empty': 'No archived tasks yet.',
  'archive.noMatch': 'No matching tasks.',
  'archive.createdAt': 'Created',
  'archive.completedAt': 'Completed',
  'status.todo': 'To-do',
  'status.in_progress': 'In progress',
  'status.blocked': 'Blocked',
  'status.done': 'Done',
  'priority.low': 'Low',
  'priority.medium': 'Medium',
  'priority.high': 'High',
  'editor.title': 'Task',
  'editor.newTitle': 'New task',
  'editor.editTitle': 'Edit task',
  'editor.body': 'Description (Markdown)',
  'editor.status': 'Status',
  'editor.priority': 'Priority',
  'editor.due': 'Due date',
  'due.none': 'None',
  'due.point': 'Single',
  'due.range': 'Range',
  'due.at': 'Due time',
  'due.start': 'Start',
  'due.end': 'End',
  'due.invalid': 'Invalid due date: fill the date(s) and keep the range start before its end.',
  'editor.save': 'Save',
  'editor.cancel': 'Cancel',
  'editor.archive': 'Archive',
  'editor.restore': 'Restore',
  'editor.delete': 'Delete',
  'editor.deleteConfirm': 'Permanently delete this task? This cannot be undone.',
  'todos.title': 'Subtasks',
  'todos.empty': 'No subtasks yet.',
  'todos.addPlaceholder': 'Add a subtask, then press Enter or click Add',
  'todos.add': 'Add',
  'todos.toggle': 'Toggle subtask',
  'todos.edit': 'Edit subtask',
  'todos.remove': 'Remove subtask',
  'todos.expand': 'Expand all',
  'todos.collapse': 'Collapse',
  'todos.presets': 'Quick-add preset subtasks',
  'todos.preset.requirements': 'Confirm requirements',
  'todos.preset.design': 'Design the approach',
  'todos.preset.implement': 'Implementation',
  'todos.preset.selfcheck': 'Self-test and verify',
  'todos.preset.review': 'Code review',
  'todos.preset.docs': 'Update documentation',
  'tags.title': 'Tags',
  'tags.addPlaceholder': 'Add a tag and press Enter',
  'tags.suggestions': 'Existing tags:',
  'tags.remove': 'Remove tag',
};

function ensureStyles(): void {
  if (typeof document === 'undefined') return;
  const inject = (tagId: string, css: string) => {
    const existing = document.querySelector(`style[data-plugin-css="${tagId}"]`);
    const tag = existing !== null ? existing : document.createElement('style');
    tag.setAttribute('data-plugin-css', tagId);
    tag.textContent = css;
    if (existing === null) document.head.appendChild(tag);
  };
  inject('dsh-tasks/styles.css', stylesCss);
  inject('dsh-tasks/theme.css', CHROME_CSS);
}

export function applyTasksTab(ctx: any): void {
  ensureStyles();
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-tasks: dictionaries');
  const t: TasksLocale = ctx.locale.bind(NS);

  ctx.slots.inject('conversation.view', () =>
    ctx.slots.register(
      {
        name: 'conversation.view',
        id: 'dsh-unknownue-plugins/tasks',
        order: 25,
        label: () => t('view.label'),
        locale: NS,
        registrant: 'dsh-unknownue-plugins',
      },
      () => React.createElement(TasksView, { t }),
    ),
  );
}
