import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowLeft,
  Save,
  Check,
  AlertCircle,
  Play,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Undo2,
  Sidebar as SidebarIcon,
  Sparkles,
  Layers,
  HelpCircle,
  CheckCircle2,
  Loader2
} from "lucide-react";
import { api } from "../../services/api";
import NodePalette from "./NodePalette";
import NodeCard from "./NodeCard";
import EdgePath, { calculatePortPosition, generateBezierPath } from "./EdgePath";
import NodeInspector from "./NodeInspector";
import ValidationDrawer from "./ValidationDrawer";
import RunExecutionModal from "./RunExecutionModal";

export default function WorkflowEditor({ workflowId, onBack }) {
  // Core Workflow State
  const [workflow, setWorkflow] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [workflowName, setWorkflowName] = useState("Untitled Workflow");
  const [workflowVersion, setWorkflowVersion] = useState(1);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");

  // Catalogue
  const [catalogue, setCatalogue] = useState([]);
  const [catalogueMap, setCatalogueMap] = useState({});

  // Canvas Viewport (Pan & Zoom)
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 80, y: 60 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  // Selection & UI Panels
  const [selectedElement, setSelectedElement] = useState(null); // { id, type: 'node' | 'edge' }
  const [isPaletteOpen, setIsPaletteOpen] = useState(true);
  const [isValidationDrawerOpen, setIsValidationDrawerOpen] = useState(false);
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);

  // Validation State
  const [validationResult, setValidationResult] = useState({ valid: true, errors: [], warnings: [] });
  const [isValidating, setIsValidating] = useState(false);

  // Node Dragging State
  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const dragStartOffsetRef = useRef({ x: 0, y: 0 });

  // Connection Dragging State (Port to Port)
  const [connectingSource, setConnectingSource] = useState(null); // { nodeId, portName }
  const [connectingMousePos, setConnectingMousePos] = useState(null);

  // Execution State
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);

  const canvasRef = useRef(null);

  // 1. Load Catalogue and Workflow Definition
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const catRes = await api.getNodeCatalogue();
        if (mounted && catRes && catRes.data) {
          setCatalogue(catRes.data);
          const map = {};
          for (const item of catRes.data) {
            map[item.type] = item;
          }
          setCatalogueMap(map);
        }

        if (workflowId) {
          const wfRes = await api.getWorkflow(workflowId);
          if (mounted && wfRes && wfRes.data) {
            const wf = wfRes.data;
            setWorkflow(wf);
            setWorkflowName(wf.name || "Untitled Workflow");
            setWorkflowVersion(wf.version || 1);

            const def = wf.definition || { nodes: [], edges: [] };
            setNodes(def.nodes || []);
            setEdges(def.edges || []);
            setIsDirty(false);

            // Initial validation check
            validateDefinition(def);
          }
        }
      } catch (err) {
        console.error("Failed to load workflow editor:", err);
      }
    }

    init();
    return () => {
      mounted = false;
    };
  }, [workflowId]);

  // Keyboard Shortcuts (Delete, Save)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+S / Cmd+S
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
      // Delete or Backspace to delete selected element
      if ((e.key === "Delete" || e.key === "Backspace") && selectedElement) {
        // Only if not actively typing in an input or textarea
        if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
        if (selectedElement.type === "node") {
          handleDeleteNode(selectedElement.id);
        } else if (selectedElement.type === "edge") {
          handleDeleteEdge(selectedElement.id);
        }
      }
      // Escape to clear selection
      if (e.key === "Escape") {
        setSelectedElement(null);
        setConnectingSource(null);
        setConnectingMousePos(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedElement, nodes, edges, workflowName]);

  // Construct current standard workflow JSON object
  const getWorkflowJson = useCallback(() => {
    return {
      schemaVersion: 1,
      name: workflowName,
      nodes,
      edges,
    };
  }, [workflowName, nodes, edges]);

  // Validate current definition
  const validateDefinition = async (customDef = null) => {
    setIsValidating(true);
    try {
      const def = customDef || getWorkflowJson();
      const res = await api.validateRawWorkflow(def);
      if (res && res.data) {
        setValidationResult(res.data);
      }
    } catch (err) {
      console.error("Validation error:", err);
    } finally {
      setIsValidating(false);
    }
  };

  // Add a node to the canvas
  const handleAddNode = (catalogueNode) => {
    // Generate unique node ID e.g. "node_01", "node_02"
    let index = nodes.length + 1;
    let newId = `node_${String(index).padStart(2, "0")}`;
    while (nodes.some((n) => n.id === newId)) {
      index++;
      newId = `node_${String(index).padStart(2, "0")}`;
    }

    // Place in center of current pan viewport
    const container = canvasRef.current;
    const viewWidth = container ? container.clientWidth : 800;
    const viewHeight = container ? container.clientHeight : 600;

    const posX = Math.round((-pan.x + viewWidth / 2 - 120) / scale);
    const posY = Math.round((-pan.y + viewHeight / 2 - 60) / scale);

    // Initial config defaults from schema
    const initialConfig = {};
    if (catalogueNode.configSchema) {
      for (const [k, s] of Object.entries(catalogueNode.configSchema)) {
        if (s.default !== undefined) {
          initialConfig[k] = s.default;
        }
      }
    }

    const newNode = {
      id: newId,
      type: catalogueNode.type,
      version: 1,
      name: catalogueNode.label || newId,
      position: { x: posX, y: posY },
      config: initialConfig,
    };

    const nextNodes = [...nodes, newNode];
    setNodes(nextNodes);
    setSelectedElement({ id: newId, type: "node" });
    setIsDirty(true);

    // Re-validate
    validateDefinition({ ...getWorkflowJson(), nodes: nextNodes });
  };

  // Update existing node
  const handleUpdateNode = (updatedNode) => {
    const nextNodes = nodes.map((n) => (n.id === updatedNode.id ? updatedNode : n));
    setNodes(nextNodes);
    setIsDirty(true);
    validateDefinition({ ...getWorkflowJson(), nodes: nextNodes });
  };

  // Delete node and attached edges
  const handleDeleteNode = (nodeId) => {
    const nextNodes = nodes.filter((n) => n.id !== nodeId);
    const nextEdges = edges.filter((e) => e.source !== nodeId && e.target !== nodeId);

    setNodes(nextNodes);
    setEdges(nextEdges);
    if (selectedElement?.id === nodeId) {
      setSelectedElement(null);
    }
    setIsDirty(true);
    validateDefinition({ ...getWorkflowJson(), nodes: nextNodes, edges: nextEdges });
  };

  // Delete edge
  const handleDeleteEdge = (edgeId) => {
    const nextEdges = edges.filter((e) => e.id !== edgeId);
    setEdges(nextEdges);
    if (selectedElement?.id === edgeId) {
      setSelectedElement(null);
    }
    setIsDirty(true);
    validateDefinition({ ...getWorkflowJson(), edges: nextEdges });
  };

  // Start dragging a node
  const handleStartDragNode = (nodeId, e) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    setSelectedElement({ id: nodeId, type: "node" });
    setDraggingNodeId(nodeId);

    dragStartOffsetRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      nodeX: node.position.x,
      nodeY: node.position.y,
    };
  };

  // Start port connection drag
  const handleStartConnection = (nodeId, portName, e) => {
    setConnectingSource({ nodeId, portName });

    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setConnectingMousePos({
        x: (e.clientX - rect.left - pan.x) / scale,
        y: (e.clientY - rect.top - pan.y) / scale,
      });
    }
  };

  // Complete connection on target port
  const handleCompleteConnection = (targetNodeId, targetPortName) => {
    if (!connectingSource) return;

    const sourceNodeId = connectingSource.nodeId;
    const sourcePortName = connectingSource.portName;

    // Reject self-loop
    if (sourceNodeId === targetNodeId) {
      setConnectingSource(null);
      setConnectingMousePos(null);
      return;
    }

    // Check duplicate
    const exists = edges.some(
      (e) =>
        e.source === sourceNodeId &&
        e.sourcePort === sourcePortName &&
        e.target === targetNodeId &&
        e.targetPort === targetPortName
    );

    if (!exists) {
      let edgeIndex = edges.length + 1;
      let newEdgeId = `edge_${String(edgeIndex).padStart(2, "0")}`;
      while (edges.some((e) => e.id === newEdgeId)) {
        edgeIndex++;
        newEdgeId = `edge_${String(edgeIndex).padStart(2, "0")}`;
      }

      const newEdge = {
        id: newEdgeId,
        source: sourceNodeId,
        sourcePort: sourcePortName,
        target: targetNodeId,
        targetPort: targetPortName,
      };

      const nextEdges = [...edges, newEdge];
      setEdges(nextEdges);
      setIsDirty(true);
      validateDefinition({ ...getWorkflowJson(), edges: nextEdges });
    }

    setConnectingSource(null);
    setConnectingMousePos(null);
  };

  // Mouse move handler on canvas
  const handleCanvasMouseMove = (e) => {
    if (draggingNodeId) {
      const dx = (e.clientX - dragStartOffsetRef.current.mouseX) / scale;
      const dy = (e.clientY - dragStartOffsetRef.current.mouseY) / scale;

      const newX = Math.round(dragStartOffsetRef.current.nodeX + dx);
      const newY = Math.round(dragStartOffsetRef.current.nodeY + dy);

      setNodes((prev) =>
        prev.map((n) => (n.id === draggingNodeId ? { ...n, position: { x: newX, y: newY } } : n))
      );
      setIsDirty(true);
    } else if (isPanning) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      panStartRef.current = { x: e.clientX, y: e.clientY };
    } else if (connectingSource && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setConnectingMousePos({
        x: (e.clientX - rect.left - pan.x) / scale,
        y: (e.clientY - rect.top - pan.y) / scale,
      });
    }
  };

  const handleCanvasMouseUp = () => {
    if (draggingNodeId) {
      setDraggingNodeId(null);
    }
    if (isPanning) {
      setIsPanning(false);
    }
    if (connectingSource) {
      setConnectingSource(null);
      setConnectingMousePos(null);
    }
  };

  const handleCanvasMouseDown = (e) => {
    if (e.target === canvasRef.current || e.target.tagName === "svg" || e.target.classList.contains("workflow-canvas-grid")) {
      setSelectedElement(null);
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  // Zoom handlers
  const handleWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      setScale((prev) => Math.min(Math.max(prev * zoomFactor, 0.4), 2.2));
    }
  };

  // Save workflow definition to backend
  const handleSave = async () => {
    if (!workflowId) return;
    setIsSaving(true);
    setSaveSuccessMsg("");

    try {
      const definition = getWorkflowJson();
      const res = await api.updateWorkflow(workflowId, {
        name: workflowName,
        definition,
      });

      if (res && res.data) {
        setWorkflow(res.data);
        setWorkflowVersion(res.data.version);
        setIsDirty(false);
        setSaveSuccessMsg(`Saved as v${res.data.version}`);
        setTimeout(() => setSaveSuccessMsg(""), 3000);

        if (res.data.validation) {
          setValidationResult(res.data.validation);
        }
      }
    } catch (err) {
      console.error("Failed to save workflow:", err);
      alert(`Save failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Run execution
  const handleExecuteRun = async (triggerData) => {
    setIsRunning(true);
    try {
      // First auto-save if dirty
      if (isDirty) {
        await handleSave();
      }

      const res = await api.executeWorkflow(workflowId, { triggerData });
      if (res && res.data) {
        setRunResult(res.data);
      }
    } catch (err) {
      console.error("Execution failed:", err);
      setRunResult({
        status: "FAILED",
        error: { message: err.message },
        finalOutput: null,
      });
    } finally {
      setIsRunning(false);
    }
  };

  const selectedNode = selectedElement?.type === "node" ? nodes.find((n) => n.id === selectedElement.id) : null;
  const selectedMetadata = selectedNode ? catalogueMap[selectedNode.type] : null;

  return (
    <div style={{ width: "100%", height: "calc(100vh - 65px)", display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg-main)", position: "relative" }}>
      {/* Top Action & Status Bar */}
      <div
        style={{
          height: "56px",
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--bg-card)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          zIndex: 25,
        }}
      >
        {/* Left: Back & Title */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={onBack}
            title="Back to workflows"
            style={{
              padding: "6px 12px",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-full)",
              color: "var(--text-primary)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
              fontSize: "0.82rem",
              fontWeight: "600",
            }}
          >
            <ArrowLeft size={14} />
            Workflows
          </button>

          <button
            onClick={() => setIsPaletteOpen(!isPaletteOpen)}
            title="Toggle Node Catalogue"
            style={{
              padding: "6px 10px",
              background: isPaletteOpen ? "var(--brand-light)" : "var(--bg-secondary)",
              border: `1px solid ${isPaletteOpen ? "var(--brand-border)" : "var(--border-subtle)"}`,
              borderRadius: "var(--radius-sm)",
              color: isPaletteOpen ? "var(--brand)" : "var(--text-secondary)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
          >
            <SidebarIcon size={16} />
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              type="text"
              value={workflowName}
              onChange={(e) => {
                setWorkflowName(e.target.value);
                setIsDirty(true);
              }}
              style={{
                background: "transparent",
                border: "none",
                borderBottom: "1px dashed var(--border-medium)",
                color: "var(--text-primary)",
                fontSize: "1.05rem",
                fontWeight: "700",
                outline: "none",
                padding: "2px 4px",
                width: "220px",
              }}
            />

            <span
              style={{
                fontSize: "0.7rem",
                fontWeight: "700",
                padding: "2px 8px",
                borderRadius: "10px",
                background: "var(--brand-light)",
                color: "var(--brand)",
                border: "1px solid var(--brand-border)",
              }}
            >
              v{workflowVersion}
            </span>

            {isDirty && (
              <span style={{ fontSize: "0.72rem", color: "#f59e0b", display: "flex", alignItems: "center", gap: "4px" }}>
                • Unsaved changes
              </span>
            )}
            {saveSuccessMsg && (
              <span style={{ fontSize: "0.75rem", color: "#10b981", display: "flex", alignItems: "center", gap: "4px" }}>
                <Check size={13} /> {saveSuccessMsg}
              </span>
            )}
          </div>
        </div>

        {/* Right: Validation Pill, Save & Run Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Validation Status Pill */}
          <button
            onClick={() => setIsValidationDrawerOpen(!isValidationDrawerOpen)}
            style={{
              padding: "6px 12px",
              borderRadius: "20px",
              fontSize: "0.78rem",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: validationResult.valid ? "rgba(16, 185, 129, 0.15)" : "rgba(244, 63, 94, 0.15)",
              color: validationResult.valid ? "#10b981" : "#f43f5e",
              border: `1px solid ${validationResult.valid ? "rgba(16, 185, 129, 0.3)" : "rgba(244, 63, 94, 0.4)"}`,
              cursor: "pointer",
            }}
          >
            {isValidating ? (
              <Loader2 size={13} className="animate-spin" />
            ) : validationResult.valid ? (
              <CheckCircle2 size={14} />
            ) : (
              <AlertCircle size={14} />
            )}
            <span>
              {isValidating
                ? "Validating..."
                : validationResult.valid
                ? "Definition Valid"
                : `${validationResult.errors.length} Issue${validationResult.errors.length > 1 ? "s" : ""}`}
            </span>
          </button>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              padding: "7px 14px",
              background: isDirty ? "var(--brand)" : "var(--bg-secondary)",
              border: `1px solid ${isDirty ? "var(--brand-border)" : "var(--border-subtle)"}`,
              borderRadius: "var(--radius-sm)",
              color: isDirty ? "#ffffff" : "var(--text-secondary)",
              fontSize: "0.85rem",
              fontWeight: "600",
              cursor: isSaving ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: isDirty ? "0 0 14px var(--brand-glow)" : "none",
              transition: "all 0.2s ease",
            }}
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {isSaving ? "Saving..." : "Save"}
          </button>

          {/* Run Button */}
          <button
            onClick={() => setIsRunModalOpen(true)}
            className="btn btn-primary"
            style={{
              padding: "7px 18px",
              fontSize: "0.88rem",
              height: "36px",
              borderRadius: "var(--radius-full)"
            }}
          >
            <Play size={14} fill="#ffffff" />
            Run
          </button>
        </div>
      </div>

      {/* Main Workspace Area (Sidebar + Canvas + Inspector) */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
        {/* Node Category Sidebar */}
        <NodePalette
          catalogue={catalogue}
          onAddNode={handleAddNode}
          isOpen={isPaletteOpen}
          onToggle={() => setIsPaletteOpen(!isPaletteOpen)}
        />

        {/* Center Canvas */}
        <div
          ref={canvasRef}
          onWheel={handleWheel}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          className="workflow-canvas-grid"
          style={{
            flex: 1,
            height: "100%",
            position: "relative",
            overflow: "hidden",
            cursor: isPanning ? "grabbing" : "default",
          }}
        >
          {/* Zoom / Viewport Controls Floating Overlay */}
          <div
            style={{
              position: "absolute",
              bottom: "20px",
              right: selectedNode ? "340px" : "20px",
              background: "var(--bg-card)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "10px",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              zIndex: 20,
              boxShadow: "var(--shadow-md)",
              transition: "right 0.2s ease",
            }}
          >
            <button
              onClick={() => setScale((s) => Math.min(s * 1.15, 2.2))}
              title="Zoom In"
              style={{ padding: "6px", background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", borderRadius: "6px" }}
            >
              <ZoomIn size={16} />
            </button>
            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", minWidth: "38px", textAlign: "center" }}>
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale((s) => Math.max(s * 0.85, 0.4))}
              title="Zoom Out"
              style={{ padding: "6px", background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", borderRadius: "6px" }}
            >
              <ZoomOut size={16} />
            </button>
            <div style={{ width: "1px", height: "14px", background: "var(--border-subtle)" }} />
            <button
              onClick={() => {
                setScale(1);
                setPan({ x: 80, y: 60 });
              }}
              title="Reset View"
              style={{ padding: "6px", background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", borderRadius: "6px" }}
            >
              <Maximize2 size={16} />
            </button>
          </div>

          {/* Transform Container */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: "100%",
              height: "100%",
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: "0 0",
              pointerEvents: "none",
            }}
          >
            {/* SVG Layer for Connections */}
            <svg
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: "6000px",
                height: "6000px",
                pointerEvents: "auto",
                overflow: "visible",
              }}
            >
              {/* Render Existing Edges */}
              {edges.map((edge) => {
                const srcNode = nodes.find((n) => n.id === edge.source);
                const tgtNode = nodes.find((n) => n.id === edge.target);
                const isEdgeSelected = selectedElement?.type === "edge" && selectedElement.id === edge.id;
                const edgeHasError = validationResult.errors.some((e) => e.edgeId === edge.id);

                return (
                  <EdgePath
                    key={edge.id}
                    edge={edge}
                    sourceNode={srcNode}
                    targetNode={tgtNode}
                    sourceMetadata={srcNode ? catalogueMap[srcNode.type] : null}
                    targetMetadata={tgtNode ? catalogueMap[tgtNode.type] : null}
                    isSelected={isEdgeSelected}
                    onSelect={(id) => setSelectedElement({ id, type: "edge" })}
                    onDelete={handleDeleteEdge}
                    hasError={edgeHasError}
                    isRunning={isRunning}
                  />
                );
              })}

              {/* In-Progress Interactive Connection Curve */}
              {connectingSource && connectingMousePos && (
                (() => {
                  const srcNode = nodes.find((n) => n.id === connectingSource.nodeId);
                  const srcMeta = srcNode ? catalogueMap[srcNode.type] : null;
                  const start = calculatePortPosition(srcNode, connectingSource.portName, "output", srcMeta);
                  const path = generateBezierPath(start.x, start.y, connectingMousePos.x, connectingMousePos.y);

                  return (
                    <path
                      d={path}
                      fill="none"
                      stroke="var(--accent-cyan)"
                      strokeWidth="2.5"
                      strokeDasharray="6, 6"
                      style={{ pointerEvents: "none" }}
                    />
                  );
                })()
              )}
            </svg>

            {/* Render Nodes Layer */}
            <div style={{ pointerEvents: "auto" }}>
              {nodes.map((node) => {
                const isNodeSelected = selectedElement?.type === "node" && selectedElement.id === node.id;
                const meta = catalogueMap[node.type];
                const task = runResult?.tasks ? runResult.tasks[node.id] : null;

                return (
                  <NodeCard
                    key={node.id}
                    node={node}
                    metadata={meta}
                    isSelected={isNodeSelected}
                    onSelect={(id) => setSelectedElement({ id, type: "node" })}
                    onDelete={handleDeleteNode}
                    onStartDrag={handleStartDragNode}
                    onStartConnection={handleStartConnection}
                    onCompleteConnection={handleCompleteConnection}
                    errors={validationResult.errors}
                    executionTask={task}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Inspector Drawer */}
        {selectedNode && (
          <NodeInspector
            selectedNode={selectedNode}
            metadata={selectedMetadata}
            onUpdateNode={handleUpdateNode}
            onDeleteNode={handleDeleteNode}
            onClose={() => setSelectedElement(null)}
            errors={validationResult.errors}
            executionTask={runResult?.tasks ? runResult.tasks[selectedNode.id] : null}
          />
        )}
      </div>

      {/* Validation Flyout Drawer */}
      <ValidationDrawer
        isOpen={isValidationDrawerOpen}
        onClose={() => setIsValidationDrawerOpen(false)}
        validationResult={validationResult}
        onSelectElement={(id, type) => {
          setSelectedElement({ id, type });
          const targetNode = nodes.find((n) => n.id === id);
          if (targetNode) {
            // Pan smoothly to target node
            setPan({
              x: -targetNode.position.x * scale + 200,
              y: -targetNode.position.y * scale + 200,
            });
          }
        }}
      />

      {/* Run Execution Modal */}
      <RunExecutionModal
        isOpen={isRunModalOpen}
        onClose={() => setIsRunModalOpen(false)}
        workflow={workflow || { name: workflowName, version: workflowVersion }}
        onRun={handleExecuteRun}
        isRunning={isRunning}
        runResult={runResult}
      />
    </div>
  );
}
