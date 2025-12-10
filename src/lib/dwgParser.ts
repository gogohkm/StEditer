import { Dwg_File_Type, LibreDwg, DwgDatabase, DwgEntity } from '@mlightcad/libredwg-web';

export interface CadEntity {
    type: string;
    vertices?: { x: number; y: number; z?: number }[];
    center?: { x: number; y: number; z?: number };
    radius?: number;
    startAngle?: number;
    endAngle?: number;
    shape?: boolean;
    // For ellipse
    majorAxisEndPoint?: { x: number; y: number; z?: number };
    axisRatio?: number;
    // For text
    text?: string;
    textHeight?: number;
    rotation?: number;
    position?: { x: number; y: number; z?: number };
    // For hatch
    loops?: { x: number; y: number; z?: number }[][];
    color?: number;
}

export interface ParsedDwg {
    entities: CadEntity[];
}

let libreDwgInstance: LibreDwg | null = null;

async function getLibreDwgInstance(): Promise<LibreDwg> {
    if (!libreDwgInstance) {
        console.log('[DWG Parser] Creating LibreDwg instance...');
        try {
            libreDwgInstance = await LibreDwg.create('./node_modules/@mlightcad/libredwg-web/wasm/');
            console.log('[DWG Parser] LibreDwg instance created successfully');
        } catch (err) {
            console.error('[DWG Parser] Failed to create LibreDwg instance:', err);
            throw err;
        }
    }
    return libreDwgInstance;
}

// Block definitions cache
let blockDefinitions: Map<string, DwgEntity[]> = new Map();

export async function parseDwg(buffer: ArrayBuffer): Promise<ParsedDwg> {
    console.log('[DWG Parser] Starting to parse DWG, buffer size:', buffer.byteLength);

    let libreDwg: LibreDwg;
    try {
        libreDwg = await getLibreDwgInstance();
    } catch (err) {
        console.error('[DWG Parser] Failed to get LibreDwg instance:', err);
        throw new Error(`Failed to initialize DWG parser: ${err}`);
    }

    console.log('[DWG Parser] Reading DWG data...');
    const uint8Array = new Uint8Array(buffer);

    let dwg;
    try {
        dwg = libreDwg.dwg_read_data(uint8Array as unknown as ArrayBuffer, Dwg_File_Type.DWG);
    } catch (err) {
        console.error('[DWG Parser] Failed to read DWG data:', err);
        throw new Error(`Failed to read DWG file: ${err}`);
    }

    if (!dwg) {
        console.error('[DWG Parser] dwg_read_data returned null');
        throw new Error('Failed to read DWG file: parser returned null');
    }

    console.log('[DWG Parser] Converting DWG to database...');
    let db: DwgDatabase;
    try {
        db = libreDwg.convert(dwg);
        console.log('[DWG Parser] Conversion complete, entities count:', db.entities?.length || 0);
    } catch (err) {
        console.error('[DWG Parser] Failed to convert DWG:', err);
        throw new Error(`Failed to convert DWG data: ${err}`);
    }

    try {
        libreDwg.dwg_free(dwg);
    } catch (err) {
        console.warn('[DWG Parser] Warning: Failed to free DWG data:', err);
    }

    // Build block definitions map
    blockDefinitions = new Map();
    if (db.tables?.BLOCK_RECORD?.entries) {
        for (const block of db.tables.BLOCK_RECORD.entries) {
            if (block.name && block.entities && block.entities.length > 0) {
                blockDefinitions.set(block.name, block.entities);
                blockDefinitions.set(block.name.toUpperCase(), block.entities);
            }
        }
        console.log('[DWG Parser] Loaded', blockDefinitions.size / 2, 'block definitions');
    }

    const entities: CadEntity[] = [];

    if (db.entities && db.entities.length > 0) {
        console.log('[DWG Parser] Processing', db.entities.length, 'entities...');

        const typeCounts: Record<string, number> = {};
        for (const entity of db.entities) {
            const type = entity.type || 'UNKNOWN';
            typeCounts[type] = (typeCounts[type] || 0) + 1;
        }
        console.log('[DWG Parser] Entity types found:', typeCounts);

        for (const entity of db.entities) {
            const converted = convertEntity(entity, { x: 0, y: 0, z: 0 }, 0, 1, 1, 1);
            if (converted) {
                if (Array.isArray(converted)) {
                    entities.push(...converted);
                } else {
                    entities.push(converted);
                }
            }
        }
        console.log('[DWG Parser] Converted', entities.length, 'entities');
    } else {
        console.warn('[DWG Parser] No entities found in database');
    }

    return { entities };
}

interface Point3D {
    x: number;
    y: number;
    z: number;
}

function transformPoint(
    point: { x: number; y: number; z?: number },
    offset: Point3D,
    rotation: number,
    scaleX: number,
    scaleY: number,
    scaleZ: number
): { x: number; y: number; z: number } {
    // Apply scale
    let x = point.x * scaleX;
    let y = point.y * scaleY;
    const z = (point.z || 0) * scaleZ;

    // Apply rotation (around origin)
    if (rotation !== 0) {
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const newX = x * cos - y * sin;
        const newY = x * sin + y * cos;
        x = newX;
        y = newY;
    }

    // Apply translation
    return {
        x: x + offset.x,
        y: y + offset.y,
        z: z + offset.z
    };
}

function convertEntity(
    entity: DwgEntity,
    offset: Point3D,
    rotation: number,
    scaleX: number,
    scaleY: number,
    scaleZ: number,
    depth: number = 0
): CadEntity | CadEntity[] | null {
    if (!entity || !entity.type) return null;
    if (depth > 10) return null; // Prevent infinite recursion

    const type = entity.type.toUpperCase();
    const e = entity as any;

    switch (type) {
        case 'LINE': {
            if (e.startPoint && e.endPoint) {
                return {
                    type: 'LINE',
                    vertices: [
                        transformPoint(e.startPoint, offset, rotation, scaleX, scaleY, scaleZ),
                        transformPoint(e.endPoint, offset, rotation, scaleX, scaleY, scaleZ)
                    ]
                };
            }
            break;
        }

        case 'LWPOLYLINE': {
            if (e.vertices && e.vertices.length > 0) {
                const isClosed = (e.flag & 1) === 1;
                return {
                    type: 'POLYLINE',
                    vertices: e.vertices.map((v: any) =>
                        transformPoint({ x: v.x ?? 0, y: v.y ?? 0, z: e.elevation ?? 0 }, offset, rotation, scaleX, scaleY, scaleZ)
                    ),
                    shape: isClosed
                };
            }
            break;
        }

        case 'POLYLINE2D': {
            if (e.vertices && e.vertices.length > 0) {
                const isClosed = (e.flag & 1) === 1;
                return {
                    type: 'POLYLINE',
                    vertices: e.vertices.map((v: any) =>
                        transformPoint({
                            x: v.point?.x ?? v.x ?? 0,
                            y: v.point?.y ?? v.y ?? 0,
                            z: v.point?.z ?? e.elevation ?? 0
                        }, offset, rotation, scaleX, scaleY, scaleZ)
                    ),
                    shape: isClosed
                };
            }
            break;
        }

        case 'POLYLINE3D': {
            if (e.vertices && e.vertices.length > 0) {
                const isClosed = (e.flag & 1) === 1;
                return {
                    type: 'POLYLINE',
                    vertices: e.vertices.map((v: any) =>
                        transformPoint({
                            x: v.point?.x ?? v.x ?? 0,
                            y: v.point?.y ?? v.y ?? 0,
                            z: v.point?.z ?? v.z ?? 0
                        }, offset, rotation, scaleX, scaleY, scaleZ)
                    ),
                    shape: isClosed
                };
            }
            break;
        }

        case 'CIRCLE': {
            if (e.center && e.radius) {
                const transformedCenter = transformPoint(e.center, offset, rotation, scaleX, scaleY, scaleZ);
                return {
                    type: 'CIRCLE',
                    center: transformedCenter,
                    radius: e.radius * Math.max(scaleX, scaleY)
                };
            }
            break;
        }

        case 'ARC': {
            if (e.center && e.radius) {
                const transformedCenter = transformPoint(e.center, offset, rotation, scaleX, scaleY, scaleZ);
                return {
                    type: 'ARC',
                    center: transformedCenter,
                    radius: e.radius * Math.max(scaleX, scaleY),
                    startAngle: (e.startAngle || 0) + rotation,
                    endAngle: (e.endAngle || Math.PI * 2) + rotation
                };
            }
            break;
        }

        case 'ELLIPSE': {
            if (e.center && e.majorAxisEndPoint) {
                const transformedCenter = transformPoint(e.center, offset, rotation, scaleX, scaleY, scaleZ);
                const transformedMajorEnd = transformPoint(e.majorAxisEndPoint, { x: 0, y: 0, z: 0 }, rotation, scaleX, scaleY, scaleZ);
                return {
                    type: 'ELLIPSE',
                    center: transformedCenter,
                    majorAxisEndPoint: transformedMajorEnd,
                    axisRatio: e.axisRatio || 1,
                    startAngle: e.startAngle || 0,
                    endAngle: e.endAngle || Math.PI * 2
                };
            }
            break;
        }

        case 'SPLINE': {
            if (e.controlPoints && e.controlPoints.length > 0) {
                return {
                    type: 'POLYLINE',
                    vertices: e.controlPoints.map((p: any) =>
                        transformPoint({ x: p.x ?? 0, y: p.y ?? 0, z: p.z ?? 0 }, offset, rotation, scaleX, scaleY, scaleZ)
                    ),
                    shape: false
                };
            } else if (e.fitPoints && e.fitPoints.length > 0) {
                return {
                    type: 'POLYLINE',
                    vertices: e.fitPoints.map((p: any) =>
                        transformPoint({ x: p.x ?? 0, y: p.y ?? 0, z: p.z ?? 0 }, offset, rotation, scaleX, scaleY, scaleZ)
                    ),
                    shape: false
                };
            }
            break;
        }

        case 'SOLID':
        case 'TRACE': {
            const corners = [];
            if (e.corner1) corners.push(transformPoint({ x: e.corner1.x, y: e.corner1.y, z: 0 }, offset, rotation, scaleX, scaleY, scaleZ));
            if (e.corner2) corners.push(transformPoint({ x: e.corner2.x, y: e.corner2.y, z: 0 }, offset, rotation, scaleX, scaleY, scaleZ));
            if (e.corner3) corners.push(transformPoint({ x: e.corner3.x, y: e.corner3.y, z: 0 }, offset, rotation, scaleX, scaleY, scaleZ));
            if (e.corner4) corners.push(transformPoint({ x: e.corner4.x, y: e.corner4.y, z: 0 }, offset, rotation, scaleX, scaleY, scaleZ));

            if (corners.length >= 3) {
                return {
                    type: 'POLYLINE',
                    vertices: corners,
                    shape: true
                };
            }
            break;
        }

        case 'POINT': {
            if (e.location || e.point) {
                const pt = e.location || e.point;
                return {
                    type: 'POINT',
                    vertices: [transformPoint({ x: pt.x, y: pt.y, z: pt.z || 0 }, offset, rotation, scaleX, scaleY, scaleZ)]
                };
            }
            break;
        }

        case '3DFACE': {
            const points = [];
            if (e.corner1) points.push(transformPoint(e.corner1, offset, rotation, scaleX, scaleY, scaleZ));
            if (e.corner2) points.push(transformPoint(e.corner2, offset, rotation, scaleX, scaleY, scaleZ));
            if (e.corner3) points.push(transformPoint(e.corner3, offset, rotation, scaleX, scaleY, scaleZ));
            if (e.corner4) points.push(transformPoint(e.corner4, offset, rotation, scaleX, scaleY, scaleZ));

            if (points.length >= 3) {
                return {
                    type: 'POLYLINE',
                    vertices: points,
                    shape: true
                };
            }
            break;
        }

        case 'TEXT': {
            if (e.text && e.startPoint) {
                const pos = transformPoint(e.startPoint, offset, rotation, scaleX, scaleY, scaleZ);
                return {
                    type: 'TEXT',
                    text: e.text,
                    position: pos,
                    textHeight: (e.textHeight || 2.5) * Math.max(scaleX, scaleY),
                    rotation: (e.rotation || 0) + rotation
                };
            }
            break;
        }

        case 'MTEXT': {
            if (e.text && e.insertionPoint) {
                const pos = transformPoint(e.insertionPoint, offset, rotation, scaleX, scaleY, scaleZ);
                // Strip MTEXT formatting codes
                let cleanText = e.text
                    .replace(/\\P/g, '\n')
                    .replace(/\\[A-Za-z][^;]*;/g, '')
                    .replace(/\{[^}]*\}/g, '')
                    .replace(/%%[cuod]/gi, '');
                return {
                    type: 'TEXT',
                    text: cleanText,
                    position: pos,
                    textHeight: (e.textHeight || 2.5) * Math.max(scaleX, scaleY),
                    rotation: (e.rotation || 0) + rotation
                };
            }
            break;
        }

        case 'HATCH': {
            if (e.boundaryPaths && e.boundaryPaths.length > 0) {
                const loops: { x: number; y: number; z: number }[][] = [];

                for (const path of e.boundaryPaths) {
                    const loop: { x: number; y: number; z: number }[] = [];
                    // Handle polyline boundary
                    if (path.vertices && path.vertices.length > 0) {
                        path.vertices.forEach((v: any) => {
                            loop.push(transformPoint({ x: v.x ?? 0, y: v.y ?? 0, z: 0 }, offset, rotation, scaleX, scaleY, scaleZ));
                        });
                        // Close loop if needed
                        if (path.isClosed !== false && loop.length > 0) { // default closed
                            // Check if last equals first
                            const first = loop[0];
                            const last = loop[loop.length - 1];
                            if (Math.abs(first.x - last.x) > 0.0001 || Math.abs(first.y - last.y) > 0.0001) {
                                loop.push(first);
                            }
                        }
                    }
                    // Handle edge boundary (approximate arc/line edges as a loop of points)
                    else if (path.edges && path.edges.length > 0) {
                        // This is complex because edges need to be connected. 
                        // For now, we gather points. Ideally we'd trace the path.
                        // Simplified: treating edges as separate or connected segments.

                        // Strategy: Sample points from edges to form a polygon loop
                        for (const edge of path.edges) {
                            if (edge.type === 1 && edge.start && edge.end) { // Line
                                // Add start and end (removing duplicates logic skipped for simplicity/speed)
                                loop.push(transformPoint({ x: edge.start.x, y: edge.start.y, z: 0 }, offset, rotation, scaleX, scaleY, scaleZ));
                                loop.push(transformPoint({ x: edge.end.x, y: edge.end.y, z: 0 }, offset, rotation, scaleX, scaleY, scaleZ));
                            } else if (edge.type === 2 && edge.center) { // Arc
                                // Sample arc
                                const startAngle = (edge.startAngle ?? 0);
                                const endAngle = (edge.endAngle ?? Math.PI * 2);
                                const radius = (edge.radius ?? 0) * Math.max(scaleX, scaleY);
                                const center = transformPoint({ x: edge.center.x, y: edge.center.y, z: 0 }, offset, rotation, scaleX, scaleY, scaleZ);

                                // 10 points for arc
                                const steps = 10;
                                for (let i = 0; i <= steps; i++) {
                                    const t = startAngle + (endAngle - startAngle) * (i / steps);
                                    const x = center.x + radius * Math.cos(t + rotation);
                                    const y = center.y + radius * Math.sin(t + rotation);
                                    loop.push({ x, y, z: center.z });
                                }
                            }
                        }
                    }

                    if (loop.length > 0) {
                        loops.push(loop);
                    }
                }

                if (loops.length > 0) {
                    return {
                        type: 'HATCH',
                        loops: loops,
                        color: e.color ?? 256
                    };
                }
            }
            break;
        }

        case 'INSERT': {
            const blockName = e.name || e.blockName;
            if (blockName) {
                const blockEntities = blockDefinitions.get(blockName) || blockDefinitions.get(blockName.toUpperCase());
                if (blockEntities && blockEntities.length > 0) {
                    const insertPoint = e.insertionPoint || { x: 0, y: 0, z: 0 };
                    const insertRotation = e.rotation || 0;
                    const insertScaleX = e.xScale ?? 1;
                    const insertScaleY = e.yScale ?? 1;
                    const insertScaleZ = e.zScale ?? 1;

                    // Calculate combined transformation
                    const newOffset = transformPoint(insertPoint, offset, rotation, scaleX, scaleY, scaleZ);
                    const newRotation = rotation + insertRotation;
                    const newScaleX = scaleX * insertScaleX;
                    const newScaleY = scaleY * insertScaleY;
                    const newScaleZ = scaleZ * insertScaleZ;

                    const result: CadEntity[] = [];
                    for (const blockEntity of blockEntities) {
                        const converted = convertEntity(
                            blockEntity,
                            newOffset,
                            newRotation,
                            newScaleX,
                            newScaleY,
                            newScaleZ,
                            depth + 1
                        );
                        if (converted) {
                            if (Array.isArray(converted)) {
                                result.push(...converted);
                            } else {
                                result.push(converted);
                            }
                        }
                    }
                    return result.length > 0 ? result : null;
                }
            }
            break;
        }

        case 'DIMENSION':
        case 'LEADER':
        case 'MLEADER': {
            // These are complex entities, try to extract basic geometry
            if (e.defPoint && e.textMidPoint) {
                return {
                    type: 'LINE',
                    vertices: [
                        transformPoint(e.defPoint, offset, rotation, scaleX, scaleY, scaleZ),
                        transformPoint(e.textMidPoint, offset, rotation, scaleX, scaleY, scaleZ)
                    ]
                };
            }
            break;
        }

        case 'RAY':
        case 'XLINE': {
            // Infinite lines - just draw a segment
            if (e.basePoint && e.unitDirection) {
                const start = transformPoint(e.basePoint, offset, rotation, scaleX, scaleY, scaleZ);
                const dir = e.unitDirection;
                const len = 10000; // Arbitrary large length
                return {
                    type: 'LINE',
                    vertices: [
                        start,
                        { x: start.x + dir.x * len, y: start.y + dir.y * len, z: start.z + (dir.z || 0) * len }
                    ]
                };
            }
            break;
        }
    }

    return null;
}
