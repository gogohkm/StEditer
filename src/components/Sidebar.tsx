
import { useState } from 'react';
import { FolderOpen, FileText, ChevronRight, ChevronDown, Folder } from 'lucide-react';
import { cn } from '../lib/utils';
import { FileEntry } from '../types/electron';
import { useEditorStore } from '../stores/editorStore';

interface FileTreeItemProps {
    entry: FileEntry;
    level: number;
}

function FileTreeItem({ entry, level }: FileTreeItemProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [children, setChildren] = useState<FileEntry[]>([]);
    const { openFile } = useEditorStore();

    const handleClick = async () => {
        if (!entry.isDirectory) {
            openFile(entry.path);
            return;
        }

        if (!isOpen) {
            if (children.length === 0) {
                // Load children
                const entries = await window.ipcRenderer.invoke('fs:readDirectory', entry.path);
                // Sort: folders first, then files
                entries.sort((a: FileEntry, b: FileEntry) => {
                    if (a.isDirectory === b.isDirectory) {
                        return a.name.localeCompare(b.name);
                    }
                    return a.isDirectory ? -1 : 1;
                });
                setChildren(entries);
            }
        }
        setIsOpen(!isOpen);
    };

    return (
        <div>
            <div
                className={cn(
                    "flex items-center gap-1 py-1 px-2 hover:bg-neutral-200 dark:hover:bg-neutral-800 cursor-pointer text-sm select-none",
                    !entry.isDirectory && "ml-4" // Indent files a bit more to align with folder icons
                )}
                style={{ paddingLeft: `${level * 12 + 8}px` }}
                onClick={handleClick}
            >
                {entry.isDirectory && (
                    <span className="text-neutral-400">
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                )}
                {entry.isDirectory ? (
                    <Folder size={14} className="text-blue-500" />
                ) : (
                    <FileText size={14} className="text-neutral-500" />
                )}
                <span className="truncate">{entry.name}</span>
            </div>
            {isOpen && entry.isDirectory && (
                <div>
                    {children.map((child) => (
                        <FileTreeItem key={child.path} entry={child} level={level + 1} />
                    ))}
                </div>
            )}
        </div>
    );
}

export function Sidebar() {
    const [rootPath, setRootPath] = useState<string | null>(null);
    const [files, setFiles] = useState<FileEntry[]>([]);

    const handleOpenFolder = async () => {
        const path = await window.ipcRenderer.invoke('dialog:openDirectory');
        if (path) {
            setRootPath(path);
            const entries = await window.ipcRenderer.invoke('fs:readDirectory', path);
            // Sort: folders first, then files
            entries.sort((a: FileEntry, b: FileEntry) => {
                if (a.isDirectory === b.isDirectory) {
                    return a.name.localeCompare(b.name);
                }
                return a.isDirectory ? -1 : 1;
            });
            setFiles(entries);
        }
    };

    return (
        <div className="h-full flex flex-col">
            <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-neutral-500">Explorer</span>
                <button
                    onClick={handleOpenFolder}
                    className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded transition-colors text-neutral-600 dark:text-neutral-400"
                    title="Open Folder"
                >
                    <FolderOpen size={16} />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto">
                {!rootPath ? (
                    <div className="p-4 text-center">
                        <p className="text-sm text-neutral-500 italic">Open a project folder to view files</p>
                        <button
                            onClick={handleOpenFolder}
                            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors"
                        >
                            Open Folder
                        </button>
                    </div>
                ) : (
                    <div className="py-2">
                        <div className="px-3 pb-2 text-xs font-bold text-neutral-500 uppercase truncate">
                            {rootPath.split('/').pop()}
                        </div>
                        {files.map((file) => (
                            <FileTreeItem key={file.path} entry={file} level={0} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
