// /*******************
//  * Funciona todo hasta antes de boton de borrado
//  *******************/

import React, { useEffect, useState, useRef } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import axios from 'axios';
import './App.css';

const backendUrl = 'https://graph-backend-zy3t.onrender.com';
// const backendUrl = 'http://localhost:8000';

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const positionsRef = useRef({});
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState('');

  const fetchGraph = async () => {
    try {
      const res = await axios.get(`${backendUrl}/graph`);
      const { nodes: fetchedNodes, edges: fetchedEdges } = res.data;

      const updatedNodes = fetchedNodes.map((node) => {
        const position = { x: node.x ?? 0, y: node.y ?? 0 };
        positionsRef.current[node.id] = position;

        return {
          id: node.id,
          data: {
            label: (
              <div>
                <strong>{node.label || node.id}</strong><br />
                {node.owner && <>Owner: {node.owner}<br /></>}
                {node.last_update && <>Last Update: {node.last_update}<br /></>}
                {node.next_execution && <>Next Execution: {node.next_execution}</>}
              </div>
            ),
          },
          position,
          draggable: true,
          style: {
            border: '1px solid #555',
            borderRadius: '10px',
            padding: 10,
            backgroundColor: '#fff',
          },
        };
      });

      const updatedEdges = fetchedEdges.map((edge) => ({
        id: `${edge.source}-${edge.target}`,
        source: edge.source,
        target: edge.target,
        type: 'default',
        markerEnd: {
          type: 'arrowclosed',
        },
      }));

      setNodes(updatedNodes);
      setEdges(updatedEdges);
    } catch (error) {
      console.error('Error fetching graph:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraph();
  }, []);

  const onNodeDragStop = async (_, node) => {
    positionsRef.current[node.id] = node.position;

    try {
      await axios.post(`${backendUrl}/positions`, {
        id: node.id,
        position: {
          x: node.position.x,
          y: node.position.y,
        },
      });
    } catch (error) {
      console.error('Failed to update node position:', error);
    }
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setError('');
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || file.type !== 'text/csv') {
      setError('Please select a valid CSV file.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    setUploading(true);

    try {
      await axios.post(`${backendUrl}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      await fetchGraph();
      alert('Upload successful!');
    } catch (error) {
      console.error('Upload failed:', error);
      setError('Upload failed.');
    } finally {
      setUploading(false);
      setFile(null);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Are you sure you want to reset all data?')) return;
    setResetting(true);
    try {
      await axios.delete(`${backendUrl}/reset`);
      await fetchGraph();
    } catch (error) {
      console.error('Reset failed:', error);
      setError('Reset failed');
    } finally {
      setResetting(false);
    }
  };

  if (loading) return <div>Loading graph...</div>;

  return (
    <div style={{ height: '100vh', width: '100vw', overflow: 'hidden', margin: 0 }}>
      {/* Admin Controls */}
      <form onSubmit={handleUpload} style={{ padding: '10px', background: '#f5f5f5', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <input type="file" accept=".csv" onChange={handleFileChange} disabled={uploading} />
        <button type="submit" disabled={uploading || !file}>
          {uploading ? 'Uploading...' : 'Upload CSV'}
        </button>
        <button type="button" onClick={handleReset} disabled={resetting}>
          {resetting ? 'Resetting...' : 'Reset Graph'}
        </button>
        {error && <span style={{ color: 'red', marginLeft: '10px' }}>{error}</span>}
      </form>

      {/* Graph Display */}
      <div style={{ height: 'calc(100vh - 50px)', width: '100%' }}>
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
    </div>
  );
}

export default App;
