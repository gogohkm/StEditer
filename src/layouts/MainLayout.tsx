import { ReactNode } from 'react';

interface MainLayoutProps {
    sidebar: ReactNode;
    aiPanel: ReactNode;
    children: ReactNode;
}

export function MainLayout({ sidebar, aiPanel, children }: MainLayoutProps) {
    return (
        <div className="flex h-screen w-screen overflow-hidden bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">

            {/* Sidebar */}
            <aside className="w-64 border-r border-neutral-200 dark:border-neutral-800 flex-shrink-0 flex flex-col bg-neutral-100 dark:bg-neutral-900 transition-all">
                {sidebar}
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-neutral-950 relative">
                {children}
            </main>

            {/* AI Panel */}
            <aside className="w-80 border-l border-neutral-200 dark:border-neutral-800 flex-shrink-0 flex flex-col bg-neutral-50 dark:bg-neutral-900">
                {aiPanel}
            </aside>
        </div>
    );
}
