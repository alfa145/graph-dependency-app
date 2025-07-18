// import React, { useEffect, useState, useCallback } from 'react';
// import ReactFlow, {
//   Background,
//   Controls,
//   MiniMap,
//   applyNodeChanges
// } from 'reactflow';
// import 'reactflow/dist/style.css';
// import axios from 'axios';

// function App() {
//   const [nodes, setNodes] = useState([]);
//   const [edges, setEdges] = useState([]);

//   // Allow drag/move support
//   const onNodesChange = useCallback(
//     (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
//     []
//   );

//   useEffect(() => {
//     axios.get(import.meta.env.VITE_API_BASE_URL + "/graph").then((res) => {
//       const rawNodes = res.data.nodes;
//       const rawEdges = res.data.edges;

//       const formattedNodes = rawNodes.map((node, index) => ({
//         id: node.id,
//         type: 'default',
//         position: { x: index * 200, y: 100 },
//         data: {
//           label: (
//             <div>
//               <strong>{node.label}</strong><br />
//               Owner: {node.owner}<br />
//               Last Update: {node.last_update}<br />
//               Next Execution: {node.next_execution}
//             </div>
//           ),
//         },
//         draggable: true,
//         style: {
//           border: '1px solid #555',
//           borderRadius: '10px',
//           padding: 10,
//           backgroundColor: '#fff',
//         },
//       }));

//       const formattedEdges = rawEdges.map(edge => ({
//         id: `${edge.source}-${edge.target}`,
//         source: edge.source,
//         target: edge.target,
//         type: 'default',
//         markerEnd: {
//           type: 'arrowclosed', // ✅ this adds the arrowhead
//         },
//       }));

//       setNodes(formattedNodes);
//       setEdges(formattedEdges);
//     });
//   }, []);

//   return (
//     <div style={{ width: '100vw', height: '100vh' }}>
//       <ReactFlow
//         nodes={nodes}
//         edges={edges}
//         onNodesChange={onNodesChange}
//         fitView
//       >
//         <Background />
//         <MiniMap />
//         <Controls />
//       </ReactFlow>
//     </div>
//   );
// }

// export default App;

import React, { useEffect, useState, useRef } from "react";
import Draggable from "react-draggable";

const BACKEND_URL = "https://graph-backend-zy3t.onrender.com";

function App() {
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [positions, setPositions] = useState({});
  const svgRef = useRef(null);

  useEffect(() => {
    fetch(`${BACKEND_URL}/graph`)
      .then((res) => res.json())
      .then((data) => {
        const initialPositions = {};
        data.nodes.forEach((node) => {
          initialPositions[node.id] = { x: node.x || 0, y: node.y || 0 };
        });
        setGraphData(data);
        setPositions(initialPositions);
      });
  }, []);

  const handleDrag = (e, data, nodeId) => {
    setPositions((prev) => ({
      ...prev,
      [nodeId]: { x: data.x, y: data.y },
    }));
  };

  const handleStop = (e, data, nodeId) => {
    const payload = {
      node_id: nodeId,
      x: data.x,
      y: data.y,
    };
    fetch(`${BACKEND_URL}/positions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  };

  const renderEdges = () => {
    return graphData.edges.map((edge, idx) => {
      const from = positions[edge.from] || { x: 0, y: 0 };
      const to = positions[edge.to] || { x: 0, y: 0 };
      return (
        <line
          key={idx}
          x1={from.x + 75}
          y1={from.y + 30}
          x2={to.x + 75}
          y2={to.y + 30}
          stroke="#ccc"
          strokeWidth="2"
          markerEnd="url(#arrowhead)"
        />
      );
    });
  };

  return (
    <div style={{ position: "relative", height: "100vh" }}>
      <svg ref={svgRef} width="100%" height="100%" style={{ position: "absolute", zIndex: 0 }}>
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="10"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#ccc" />
          </marker>
        </defs>
        {renderEdges()}
      </svg>

      {graphData.nodes.map((node) => (
        <Draggable
          key={node.id}
          position={positions[node.id] || { x: 0, y: 0 }}
          onDrag={(e, data) => handleDrag(e, data, node.id)}
          onStop={(e, data) => handleStop(e, data, node.id)}
        >
          <div
            style={{
              position: "absolute",
              width: 150,
              height: 60,
              background: "#fff",
              border: "1px solid #999",
              borderRadius: 5,
              padding: 10,
              boxShadow: "2px 2px 5px rgba(0,0,0,0.2)",
              textAlign: "center",
              cursor: "move",
              zIndex: 1,
            }}
          >
            {node.id}
          </div>
        </Draggable>
      ))}
    </div>
  );
}

export default App;
