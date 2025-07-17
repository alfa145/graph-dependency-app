import React, { useEffect, useState, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  applyNodeChanges
} from 'reactflow';
import 'reactflow/dist/style.css';
import axios from 'axios';

function App() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  // Allow drag/move support
  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  useEffect(() => {
    axios.get(import.meta.env.VITE_API_BASE_URL + "/graph").then((res) => {
      const rawNodes = res.data.nodes;
      const rawEdges = res.data.edges;

      const formattedNodes = rawNodes.map((node, index) => ({
        id: node.id,
        type: 'default',
        position: { x: index * 200, y: 100 },
        data: {
          label: (
            <div>
              <strong>{node.label}</strong><br />
              Owner: {node.owner}<br />
              Last Update: {node.last_update}<br />
              Next Execution: {node.next_execution}
            </div>
          ),
        },
        draggable: true,
        style: {
          border: '1px solid #555',
          borderRadius: '10px',
          padding: 10,
          backgroundColor: '#fff',
        },
      }));

      const formattedEdges = rawEdges.map(edge => ({
        id: `${edge.source}-${edge.target}`,
        source: edge.source,
        target: edge.target,
        type: 'default',
        markerEnd: {
          type: 'arrowclosed', // ✅ this adds the arrowhead
        },
      }));

      setNodes(formattedNodes);
      setEdges(formattedEdges);
    });
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        fitView
      >
        <Background />
        <MiniMap />
        <Controls />
      </ReactFlow>
    </div>
  );
}

export default App;