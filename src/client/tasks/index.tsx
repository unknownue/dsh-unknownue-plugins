/**
 * Task-board client half: registers the 任务 tab in conversation.view
 * (between 文件 and 论文) and its own 任务面板 settings section. Personal,
 * user-maintained — no agent-facing surface.
 */
import React from 'react';
import TasksView, { type TasksLocale } from './view';
import TasksSettings from './settings-page';
import stylesCss from './styles.css';

const NS = 'dsh-unknownue-plugins.tasks';

const zh: Record<string, string> = {
  'view.label': '任务',
  'settings.label': '任务面板',
  'mode.board': '看板',
  'mode.list': '列表',
  'board.new': '新建任务',
  'board.refresh': '刷新',
  'board.empty': '还没有任务。点「新建任务」开始。',
  'board.loadFailed': '加载失败：',
  'board.revision': '数据版本',
  'list.title': '标题',
  'list.status': '状态',
  'list.priority': '优先级',
  'list.due': '截止',
  'list.updated': '更新于',
  'list.actions': '操作',
  'list.edit': '编辑',
  'list.showArchived': '显示已归档',
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
  'editor.save': '保存',
  'editor.cancel': '取消',
  'editor.archive': '归档',
  'editor.restore': '恢复',
  'editor.delete': '删除',
  'editor.deleteConfirm': '确定永久删除该任务？此操作不可撤销。',
  'settings.title': '任务面板设置',
  'settings.hint': '个人任务看板的存储位置。数据库目录修改后需重启 dsh web 生效。',
  'settings.dataDir': '数据库目录 dataDir',
  'settings.settingsPath': '配置文件：',
  'settings.save': '保存',
  'settings.saved': '已保存。',
  'settings.restartRequired': '已保存。数据库位置改动将在重启 dsh web 后生效。',
  'settings.failed': '保存失败',
  'settings.loadFailed': '无法访问任务面板 host 路由（插件 host 未运行？）。',
};

const en: Record<string, string> = {
  'view.label': 'Tasks',
  'settings.label': 'Task board',
  'mode.board': 'Board',
  'mode.list': 'List',
  'board.new': 'New task',
  'board.refresh': 'Refresh',
  'board.empty': 'No tasks yet. Click "New task" to start.',
  'board.loadFailed': 'Failed to load:',
  'board.revision': 'Revision',
  'list.title': 'Title',
  'list.status': 'Status',
  'list.priority': 'Priority',
  'list.due': 'Due',
  'list.updated': 'Updated',
  'list.actions': 'Actions',
  'list.edit': 'Edit',
  'list.showArchived': 'Show archived',
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
  'editor.save': 'Save',
  'editor.cancel': 'Cancel',
  'editor.archive': 'Archive',
  'editor.restore': 'Restore',
  'editor.delete': 'Delete',
  'editor.deleteConfirm': 'Permanently delete this task? This cannot be undone.',
  'settings.title': 'Task board settings',
  'settings.hint': 'Storage location of your personal task board. Changing the database directory takes effect after a dsh web restart.',
  'settings.dataDir': 'Database directory (dataDir)',
  'settings.settingsPath': 'Settings file:',
  'settings.save': 'Save',
  'settings.saved': 'Saved.',
  'settings.restartRequired': 'Saved. The database location change takes effect after restarting dsh web.',
  'settings.failed': 'Save failed',
  'settings.loadFailed': 'Cannot reach the task board host routes (is the plugin host running?).',
};

function ensureStyles(): void {
  if (typeof document === 'undefined') return;
  const tagId = 'dsh-tasks/styles.css';
  const existing = document.querySelector(`style[data-plugin-css="${tagId}"]`);
  const tag = existing !== null ? existing : document.createElement('style');
  tag.setAttribute('data-plugin-css', tagId);
  tag.textContent = stylesCss;
  if (existing === null) document.head.appendChild(tag);
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

  ctx.slots.inject('settings.section', () =>
    ctx.slots.register(
      {
        name: 'settings.section',
        id: 'dsh-unknownue-plugins/tasks-settings',
        order: 46,
        label: () => t('settings.label'),
        locale: NS,
        registrant: 'dsh-unknownue-plugins',
      },
      () => React.createElement(TasksSettings, { t }),
    ),
  );
}
