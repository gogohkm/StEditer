export interface FileEntry {
    name: string;
    isDirectory: boolean;
    path: string;
    children?: FileEntry[];
}

export interface IElectronAPI {
    invoke(channel: 'dialog:openDirectory'): Promise<string | null>;
    invoke(channel: 'fs:readDirectory', path: string): Promise<FileEntry[]>;
    invoke(channel: 'fs:readFile', path: string): Promise<string | null>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    on(channel: string, listener: (...args: any[]) => void): void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    off(channel: string, listener: (...args: any[]) => void): void;
}

declare global {
    interface Window {
        ipcRenderer: IElectronAPI;
    }
}
