import { create } from 'zustand';

interface EditorState {
    activeFilePath: string | null;
    openFiles: string[]; // List of file paths
    openFile: (path: string) => void;
    closeFile: (path: string) => void;
    setActiveFile: (path: string) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
    activeFilePath: null,
    openFiles: [],
    openFile: (path) => set((state) => {
        if (!state.openFiles.includes(path)) {
            return {
                openFiles: [...state.openFiles, path],
                activeFilePath: path
            };
        }
        return { activeFilePath: path };
    }),
    closeFile: (path) => set((state) => {
        const newOpenFiles = state.openFiles.filter((p) => p !== path);
        // If we closed the active file, switch to the last one or null
        const newActiveFile = state.activeFilePath === path
            ? (newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1] : null)
            : state.activeFilePath;

        return {
            openFiles: newOpenFiles,
            activeFilePath: newActiveFile
        };
    }),
    setActiveFile: (path) => set({ activeFilePath: path }),
}));
