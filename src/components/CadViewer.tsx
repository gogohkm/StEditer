import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import DxfParser from 'dxf-parser';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { parseDwg } from '../lib/dwgParser';

interface CadViewerProps {
    content: string | ArrayBuffer;
    fileType: 'dxf' | 'dwg';
}

export function CadViewer({ content, fileType }: CadViewerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!containerRef.current || !content) return;

        let entities: any[] = []; // Use a common structure or any for simplicity in this bridge

        const parseContent = async () => {
            try {
                if (fileType === 'dxf') {
                    if (typeof content !== 'string') {
                        throw new Error('DXF content must be a string');
                    }
                    const parser = new DxfParser();
                    const dxf = parser.parseSync(content);
                    if (dxf && dxf.entities) {
                        entities = dxf.entities;
                    }
                } else if (fileType === 'dwg') {
                    if (typeof content === 'string') {
                        throw new Error('DWG content must be an ArrayBuffer');
                    }
                    const parsed = await parseDwg(content);
                    if (parsed && parsed.entities) {
                        entities = parsed.entities;
                    }
                }

                renderScene(entities);

            } catch (err) {
                console.error("CAD Parse Error", err);
                setError(`Failed to parse ${fileType.toUpperCase()} file.`);
            }
        };

        parseContent();

        function renderScene(entities: any[]) {
            if (!containerRef.current) return;

            // Setup Three.js Scene
            const scene = new THREE.Scene();
            scene.background = new THREE.Color(0x222222); // Dark background for CAD

            const width = containerRef.current.clientWidth;
            const height = containerRef.current.clientHeight;

            // Orthographic camera is better for 2D CAD
            const aspect = width / height;
            const viewSize = 1000;
            const camera = new THREE.OrthographicCamera(
                -viewSize * aspect / 2, viewSize * aspect / 2,
                viewSize / 2, -viewSize / 2,
                0.1, 100000
            );
            camera.position.z = 1000;

            const renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(width, height);
            containerRef.current.innerHTML = ''; // Clear previous
            containerRef.current.appendChild(renderer.domElement);

            const controls = new OrbitControls(camera, renderer.domElement);
            controls.enableRotate = false; // 2D mode
            controls.screenSpacePanning = true;
            controls.mouseButtons = {
                LEFT: THREE.MOUSE.PAN,
                MIDDLE: THREE.MOUSE.DOLLY,
                RIGHT: THREE.MOUSE.PAN
            }

            const material = new THREE.LineBasicMaterial({ color: 0xffffff });
            const group = new THREE.Group();

            // Render Entities
            entities.forEach((entity: any) => {
                // Unified rendering logic attempt
                // Check if it's our CadEntity (from dwgParser) or DxfParser entity

                // LINE
                if (entity.type === 'LINE') {
                    const v = entity.vertices;
                    if (v && v.length >= 2) {
                        const points = [
                            new THREE.Vector3(v[0].x, v[0].y, v[0].z || 0),
                            new THREE.Vector3(v[1].x, v[1].y, v[1].z || 0)
                        ];
                        const geometry = new THREE.BufferGeometry().setFromPoints(points);
                        const line = new THREE.Line(geometry, material);
                        group.add(line);
                    }
                }
                // LWPOLYLINE / POLYLINE
                else if (entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') {
                    if (entity.vertices && entity.vertices.length > 0) {
                        const points = entity.vertices.map((v: any) => new THREE.Vector3(v.x, v.y, v.z || 0));
                        if (entity.shape || entity.isClosed) { // Closed loop (dwgParser uses 'shape', dxf uses 'isClosed' sometimes or flag)
                            points.push(points[0]);
                        }
                        const geometry = new THREE.BufferGeometry().setFromPoints(points);
                        const line = new THREE.Line(geometry, material);
                        group.add(line);
                    }
                }
                // CIRCLE
                else if (entity.type === 'CIRCLE') {
                    const curve = new THREE.EllipseCurve(
                        entity.center.x, entity.center.y,
                        entity.radius, entity.radius,
                        0, 2 * Math.PI,
                        false,
                        0
                    );
                    const points = curve.getPoints(64);
                    const geometry = new THREE.BufferGeometry().setFromPoints(points);
                    const line = new THREE.Line(geometry, material);
                    group.add(line);
                }
                // ARC
                else if (entity.type === 'ARC') {
                    const curve = new THREE.EllipseCurve(
                        entity.center.x, entity.center.y,
                        entity.radius, entity.radius,
                        entity.startAngle, entity.endAngle,
                        false,
                        0
                    );
                    const points = curve.getPoints(64);
                    const geometry = new THREE.BufferGeometry().setFromPoints(points);
                    const line = new THREE.Line(geometry, material);
                    group.add(line);
                }
                // ELLIPSE (Mapped from DWG Parser)
                else if (entity.type === 'ELLIPSE') {
                    // Start/End angle might be different in param
                    const curve = new THREE.EllipseCurve(
                        entity.center.x, entity.center.y,
                        Math.sqrt(Math.pow(entity.majorAxisEndPoint.x, 2) + Math.pow(entity.majorAxisEndPoint.y, 2)), // xRadius roughly
                        Math.sqrt(Math.pow(entity.majorAxisEndPoint.x, 2) + Math.pow(entity.majorAxisEndPoint.y, 2)) * entity.axisRatio, // yRadius
                        entity.startAngle, entity.endAngle,
                        false,
                        0 // Rotate ellipse if needed - simplistic
                    );
                    // Rotation handling is complex for EllipseCurve in threejs basic usage, simplifing
                    // If explicit rotation is needed, better to rotate the object or points
                    const points = curve.getPoints(64);
                    // TODO: Apply rotation if majorAxis isn't aligned
                    const geometry = new THREE.BufferGeometry().setFromPoints(points);
                    const line = new THREE.Line(geometry, material);
                    group.add(line);
                }
                // TEXT (Simple placeholder)
                else if (entity.type === 'TEXT' || entity.type === 'MTEXT') {
                    // TODO: Implement text rendering if needed. Complex in 3D.
                }
            });

            // Auto-center geometry
            const box = new THREE.Box3().setFromObject(group);
            if (!box.isEmpty()) {
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());

                group.position.x = -center.x;
                group.position.y = -center.y;
                scene.add(group);

                // Add axes helper
                const axesHelper = new THREE.AxesHelper(100);
                scene.add(axesHelper);

                // Adjust camera to fit
                const maxDim = Math.max(size.x, size.y);
                const fitFactor = 1.2;
                const newViewSize = maxDim > 0 ? maxDim * fitFactor : 1000;

                camera.left = -newViewSize * aspect / 2;
                camera.right = newViewSize * aspect / 2;
                camera.top = newViewSize / 2;
                camera.bottom = -newViewSize / 2;

                camera.zoom = 1; // Reset zoom
                camera.updateProjectionMatrix();
                controls.update(); // Update controls with new camera params

            } else {
                scene.add(group); // Add anyway
            }

            // Run loop or just render once? OrbitControls needs loop
            const animateLoop = () => {
                requestAnimationFrame(animateLoop);
                renderer.render(scene, camera);
            };
            animateLoop();

            const handleResize = () => {
                if (!containerRef.current) return;
                const w = containerRef.current.clientWidth;
                const h = containerRef.current.clientHeight;
                const newAspect = w / h;

                const currentViewHeight = (camera.top - camera.bottom);
                const currentViewWidth = currentViewHeight * newAspect;

                camera.left = -currentViewWidth / 2;
                camera.right = currentViewWidth / 2;
                camera.top = currentViewHeight / 2;
                camera.bottom = -currentViewHeight / 2;

                camera.updateProjectionMatrix();
                renderer.setSize(w, h);
            };

            window.addEventListener('resize', handleResize);

            // Cleanup function for this render cycle
            return () => {
                window.removeEventListener('resize', handleResize);
                containerRef.current?.removeChild(renderer.domElement);
                renderer.dispose();
            };
        }

    }, [content, fileType]);

    if (error) {
        return (
            <div className="h-full flex items-center justify-center text-red-500">
                {error}
            </div>
        )
    }

    return (
        <div ref={containerRef} className="h-full w-full bg-[#222] overflow-hidden relative">
            <div className="absolute top-4 right-4 bg-black/50 text-white p-2 rounded text-xs pointer-events-none">
                {fileType.toUpperCase()} Viewer of All entities
                <br />
                Left Mouse: Pan
                <br />
                Scroll: Zoom
            </div>
        </div>
    );
}
