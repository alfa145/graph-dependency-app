// /******************************
// * Working version with only csv
// *******************************/
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

// /*********************************
// * New version for position storage con sample
// **********************************/

// import React, { useEffect, useState, useCallback } from 'react';
// import ReactFlow, {
//   Background,
//   Controls,
//   MiniMap,
//   applyNodeChanges,
// } from 'reactflow';
// import 'reactflow/dist/style.css';
// import axios from 'axios';

// const BACKEND_URL = import.meta.env.VITE_API_BASE_URL || 'https://graph-backend-zy3t.onrender.com';

// function App() {
//   const [nodes, setNodes] = useState([]);
//   const [edges, setEdges] = useState([]);

//   const onNodesChange = useCallback(
//     (changes) => {
//       setNodes((nds) => {
//         const updated = applyNodeChanges(changes, nds);

//         // Persist node position changes
//         changes.forEach((change) => {
//           if (change.type === 'position' && change.position) {
//             const payload = {
//               node_id: change.id,
//               x: change.position.x,
//               y: change.position.y,
//             };
//             fetch(`${BACKEND_URL}/positions`, {
//               method: 'POST',
//               headers: {
//                 'Content-Type': 'application/json',
//               },
//               body: JSON.stringify(payload),
//             });
//           }
//         });

//         return updated;
//       });
//     },
//     []
//   );

//   useEffect(() => {
//     axios.get(`${BACKEND_URL}/graph`).then((res) => {
//       const rawNodes = res.data.nodes;
//       const rawEdges = res.data.edges;

//       const formattedNodes = rawNodes.map((node) => ({
//         id: node.id,
//         type: 'default',
//         position: { x: node.x || 0, y: node.y || 0 },
//         data: {
//           label: (
//             <div>
//               <strong>{node.label || node.id}</strong><br />
//               {node.owner && <>Owner: {node.owner}<br /></>}
//               {node.last_update && <>Last Update: {node.last_update}<br /></>}
//               {node.next_execution && <>Next Execution: {node.next_execution}</>}
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

//       const formattedEdges = rawEdges.map((edge) => ({
//         id: `${edge.source}-${edge.target}`,
//         source: edge.source,
//         target: edge.target,
//         type: 'default',
//         markerEnd: {
//           type: 'arrowclosed',
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

/************************************************
* New version for position storage con sample_new
*************************************************/

import React, { useEffect, useState, useRef } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import axios from 'axios';
import './App.css';

const backendUrl = 'https://graph-backend-zy3t.onrender.com';

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const positionsRef = useRef({});

  useEffect(() => {
    const fetchGraph = async () => {
      try {
        const res = await axios.get(`${backendUrl}/graph`);
        const { nodes: fetchedNodes, edges: fetchedEdges } = res.data;

        const updatedNodes = fetchedNodes.map((node) => {
          const position = { x: node.x ?? 0, y: node.y ?? 0 };

          positionsRef.current[node.id] = position;

          return {
            id: node.id,
            data: { label: node.label },
            position,
          };
        });

        setNodes(updatedNodes);
        setEdges(fetchedEdges);
      } catch (error) {
        console.error('Error fetching graph:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGraph();
  }, []);

  const onNodeDragStop = async (_, node) => {
    positionsRef.current[node.id] = node.position;

    try {
      await axios.post(`${backendUrl}/update-position`, {
        id: node.id,
        position: node.position,
      });
    } catch (error) {
      console.error('Failed to update node position:', error);
    }
  };

  if (loading) return <div>Loading graph...</div>;

  return (
    <div style={{ height: '100vh', width: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        fitView
      >
        <MiniMap />
        <Controls />
        <Background color="#aaa" gap={16} />
      </ReactFlow>
    </div>
  );
}

export default App;
