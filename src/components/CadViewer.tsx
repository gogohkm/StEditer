import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import DxfParser from 'dxf-parser';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface CadViewerProps {
    content: string;
}

export function CadViewer({ content }: CadViewerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!containerRef.current || !content) return;

        // Parse DXF
        const parser = new DxfParser();
        let dxf;
        try {
            dxf = parser.parseSync(content);
        } catch (err) {
            console.error("DXF Parse Error", err);
            setError("Failed to parse DXF file.");
            return;
        }

        if (!dxf) {
            setError("Empty or invalid DXF file.");
            return;
        }

        // Setup Three.js Scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x222222); // Dark background for CAD

        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;

        // Orthographic camera is better for 2D CAD
        // Initial frustum size, will be adjusted
        const aspect = width / height;
        const viewSize = 1000;
        const camera = new THREE.OrthographicCamera(
            -viewSize * aspect / 2, viewSize * aspect / 2,
            viewSize / 2, -viewSize / 2,
            0.1, 10000
        );
        camera.position.z = 1000;

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        containerRef.current.innerHTML = ''; // Clear previous
        containerRef.current.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableRotate = false; // 2D mode usually disables rotation
        controls.screenSpacePanning = true;
        controls.mouseButtons = {
            LEFT: THREE.MOUSE.PAN,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN
        }

        // Convert DXF entities to Three.js objects
        // This is a simplified renderer. A full DXF renderer is complex.
        const material = new THREE.LineBasicMaterial({ color: 0xffffff });
        const group = new THREE.Group();

        if (dxf.entities) {
            dxf.entities.forEach((entity: any) => {
                if (entity.type === 'LINE') {
                    const geometry = new THREE.BufferGeometry().setFromPoints([
                        new THREE.Vector3(entity.vertices[0].x, entity.vertices[0].y, 0),
                        new THREE.Vector3(entity.vertices[1].x, entity.vertices[1].y, 0)
                    ]);
                    const line = new THREE.Line(geometry, material);
                    group.add(line);
                } else if (entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') {
                    if (entity.vertices && entity.vertices.length > 0) {
                        const points = entity.vertices.map((v: any) => new THREE.Vector3(v.x, v.y, 0));
                        if (entity.shape) { // Closed loop
                            points.push(points[0]);
                        }
                        const geometry = new THREE.BufferGeometry().setFromPoints(points);
                        const line = new THREE.Line(geometry, material);
                        group.add(line);
                    }
                } else if (entity.type === 'CIRCLE') {
                    const curve = new THREE.EllipseCurve(
                        entity.center.x, entity.center.y,
                        entity.radius, entity.radius,
                        0, 2 * Math.PI,
                        false,
                        0
                    );
                    const points = curve.getPoints(50);
                    const geometry = new THREE.BufferGeometry().setFromPoints(points);
                    const line = new THREE.Line(geometry, material);
                    group.add(line);
                } else if (entity.type === 'ARC') {
                    const curve = new THREE.EllipseCurve(
                        entity.center.x, entity.center.y,
                        entity.radius, entity.radius,
                        entity.startAngle, entity.endAngle,
                        false,
                        0
                    );
                    const points = curve.getPoints(50);
                    const geometry = new THREE.BufferGeometry().setFromPoints(points);
                    const line = new THREE.Line(geometry, material);
                    group.add(line);
                }
                // TODO: Add TEXT, MTEXT, DIMENSION, etc.
            });
        }

        // Auto-center geometry
        const box = new THREE.Box3().setFromObject(group);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        // Center geometry at 0,0
        group.position.x = -center.x;
        group.position.y = -center.y;
        scene.add(group);

        // Add axes helper
        const axesHelper = new THREE.AxesHelper(100);
        scene.add(axesHelper);

        // Adjust camera zoom to fit
        const uploadScale = Math.max(size.x, size.y);
        const fitFactor = 1.2;
        const newViewSize = uploadScale * fitFactor;

        camera.left = -newViewSize * aspect / 2;
        camera.right = newViewSize * aspect / 2;
        camera.top = newViewSize / 2;
        camera.bottom = -newViewSize / 2;
        camera.updateProjectionMatrix();

        controls.update();

        function animate() {
            requestAnimationFrame(animate);
            renderer.render(scene, camera);
        }
        animate();

        const handleResize = () => {
            if (!containerRef.current) return;
            const w = containerRef.current.clientWidth;
            const h = containerRef.current.clientHeight;
            const newAspect = w / h;

            // Update frustum to maintain zoom level but change aspect
            const currentViewHeight = (camera.top - camera.bottom);

            camera.left = -currentViewHeight * newAspect / 2;
            camera.right = currentViewHeight * newAspect / 2;
            camera.top = currentViewHeight / 2;
            camera.bottom = -currentViewHeight / 2;

            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            containerRef.current?.removeChild(renderer.domElement);
            renderer.dispose();
        };

    }, [content]);

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
                DXF Viewer (Simplified)
                <br />
                Left Mouse: Pan
                <br />
                Scroll: Zoom
            </div>
        </div>
    );
}
