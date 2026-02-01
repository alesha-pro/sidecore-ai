import type { TabInfo } from '../../lib/tabs';

interface TabItemProps {
  tab: TabInfo;
  isSelected: boolean;
  isActive: boolean;
  onClick: () => void;
}

export function TabItem({ tab, isSelected, isActive, onClick }: TabItemProps) {
  return (
    <li
      role="option"
      aria-selected={isSelected}
      onClick={onClick}
      className={`px-3 py-2 cursor-pointer hover:bg-gray-100 ${
        isSelected ? 'bg-blue-50' : ''
      } ${isActive ? 'bg-gray-100' : ''}`}
    >
      <div className="flex items-center gap-2">
        {tab.favIconUrl ? (
          <img
            src={tab.favIconUrl}
            alt=""
            className="w-4 h-4 flex-shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-4 h-4 flex-shrink-0 bg-gray-200 rounded" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm truncate">{tab.title}</div>
          <div className="text-xs text-gray-500 truncate">{tab.url}</div>
        </div>
        {isSelected && (
          <span className="text-blue-600 flex-shrink-0" aria-hidden="true">&#10003;</span>
        )}
      </div>
    </li>
  );
}
