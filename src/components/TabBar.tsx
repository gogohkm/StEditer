import { X } from 'lucide-react';
import { useEditorStore } from '../stores/editorStore';
import { cn } from '../lib/utils';

export function TabBar() {
    const { openFiles, activeFilePath, setActiveFile, closeFile } = useEditorStore();

    if (openFiles.length === 0) return null;

    return (
        <div className="flex bg-neutral-100 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 overflow-x-auto no-scrollbar">
            {openFiles.map((path) => {
                const fileName = path.split('/').pop() || path;
                const isActive = path === activeFilePath;

                return (
                    <div
                        key={path}
                        onClick={() => setActiveFile(path)}
                        className={cn(
                            "group flex items-center gap-2 px-3 py-2 text-sm border-r border-neutral-200 dark:border-neutral-800 cursor-pointer select-none min-w-[120px] max-w-[200px]",
                            isActive
                                ? "bg-white dark:bg-neutral-950 text-blue-600 dark:text-blue-400 border-t-2 border-t-blue-500"
                                : "bg-neutral-100 dark:bg-neutral-900 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800 border-t-2 border-t-transparent"
                        )}
                    >
                        <span className="truncate flex-1">{fileName}</span>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                closeFile(path);
                            }}
                            className={cn(
                                "p-0.5 rounded-sm opacity-0 group-hover:opacity-100 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all",
                                isActive && "opacity-100"
                            )}
                        >
                            <X size={12} />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
