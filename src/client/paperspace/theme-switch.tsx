/**
 * Compact 3-way switch for the paperspace-local theme: 跟随 / 浅色 / 深色.
 * Shown in both the paper library header and the reader header so the
 * reading surface can be flipped without leaving the tab.
 */
import type { PaperspaceTheme } from './theme';

const OPTIONS: Array<{ id: PaperspaceTheme; label: string; title: string }> = [
  { id: 'auto', label: '跟随', title: '跟随 DSH 主题' },
  { id: 'light', label: '浅色', title: '论文 tab 始终浅色' },
  { id: 'dark', label: '深色', title: '论文 tab 始终深色' },
];

export default function ThemeSwitch({
  value,
  onChange,
}: {
  value: PaperspaceTheme;
  onChange: (next: PaperspaceTheme) => void;
}) {
  return (
    <div className="theme-switch" role="group" aria-label="论文主题">
      {OPTIONS.map(option => (
        <button
          key={option.id}
          type="button"
          title={option.title}
          aria-pressed={value === option.id}
          className={'theme-switch-item' + (value === option.id ? ' active' : '')}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
