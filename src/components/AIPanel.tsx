import { Bot, Send } from 'lucide-react';

export function AIPanel() {
    return (
        <div className="h-full flex flex-col">
            <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-2 bg-neutral-50 dark:bg-neutral-900">
                <Bot size={16} className="text-blue-500" />
                <span className="font-semibold text-xs uppercase tracking-wide text-neutral-600 dark:text-neutral-300">Engineering Assistant</span>
            </div>
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
                <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                        <Bot size={16} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="bg-white dark:bg-neutral-800 p-3 rounded-lg rounded-tl-none shadow-sm border border-neutral-100 dark:border-neutral-700 text-sm max-w-[85%]">
                        <p>Hello! I'm ready to help with your structural engineering tasks. You can ask me about codes, analyze open files, or calculate reinforcement.</p>
                    </div>
                </div>
            </div>
            <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Ask a question..."
                        className="w-full bg-neutral-100 dark:bg-neutral-800 border-none rounded-md py-2 pl-3 pr-10 text-sm focus:ring-1 focus:ring-blue-500 outline-none text-neutral-900 dark:text-neutral-100 placeholder-neutral-500"
                    />
                    <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-blue-500 transition-colors">
                        <Send size={14} />
                    </button>
                </div>
            </div>
        </div>
    )
}
