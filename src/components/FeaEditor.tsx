
import { useEffect, useState } from 'react';
import { FeaModel, FeaNode, FeaElement, FeaAnalysisResult, FeaLoad } from '../lib/fea/types';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Line } from '@react-three/drei';
import { useEditorStore } from '../stores/editorStore';

interface FeaEditorProps {
    content: string | ArrayBuffer;
    filePath: string;
}

export function FeaEditor({ content, filePath }: FeaEditorProps) {
    const [model, setModel] = useState<FeaModel>({ nodes: [], elements: [], loads: [] });

    // Modes: MODELING, APP_ANALYSIS_RESULT
    const [mode, setMode] = useState<'MODELING' | 'ANALYSIS_RESULT'>('MODELING');

    // Tools: SELECT, NODE, ELEMENT
    const [activeTool, setActiveTool] = useState<'SELECT' | 'NODE' | 'ELEMENT'>('SELECT');
    const [selectedItems, setSelectedItems] = useState<{ type: 'node' | 'element', id: number }[]>([]);

    // For Element creation: track the first node clicked
    const [tempNodeId, setTempNodeId] = useState<number | null>(null);

    // Analysis Results
    const [analysisResult, setAnalysisResult] = useState<FeaAnalysisResult | null>(null);
    const [deformationScale, setDeformationScale] = useState<number>(100);

    // Parse content on load
    useEffect(() => {
        if (typeof content === 'string' && content.length > 0) {
            try {
                const parsed = JSON.parse(content);
                // Check if this is a result file
                if (parsed.analysisResult) {
                    setModel(parsed); // parsed should contain full model + result
                    setAnalysisResult(parsed.analysisResult);
                    setMode('ANALYSIS_RESULT');
                } else {
                    setModel(parsed.nodes ? parsed : { nodes: [], elements: [], loads: [] });
                    setAnalysisResult(null);
                    setMode('MODELING');
                }
            } catch (e) {
                console.error("Failed to parse FEA model", e);
                setModel({ nodes: [], elements: [], loads: [] });
            }
        } else {
            setModel({ nodes: [], elements: [], loads: [] });
        }
    }, [content]);

    const handleSave = async () => {
        const jsonString = JSON.stringify(model, null, 2);
        await window.ipcRenderer.invoke('fs:writeFile', { path: filePath, content: jsonString });
        alert('Model Saved!');
    };

    const { openFile } = useEditorStore();

    const handleRunAnalysis = async () => {
        try {
            const result = await window.ipcRenderer.invoke('fea:run', model);
            console.log("Analysis Result:", result);
            if (result.error) throw new Error(result.error);

            // Construct result object (Model + Result)
            const resultModel = {
                ...model,
                analysisResult: result
            };

            // Save to new file
            const resultPath = filePath.endsWith('.fea')
                ? filePath.replace('.fea', '.result.fea')
                : filePath + '.result.fea';

            await window.ipcRenderer.invoke('fs:writeFile', {
                path: resultPath,
                content: JSON.stringify(resultModel, null, 2)
            });

            if (confirm('Analysis Complete. Result saved to ' + resultPath.split('/').pop() + '\nOpen result file now?')) {
                openFile(resultPath);
            }
        } catch (e) {
            console.error(e);
            alert("Analysis Failed: " + String(e));
        }
    };

    const nextId = (list: { id: number }[]) => list.length > 0 ? Math.max(...list.map(i => i.id)) + 1 : 1;

    // Canvas Interaction Handlers
    const handlePlaneClick = (e: any) => {
        if (mode === 'ANALYSIS_RESULT') {
            setSelectedItems([]);
            return;
        }

        if (activeTool === 'NODE') {
            e.stopPropagation();
            const point = e.point;
            const newNode: FeaNode = {
                id: nextId(model.nodes),
                x: Math.round(point.x * 100) / 100,
                y: Math.round(point.y * 100) / 100,
                z: 0
            };
            setModel(prev => ({
                ...prev,
                nodes: [...prev.nodes, newNode]
            }));
        } else if (activeTool === 'SELECT') {
            setSelectedItems([]);
        }
    };

    const handleNodeClick = (e: any, nodeId: number) => {
        e.stopPropagation();

        // In Analysis Mode, only selection allowed
        if (mode === 'ANALYSIS_RESULT') {
            setSelectedItems([{ type: 'node', id: nodeId }]);
            return;
        }

        if (activeTool === 'SELECT') {
            const isSelected = selectedItems.find(i => i.type === 'node' && i.id === nodeId);
            if (e.shiftKey) {
                if (isSelected) {
                    setSelectedItems(prev => prev.filter(i => !(i.type === 'node' && i.id === nodeId)));
                } else {
                    setSelectedItems(prev => [...prev, { type: 'node', id: nodeId }]);
                }
            } else {
                setSelectedItems([{ type: 'node', id: nodeId }]);
            }
        } else if (activeTool === 'ELEMENT') {
            if (tempNodeId === null) {
                setTempNodeId(nodeId);
            } else {
                if (tempNodeId === nodeId) return;
                const newElement: FeaElement = {
                    id: nextId(model.elements),
                    type: 'ElasticBeamColumn',
                    nodes: [tempNodeId, nodeId],
                    A: 1, E: 200000, Iz: 1000
                };
                setModel(prev => ({
                    ...prev,
                    elements: [...prev.elements, newElement]
                }));
                setTempNodeId(null);
            }
        }
    };

    const handleElementClick = (e: any, elementId: number) => {
        e.stopPropagation();
        setSelectedItems([{ type: 'element', id: elementId }]);
    }

    // Helper to get node position (deformed or undeformed)
    const getNodePos = (node: FeaNode, deformed: boolean = false): [number, number, number] => {
        if (deformed && analysisResult && analysisResult.nodeDisplacements[node.id]) {
            const disp = analysisResult.nodeDisplacements[node.id];
            return [
                node.x + disp[0] * deformationScale,
                node.y + disp[1] * deformationScale,
                (node.z || 0)
            ];
        }
        return [node.x, node.y, node.z || 0];
    };

    return (
        <div className="flex h-full w-full bg-neutral-900 text-white font-sans select-none">
            {/* Toolbar */}
            <div className="w-16 border-r border-neutral-700 flex flex-col items-center py-4 gap-2 bg-neutral-800">
                {mode === 'MODELING' && (
                    <>
                        <div className="text-[10px] font-bold text-neutral-500 mb-2">TOOLS</div>
                        <button
                            className={`p-2 rounded w-10 h-10 flex items-center justify-center transition-colors ${activeTool === 'SELECT' ? 'bg-blue-600' : 'bg-neutral-700 hover:bg-neutral-600'}`}
                            title="Select (S)"
                            onClick={() => { setActiveTool('SELECT'); setTempNodeId(null); }}
                        >
                            S
                        </button>
                        <button
                            className={`p-2 rounded w-10 h-10 flex items-center justify-center transition-colors ${activeTool === 'NODE' ? 'bg-blue-600' : 'bg-neutral-700 hover:bg-neutral-600'}`}
                            title="Add Node (N)"
                            onClick={() => { setActiveTool('NODE'); setTempNodeId(null); }}
                        >
                            N
                        </button>
                        <button
                            className={`p-2 rounded w-10 h-10 flex items-center justify-center transition-colors ${activeTool === 'ELEMENT' ? 'bg-blue-600' : 'bg-neutral-700 hover:bg-neutral-600'}`}
                            title="Add Element (E)"
                            onClick={() => { setActiveTool('ELEMENT'); setTempNodeId(null); }}
                        >
                            E
                        </button>

                        <div className="w-8 h-[1px] bg-neutral-600 my-2"></div>

                        <button
                            className="p-2 rounded w-10 h-10 flex items-center justify-center bg-green-700 hover:bg-green-600"
                            title="Run Analysis"
                            onClick={handleRunAnalysis}
                        >
                            ▶
                        </button>
                    </>
                )}
                {mode === 'ANALYSIS_RESULT' && (
                    <>
                        <div className="text-[10px] font-bold text-green-500 mb-2">RESULT</div>
                        <button
                            className="p-2 rounded w-10 h-10 flex items-center justify-center bg-neutral-700 hover:bg-neutral-600"
                            title="Back to Modeling"
                            onClick={() => setMode('MODELING')}
                        >
                            ←
                        </button>
                    </>
                )}
                <div className="mt-auto mb-2">
                    <button
                        className="p-2 rounded w-10 h-10 flex items-center justify-center bg-neutral-700 hover:bg-neutral-600"
                        title="Save"
                        onClick={handleSave}
                    >
                        💾
                    </button>
                </div>
            </div>

            {/* Main Canvas Area */}
            <div className="flex-1 relative bg-[#1e1e1e]">
                <div className="absolute top-4 left-4 z-10 pointer-events-none">
                    <div className="text-xs text-neutral-400">
                        Mode: <span className={mode === 'ANALYSIS_RESULT' ? "text-green-400 font-bold" : "text-white font-bold"}>{mode}</span>
                        {mode === 'MODELING' && <span className="ml-2">Tool: {activeTool}</span>}
                        {tempNodeId && <span className="ml-2 text-yellow-400">(Select 2nd Node)</span>}
                    </div>
                </div>

                {mode === 'ANALYSIS_RESULT' && (
                    <div className="absolute bottom-4 left-4 z-10 bg-neutral-800 p-2 rounded border border-neutral-700 w-48">
                        <div className="text-xs font-bold text-neutral-400 mb-1">Deformation Scale: {deformationScale}</div>
                        <input
                            type="range"
                            min="0" max="500" step="10"
                            value={deformationScale}
                            onChange={(e) => setDeformationScale(Number(e.target.value))}
                            className="w-full"
                        />
                    </div>
                )}

                <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
                    <color attach="background" args={['#1e1e1e']} />
                    <ambientLight intensity={0.5} />
                    <pointLight position={[10, 10, 10]} />

                    <Grid infiniteGrid fadeDistance={50} cellColor={'#444'} sectionColor={'#666'} />
                    <OrbitControls makeDefault />

                    {/* Interaction Plane */}
                    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} onClick={handlePlaneClick}>
                        <planeGeometry args={[100, 100]} />
                        <meshBasicMaterial visible={false} />
                    </mesh>

                    {/* Render Nodes */}
                    {model.nodes.map((node) => {
                        const isSelected = selectedItems.some(i => i.type === 'node' && i.id === node.id);
                        const isTemp = tempNodeId === node.id;
                        const pos = getNodePos(node, mode === 'ANALYSIS_RESULT');

                        return (
                            <mesh
                                key={node.id}
                                position={pos}
                                onClick={(e) => handleNodeClick(e, node.id)}
                            >
                                <sphereGeometry args={[isSelected || isTemp ? 0.15 : 0.1]} />
                                <meshStandardMaterial color={isTemp ? 'yellow' : (isSelected ? 'orange' : '#aaa')} />
                            </mesh>
                        );
                    })}

                    {/* Render Elements */}
                    {model.elements.map((el) => {
                        const n1 = model.nodes.find(n => n.id === el.nodes[0]);
                        const n2 = model.nodes.find(n => n.id === el.nodes[1]);
                        if (!n1 || !n2) return null;

                        const start = getNodePos(n1, mode === 'ANALYSIS_RESULT');
                        const end = getNodePos(n2, mode === 'ANALYSIS_RESULT');
                        const isSelected = selectedItems.some(i => i.type === 'element' && i.id === el.id);

                        return (
                            <>
                                {/* Undeformed ghost (only in analysis mode) */}
                                {mode === 'ANALYSIS_RESULT' && (
                                    <Line
                                        points={[
                                            (getNodePos(n1, false) as [number, number, number]),
                                            (getNodePos(n2, false) as [number, number, number])
                                        ]}
                                        color="#444"
                                        lineWidth={1}
                                        dashed
                                    />
                                )}
                                <Line
                                    key={el.id}
                                    points={[start, end]}
                                    color={isSelected ? 'cyan' : (mode === 'ANALYSIS_RESULT' ? '#00ff00' : 'white')}
                                    lineWidth={isSelected ? 3 : 1}
                                    onClick={(e: any) => handleElementClick(e, el.id)}
                                />
                            </>
                        )
                    })}
                </Canvas>
            </div>

            {/* Properties Panel */}
            <div className="w-72 border-l border-neutral-700 bg-neutral-800 p-4 overflow-y-auto">
                <h3 className="text-sm font-bold text-neutral-400 mb-4 border-b border-neutral-600 pb-2">PROPERTIES</h3>

                {selectedItems.length === 0 ? (
                    <div className="text-xs text-neutral-500">
                        {mode === 'ANALYSIS_RESULT' ?
                            "Select a node to view displacements." :
                            "Select an item to view properties."
                        }
                    </div>
                ) : (
                    <div className="space-y-4">
                        {selectedItems.map((item) => (
                            <div key={`${item.type}-${item.id}`} className="p-2 bg-neutral-700 rounded mb-2">
                                <div className="text-xs font-bold text-blue-400 uppercase mb-2">{item.type} #{item.id}</div>
                                {item.type === 'node' && (
                                    <div className="space-y-4 text-xs">
                                        {/* Result Display */}
                                        {mode === 'ANALYSIS_RESULT' && analysisResult && analysisResult.nodeDisplacements[item.id] && (
                                            <div className="mb-2 p-2 bg-black/30 rounded border border-green-900">
                                                <div className="font-bold text-green-400 mb-1">Displacements</div>
                                                <div className="grid grid-cols-2 gap-1 text-neutral-300">
                                                    <span>DX:</span> <span>{analysisResult.nodeDisplacements[item.id][0].toExponential(3)}</span>
                                                    <span>DY:</span> <span>{analysisResult.nodeDisplacements[item.id][1].toExponential(3)}</span>
                                                    <span>RZ:</span> <span>{analysisResult.nodeDisplacements[item.id][2].toExponential(3)}</span>
                                                </div>
                                            </div>
                                        )}

                                        {(() => {
                                            const n = model.nodes.find(n => n.id === item.id);
                                            if (!n) return null;

                                            const nodeLoads = model.loads.filter(l => l.node === n.id);

                                            return (
                                                <>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <label>X:</label> <input type="number" disabled={mode === 'ANALYSIS_RESULT'} className="bg-neutral-900 border border-neutral-600 rounded px-1 w-full disabled:opacity-50" value={n.x} onChange={e => {
                                                            const val = parseFloat(e.target.value);
                                                            setModel(prev => ({
                                                                ...prev,
                                                                nodes: prev.nodes.map(node => node.id === n.id ? { ...node, x: val } : node)
                                                            }))
                                                        }} />
                                                        <label>Y:</label> <input type="number" disabled={mode === 'ANALYSIS_RESULT'} className="bg-neutral-900 border border-neutral-600 rounded px-1 w-full disabled:opacity-50" value={n.y} onChange={e => {
                                                            const val = parseFloat(e.target.value);
                                                            setModel(prev => ({
                                                                ...prev,
                                                                nodes: prev.nodes.map(node => node.id === n.id ? { ...node, y: val } : node)
                                                            }))
                                                        }} />
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-2 border-b border-neutral-600 pb-2">
                                                        <input type="checkbox" disabled={mode === 'ANALYSIS_RESULT'} checked={!!n.fix} onChange={(e) => {
                                                            setModel(prev => ({
                                                                ...prev,
                                                                nodes: prev.nodes.map(node => node.id === n.id ? { ...node, fix: e.target.checked ? [1, 1, 1] : undefined } : node)
                                                            }))
                                                        }} />
                                                        <span>Fixed Support</span>
                                                    </div>

                                                    {/* Loads Section */}
                                                    <div className="mt-2">
                                                        <div className="flex justify-between items-center mb-1">
                                                            <span className="font-bold text-neutral-400">Loads</span>
                                                            <button
                                                                className="px-1 bg-green-700 rounded text-[10px] hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                disabled={mode === 'ANALYSIS_RESULT'}
                                                                onClick={() => {
                                                                    const newLoad: FeaLoad = {
                                                                        id: nextId(model.loads),
                                                                        type: 'Nodal',
                                                                        node: n.id,
                                                                        value: [0, -10, 0] // Default Fy = -10
                                                                    };
                                                                    setModel(prev => ({ ...prev, loads: [...prev.loads, newLoad] }));
                                                                }}
                                                            >
                                                                + Add
                                                            </button>
                                                        </div>
                                                        {nodeLoads.length === 0 ? (
                                                            <div className="text-neutral-600 italic">No loads</div>
                                                        ) : (
                                                            nodeLoads.map(load => (
                                                                <div key={load.id} className="bg-neutral-800 p-2 rounded mb-1 border border-neutral-700">
                                                                    <div className="flex justify-between text-[10px] mb-1">
                                                                        <span>Load #{load.id}</span>
                                                                        <button
                                                                            className="text-red-500 hover:text-red-400"
                                                                            disabled={mode === 'ANALYSIS_RESULT'}
                                                                            onClick={() => setModel(prev => ({ ...prev, loads: prev.loads.filter(l => l.id !== load.id) }))}
                                                                        >
                                                                            ✕
                                                                        </button>
                                                                    </div>
                                                                    <div className="grid grid-cols-3 gap-1">
                                                                        <div>
                                                                            <span className="text-[9px] text-neutral-500">Fx</span>
                                                                            <input type="number" disabled={mode === 'ANALYSIS_RESULT'} className="w-full bg-neutral-900 border border-neutral-600 rounded px-1 text-[10px]" value={load.value[0]}
                                                                                onChange={e => {
                                                                                    const v = parseFloat(e.target.value);
                                                                                    setModel(prev => ({ ...prev, loads: prev.loads.map(l => l.id === load.id ? { ...l, value: [v, l.value[1], l.value[2]] } : l) }));
                                                                                }}
                                                                            />
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-[9px] text-neutral-500">Fy</span>
                                                                            <input type="number" disabled={mode === 'ANALYSIS_RESULT'} className="w-full bg-neutral-900 border border-neutral-600 rounded px-1 text-[10px]" value={load.value[1]}
                                                                                onChange={e => {
                                                                                    const v = parseFloat(e.target.value);
                                                                                    setModel(prev => ({ ...prev, loads: prev.loads.map(l => l.id === load.id ? { ...l, value: [l.value[0], v, l.value[2]] } : l) }));
                                                                                }}
                                                                            />
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-[9px] text-neutral-500">Mz</span>
                                                                            <input type="number" disabled={mode === 'ANALYSIS_RESULT'} className="w-full bg-neutral-900 border border-neutral-600 rounded px-1 text-[10px]" value={load.value[2]}
                                                                                onChange={e => {
                                                                                    const v = parseFloat(e.target.value);
                                                                                    setModel(prev => ({ ...prev, loads: prev.loads.map(l => l.id === load.id ? { ...l, value: [l.value[0], l.value[1], v] } : l) }));
                                                                                }}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </>
                                            )
                                        })()}
                                    </div>
                                )}
                                {item.type === 'element' && (
                                    <div className="text-xs">
                                        Element properties...
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
