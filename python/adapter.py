import sys
import json
import openseespy.opensees as ops

def run_analysis(data):
    # Initialize OpenSees
    ops.wipe()
    ops.model('basic', '-ndm', 2, '-ndf', 3)  # 2D frame default

    # 1. Define Nodes
    if 'nodes' in data:
        for node in data['nodes']:
            # id, x, y
            ops.node(node['id'], node['x'], node['y'])
            
            # Boundary conditions (fixities)
            if 'fix' in node:
                # fix must be list of 3 ints [x, y, rz]
                ops.fix(node['id'], *node['fix'])

    # 2. Define Materials & Sections (Simplified for now)
    # Using elastic beam column for simplicity in this prototype
    ops.geomTransf('Linear', 1)

    # 3. Define Elements
    if 'elements' in data:
        for elem in data['elements']:
            # id, node1, node2, A, E, Iz
            # Assuming simple elastic beam column for now
            if elem['type'] == 'ElasticBeamColumn':
                ops.element('elasticBeamColumn', elem['id'], elem['nodes'][0], elem['nodes'][1], 
                            elem['A'], elem['E'], elem['Iz'], 1)

    # 4. Define Loads
    ops.timeSeries('Linear', 1)
    ops.pattern('Plain', 1, 1)

    if 'loads' in data:
        for load in data['loads']:
            if load['type'] == 'Nodal':
                # id, Fx, Fy, Mz
                ops.load(load['node'], *load['value'])

    # 5. Analysis Setup
    ops.system('BandSPD')
    ops.numberer('RCM')
    ops.constraints('Plain')
    ops.integrator('LoadControl', 1.0)
    ops.algorithm('Linear')
    ops.analysis('Static')

    # 6. Run Analysis
    ops.analyze(1)

    # 7. Collect Results
    results = {
        'nodeDisplacements': {},
        'elementForces': {}
    }

    if 'nodes' in data:
        for node in data['nodes']:
            disp = ops.nodeDisp(node['id'])
            results['nodeDisplacements'][node['id']] = disp

    # Output results
    return results

if __name__ == "__main__":
    try:
        # Read JSON from stdin
        input_str = sys.stdin.read()
        if not input_str:
            print(json.dumps({"error": "No input provided"}))
            sys.exit(1)
            
        data = json.loads(input_str)
        result = run_analysis(data)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
