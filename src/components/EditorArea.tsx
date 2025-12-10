import { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { useEditorStore } from '../stores/editorStore';
import { CadViewer } from './CadViewer';
import { FeaEditor } from './FeaEditor';

export function EditorArea() {
    const { activeFilePath } = useEditorStore();
    const [content, setContent] = useState<string>('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const loadContent = async () => {
            if (!activeFilePath) return;
            setLoading(true);
            try {
                const fileContent = await window.ipcRenderer.invoke('fs:readFile', activeFilePath);
                setContent(fileContent || '');
            } catch (error) {
                console.error('Failed to load file:', error);
                setContent('Error loading file');
            } finally {
                setLoading(false);
            }
        };

        loadContent();
    }, [activeFilePath]);

    if (!activeFilePath) {
        return (
            <div className="h-full flex items-center justify-center bg-dots-neutral-300/[0.2] dark:bg-dots-neutral-700/[0.2]">
                <div className="text-center space-y-4">
                    <div className="inline-block p-4 bg-blue-50 dark:bg-blue-900/10 rounded-full mb-4">
                        <div className="w-16 h-16 border-4 border-blue-500 rounded-lg flex items-center justify-center">
                            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">St</span>
                        </div>
                    </div>
                    <p className="text-neutral-500">Select a file to view</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return <div className="h-full flex items-center justify-center text-neutral-500">Loading...</div>;
    }

    // Determine file type based on extension
    const extension = activeFilePath.split('.').pop()?.toLowerCase();

    // Handle DXF files
    if (extension === 'dxf') {
        return <CadViewer content={content} />;
    }

    // Handle FEA files
    if (extension === 'fea') {
        return <FeaEditor content={content} filePath={activeFilePath} />;
    }

    let language = 'plaintext';
    if (extension === 'ts' || extension === 'tsx') language = 'typescript';
    if (extension === 'js' || extension === 'jsx') language = 'javascript';
    if (extension === 'json') language = 'json';
    if (extension === 'html') language = 'html';
    if (extension === 'css') language = 'css';
    if (extension === 'md') language = 'markdown';
    if (extension === 'py') language = 'python';

    return (
        <div className="h-full w-full">
            <Editor
                height="100%"
                language={language}
                value={content}
                theme="vs-dark"
                options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    wordWrap: 'on',
                    readOnly: true // Read-only for now as we don't have save logic yet
                }}
            />
        </div>
    );
}
