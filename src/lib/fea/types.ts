export interface FeaNode {
    id: number;
    x: number;
    y: number;
    z?: number;
    fix?: number[]; // [x, y, rz] for 2D, or [x, y, z, rx, ry, rz] for 3D
}

export interface FeaElement {
    id: number;
    type: 'ElasticBeamColumn' | 'Truss' | 'ZeroLength';
    nodes: number[];
    A?: number; // Area
    E?: number; // Young's Modulus
    Iz?: number; // Moment of Inertia (z)
    Iy?: number; // Moment of Inertia (y)
    G?: number; // Shear Modulus
    J?: number; // Torsional Constant
}

export interface FeaLoad {
    id: number;
    type: 'Nodal' | 'Element';
    node?: number;
    element?: number;
    value: number[]; // [Fx, Fy, Mz] etc.
}

export interface FeaModel {
    nodes: FeaNode[];
    elements: FeaElement[];
    loads: FeaLoad[];
}

export interface FeaAnalysisResult {
    nodeDisplacements: Record<string, number[]>; // nodeId -> [dx, dy, rz]
    elementForces: Record<string, number[]>; // elementId -> forces
}
