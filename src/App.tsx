import { MainLayout } from './layouts/MainLayout';
import { Sidebar } from './components/Sidebar';
import { AIPanel } from './components/AIPanel';
import { EditorArea } from './components/EditorArea';
import { TabBar } from './components/TabBar';

function App() {
  return (
    <MainLayout
      sidebar={<Sidebar />}
      aiPanel={<AIPanel />}
    >
      <div className="flex flex-col h-full w-full">
        <TabBar />
        <div className="flex-1 min-h-0">
          <EditorArea />
        </div>
      </div>
    </MainLayout>
  )
}

export default App
