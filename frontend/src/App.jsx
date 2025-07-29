// /*******************
//  * Funciona todo hasta antes de boton de borrado
//  *******************/

import React, { useEffect, useState, useRef, useCallback } from 'react';
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
  const [rawNodes, setRawNodes] = useState([]);
  const [rawEdges, setRawEdges] = useState([]);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState([]);
  const [highlightedEdgeIds, setHighlightedEdgeIds] = useState([]);
  const [collapsedParents, setCollapsedParents] = useState(new Set());
  const [hiddenNodeIds, setHiddenNodeIds] = useState([]);
  const [hiddenEdgeIds, setHiddenEdgeIds] = useState([]);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState('');
  const positionsRef = useRef({});

  const getUpstreamGraph = (startId, allEdges) => {
    const visitedNodes = new Set();
    const visitedEdges = new Set();
    const stack = [startId];

    while (stack.length > 0) {
      const current = stack.pop();
      const incomingEdges = allEdges.filter((e) => e.target === current);

      for (const edge of incomingEdges) {
        const parentId = edge.source;
        if (!visitedNodes.has(parentId)) {
          visitedNodes.add(parentId);
          stack.push(parentId);
        }
        visitedEdges.add(edge.id);
      }
    }

    return {
      nodes: Array.from(visitedNodes),
      edges: Array.from(visitedEdges),
    };
  };

  const getAllParents = (startId, allEdges) => {
    const visited = new Set();
    const stack = [startId];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!visited.has(current)) {
        visited.add(current);
        const parents = allEdges
          .filter((e) => e.target === current)
          .map((e) => e.source);
        stack.push(...parents);
      }
    }

    visited.delete(startId);
    return Array.from(visited);
  };

  const onNodeClick = useCallback(
    (_, node) => {
      if (highlightedNodeIds.includes(node.id)) {
        setHighlightedNodeIds([]);
        setHighlightedEdgeIds([]);
        return;
      }

      const parents = getAllParents(node.id, edges);
      const edgesToHighlight = edges
        .filter((e) => parents.includes(e.source) && e.target === node.id || parents.includes(e.target))
        .map((e) => e.id);

      setHighlightedNodeIds([...parents, node.id]);
      setHighlightedEdgeIds(edgesToHighlight);
    },
    [edges, highlightedNodeIds]
  );

  const toggleCollapse = (nodeId) => {
    const isCollapsed = collapsedParents.has(nodeId);
    const { nodes: upstreamNodes, edges: upstreamEdges } = getUpstreamGraph(nodeId, rawEdges);

    if (isCollapsed) {
      setHiddenNodeIds((prev) => prev.filter((id) => !upstreamNodes.includes(id)));
      setHiddenEdgeIds((prev) => prev.filter((id) => !upstreamEdges.includes(id)));
      setCollapsedParents((prev) => {
        const updated = new Set(prev);
        updated.delete(nodeId);
        return updated;
      });
    } else {
      setHiddenNodeIds((prev) => [...new Set([...prev, ...upstreamNodes])]);
      setHiddenEdgeIds((prev) => [...new Set([...prev, ...upstreamEdges])]);
      setCollapsedParents((prev) => new Set(prev).add(nodeId));
    }
    console.log('Toggled collapse for:', nodeId);
  };

  const onPaneClick = () => {
    setHighlightedNodeIds([]);
    setHighlightedEdgeIds([]);
  };

  const fetchGraph = async () => {
    try {
      const res = await axios.get(`${backendUrl}/graph`);
      const { nodes: fetchedNodes, edges: fetchedEdges } = res.data;
      setRawNodes(fetchedNodes);
      setRawEdges(fetchedEdges);
      const positions = {};
      for (const node of fetchedNodes) {
        positions[node.id] = { x: node.x ?? 0, y: node.y ?? 0 };
      }
      positionsRef.current = positions;
    } catch (error) {
      console.error('Error fetching graph:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraph();
  }, []);

  useEffect(() => {
    const updatedNodes = rawNodes.map((node) => {
      const position = positionsRef.current[node.id] || { x: 0, y: 0 };
      return {
        id: node.id,
        data: {
          label: (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCollapse(node.id);
                  }}
                  title={collapsedParents.has(node.id) ? 'Expand upstream' : 'Collapse upstream'}
                  style={{
                    width: 12,
                    height: 12,
                    border: '1px solid black',
                    marginRight: 6,
                    fontSize: 10,
                    fontWeight: 'bold',
                    textAlign: 'center',
                    lineHeight: '10px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    backgroundColor: '#eee',
                  }}
                >
                  {collapsedParents.has(node.id) ? '+' : '−'}
                </div>
                <div style={{ fontWeight: 'bold', textAlign: 'center', width: '100%' }}>
                  {node.label}
                </div>
              </div>

              <div className="node-detail">
                {<><strong>Owner:</strong> {node.owner ? node.owner : '?'}<br /></>}
                {<><strong>Last Run:</strong> {node.last_update ? node.last_update : '?'}<br /></>}
                {<><strong>Next Run:</strong> {node.next_execution ? node.next_execution : '?'}</>}
              </div>
            </div>
          ),
        },
        position,
        draggable: true,
        className: highlightedNodeIds.includes(node.id) ? 'highlight-node' : '',
        style: {
          border: '1px solid #555',
          borderRadius: '10px',
          padding: 10,
          backgroundColor: '#fff',
        },
      };
    });

    const updatedEdges = rawEdges.map((edge) => ({
      id: `${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      type: 'default',
      markerEnd: {
        type: 'arrowclosed',
      },
      className: highlightedEdgeIds.includes(`${edge.source}-${edge.target}`) ? 'highlight-edge' : '',
    }));

    setNodes(updatedNodes);
    setEdges(updatedEdges);
  }, [rawNodes, rawEdges, collapsedParents, highlightedNodeIds, highlightedEdgeIds]);

  const onNodeDragStop = async (_, node) => {
    positionsRef.current[node.id] = node.position;
    try {
      await axios.post(`${backendUrl}/positions`, {
        id: node.id,
        position: node.position,
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
      await axios.post(`${backendUrl}/upload`, formData);
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

  const visibleNodes = nodes.filter((n) => !hiddenNodeIds.includes(n.id));
  const visibleEdges = edges.filter((e) => !hiddenEdgeIds.includes(e.id));

  return (
    <div style={{ height: '100vh', width: '100vw', overflow: 'hidden', margin: 0 }}>
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

      <div style={{ height: 'calc(100vh - 50px)', width: '100%' }}>
        <ReactFlow
          nodes={visibleNodes}
          edges={visibleEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
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
