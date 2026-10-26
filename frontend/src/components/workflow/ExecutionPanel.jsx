import React, { useState } from "react";
import { 
  X, 
  CheckCircle2, 
  XCircle, 
  FastForward, 
  Ban, 
  Clock, 
  Copy, 
  Check, 
  Terminal, 
  Layers, 
  Sparkles, 
  ArrowRight,
  Code2,
  History,
  RotateCcw,
  Sliders,
  ChevronRight,
  ChevronDown,
  Info,
  Calendar,
  AlertTriangle
} from "lucide-react";

export default function ExecutionPanel({
  isOpen,
  onClose,
  runResult,
  workflow,
  onSelectNode,
  recentRuns = [],
  onLoadRun,
  isLoadingHistory = false,
}) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "timeline" | "input" | "output" | "history"
  const [copiedField, setCopiedField] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [taskInspectorTab, setTaskInspectorTab] = useState("outputs"); // "outputs" | "inputs" | "raw"

  const handleCopy = (text, fieldName) => {
    navigator.clipboard.writeText(typeof text === "object" ? JSON.stringify(text, null, 2) : String(text));
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const tasksMap = runResult?.tasks || runResult?.nodeResults || {};
  const taskList = Object.values(tasksMap);

  // Sort tasks in chronological execution order
  const orderedTasks = [...taskList].sort((a, b) => {
    const timeA = a.startedAt ? new Date(a.startedAt).getTime() : (a.completedAt ? new Date(a.completedAt).getTime() : 0);
    const timeB = b.startedAt ? new Date(b.startedAt).getTime() : (b.completedAt ? new Date(b.completedAt).getTime() : 0);
    return timeA - timeB;
  });

  const selectedTask = selectedTaskId ? tasksMap[selectedTaskId] : null;

  return (
    <div
      style={{
        position: "fixed",
        right: 0,
        top: "56px",
        bottom: 0,
        width: "520px",
        maxWidth: "92vw",
        background: "var(--bg-card)",
        backdropFilter: "blur(25px)",
        WebkitBackdropFilter: "blur(25px)",
        borderLeft: "1px solid var(--border-subtle)",
        boxShadow: "-10px 0 35px rgba(0, 0, 0, 0.65)",
        zIndex: 35,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        animation: "slideInRight 0.25s ease-out",
      }}
    >
      {/* Panel Top Header */}
      <div
        style={{
          padding: "14px 18px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--bg-secondary)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              background: "linear-gradient(135deg, #39AEA9, #557B83)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Terminal size={15} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h3 style={{ fontSize: "0.92rem", fontWeight: "700", color: "var(--text-primary)" }}>
                Execution Inspector
              </h3>
              {runResult && (
                <span
                  style={{
                    fontSize: "0.68rem",
                    padding: "1px 7px",
                    borderRadius: "10px",
                    fontWeight: "700",
                    background: runResult.status === "SUCCEEDED" ? "rgba(16, 185, 129, 0.15)" : "rgba(244, 63, 94, 0.15)",
                    color: runResult.status === "SUCCEEDED" ? "#10b981" : "#f43f5e",
                    border: `1px solid ${runResult.status === "SUCCEEDED" ? "rgba(16, 185, 129, 0.3)" : "rgba(244, 63, 94, 0.3)"}`,
                  }}
                >
                  {runResult.status}
                </span>
              )}
            </div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
              {runResult?.runId ? `Run ID: ${runResult.runId.slice(0, 18)}...` : "Live Workflow State"}
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            padding: "4px",
            borderRadius: "4px",
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border-subtle)", background: "rgba(0,0,0,0.2)" }}>
        {[
          { id: "overview", label: "Overview", icon: Info },
          { id: "timeline", label: `Timeline (${orderedTasks.length})`, icon: Clock },
          { id: "input", label: "Inbound Input", icon: Code2 },
          { id: "output", label: "Final Result", icon: CheckCircle2 },
          { id: "history", label: "Recent Runs", icon: History },
        ].map((tab) => {
          const isAct = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: "9px 6px",
                background: "transparent",
                border: "none",
                borderBottom: isAct ? "2px solid var(--brand)" : "2px solid transparent",
                color: isAct ? "var(--text-primary)" : "var(--text-muted)",
                fontSize: "0.72rem",
                fontWeight: isAct ? "700" : "500",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
              }}
            >
              <Icon size={12} color={isAct ? "var(--brand)" : "var(--text-muted)"} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Body Area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {!runResult ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)", fontSize: "0.82rem" }}>
                No active or selected execution run to display. Run the workflow or select from history.
              </div>
            ) : (
              <>
                {/* Status Hero Card */}
                <div
                  style={{
                    padding: "14px",
                    borderRadius: "10px",
                    background: runResult.status === "SUCCEEDED" ? "rgba(16, 185, 129, 0.08)" : "rgba(244, 63, 94, 0.08)",
                    border: `1px solid ${runResult.status === "SUCCEEDED" ? "rgba(16, 185, 129, 0.3)" : "rgba(244, 63, 94, 0.3)"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {runResult.status === "SUCCEEDED" ? (
                      <CheckCircle2 size={24} color="#10b981" />
                    ) : (
                      <XCircle size={24} color="#f43f5e" />
                    )}
                    <div>
                      <div style={{ fontSize: "0.95rem", fontWeight: "800", color: runResult.status === "SUCCEEDED" ? "#10b981" : "#f43f5e" }}>
                        Workflow {runResult.status}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                        Trigger: <strong>{runResult.triggerType || "MANUAL"}</strong>
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.9rem", fontWeight: "800", color: "var(--text-primary)" }}>
                      {runResult.durationMs || 0} ms
                    </div>
                    <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Total Duration</div>
                  </div>
                </div>

                {/* Metadata Table */}
                <div
                  style={{
                    background: "var(--bg-secondary)",
                    borderRadius: "8px",
                    border: "1px solid var(--border-subtle)",
                    overflow: "hidden",
                    fontSize: "0.75rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)" }}>
                    <span style={{ color: "var(--text-muted)" }}>Run ID</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <code style={{ color: "var(--brand)" }}>{runResult.runId}</code>
                      <button
                        type="button"
                        onClick={() => handleCopy(runResult.runId, "runId")}
                        style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0 }}
                      >
                        {copiedField === "runId" ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)" }}>
                    <span style={{ color: "var(--text-muted)" }}>Workflow</span>
                    <span style={{ fontWeight: "600", color: "var(--text-primary)" }}>{workflow?.name}</span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)" }}>
                    <span style={{ color: "var(--text-muted)" }}>Started At</span>
                    <span>{runResult.startedAt ? new Date(runResult.startedAt).toLocaleTimeString() : "N/A"}</span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px" }}>
                    <span style={{ color: "var(--text-muted)" }}>Finished At</span>
                    <span>{runResult.completedAt || runResult.finishedAt ? new Date(runResult.completedAt || runResult.finishedAt).toLocaleTimeString() : "N/A"}</span>
                  </div>
                </div>

                {/* Error Banner if Failed */}
                {runResult.error && (
                  <div
                    style={{
                      background: "rgba(244, 63, 94, 0.1)",
                      border: "1px solid rgba(244, 63, 94, 0.35)",
                      borderRadius: "8px",
                      padding: "12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#f43f5e", fontSize: "0.8rem", fontWeight: "700" }}>
                      <AlertTriangle size={14} /> Execution Error Detail
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-primary)", lineHeight: 1.4 }}>
                      {runResult.error.message || JSON.stringify(runResult.error)}
                    </div>
                  </div>
                )}

                {/* Quick Task Status Counter */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                  <div style={{ padding: "10px", background: "var(--bg-secondary)", borderRadius: "8px", border: "1px solid var(--border-subtle)", textAlign: "center" }}>
                    <div style={{ fontSize: "1.1rem", fontWeight: "800", color: "#10b981" }}>
                      {taskList.filter((t) => t.status === "SUCCEEDED").length}
                    </div>
                    <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Succeeded</div>
                  </div>
                  <div style={{ padding: "10px", background: "var(--bg-secondary)", borderRadius: "8px", border: "1px solid var(--border-subtle)", textAlign: "center" }}>
                    <div style={{ fontSize: "1.1rem", fontWeight: "800", color: "#9ca3af" }}>
                      {taskList.filter((t) => t.status === "SKIPPED").length}
                    </div>
                    <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Skipped</div>
                  </div>
                  <div style={{ padding: "10px", background: "var(--bg-secondary)", borderRadius: "8px", border: "1px solid var(--border-subtle)", textAlign: "center" }}>
                    <div style={{ fontSize: "1.1rem", fontWeight: "800", color: "#f59e0b" }}>
                      {taskList.filter((t) => t.status === "BLOCKED").length}
                    </div>
                    <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Blocked</div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* TIMELINE TAB */}
        {activeTab === "timeline" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "4px" }}>
              Ordered DAG node execution sequence. Click a node to view its inputs and outputs.
            </div>

            {orderedTasks.map((task, idx) => {
              const isSelected = selectedTaskId === task.nodeId;
              let statusColor = "#10b981";
              let StatusIcon = CheckCircle2;

              if (task.status === "FAILED") {
                statusColor = "#f43f5e";
                StatusIcon = XCircle;
              } else if (task.status === "SKIPPED") {
                statusColor = "#9ca3af";
                StatusIcon = FastForward;
              } else if (task.status === "BLOCKED") {
                statusColor = "#f59e0b";
                StatusIcon = Ban;
              }

              return (
                <div
                  key={task.nodeId}
                  onClick={() => {
                    setSelectedTaskId(task.nodeId);
                    onSelectNode?.(task.nodeId);
                  }}
                  style={{
                    background: isSelected ? "rgba(57, 174, 169, 0.12)" : "var(--bg-secondary)",
                    border: `1px solid ${isSelected ? "var(--brand)" : "var(--border-subtle)"}`,
                    borderRadius: "8px",
                    padding: "10px 12px",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                        #{idx + 1}
                      </span>
                      <StatusIcon size={14} color={statusColor} />
                      <span style={{ fontSize: "0.8rem", fontWeight: "700", color: "var(--text-primary)" }}>
                        {task.nodeName || task.nodeId}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span
                        style={{
                          fontSize: "0.66rem",
                          fontWeight: "700",
                          color: statusColor,
                          padding: "1px 6px",
                          borderRadius: "4px",
                          background: `${statusColor}18`,
                        }}
                      >
                        {task.status}
                      </span>
                      {task.durationMs !== null && task.durationMs !== undefined && (
                        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                          {task.durationMs}ms
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.68rem", color: "var(--text-muted)" }}>
                    <code>{task.nodeType || "unknown"}</code>
                    <span>ID: {task.nodeId}</span>
                  </div>

                  {/* Inline Selected Node Output / Error Drawer */}
                  {isSelected && (
                    <div
                      style={{
                        marginTop: "6px",
                        paddingTop: "8px",
                        borderTop: "1px solid var(--border-subtle)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setTaskInspectorTab("outputs"); }}
                          style={{
                            padding: "2px 8px",
                            fontSize: "0.68rem",
                            borderRadius: "4px",
                            border: "none",
                            background: taskInspectorTab === "outputs" ? "var(--brand)" : "var(--bg-input)",
                            color: taskInspectorTab === "outputs" ? "#fff" : "var(--text-muted)",
                            cursor: "pointer",
                          }}
                        >
                          Outputs
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setTaskInspectorTab("inputs"); }}
                          style={{
                            padding: "2px 8px",
                            fontSize: "0.68rem",
                            borderRadius: "4px",
                            border: "none",
                            background: taskInspectorTab === "inputs" ? "var(--brand)" : "var(--bg-input)",
                            color: taskInspectorTab === "inputs" ? "#fff" : "var(--text-muted)",
                            cursor: "pointer",
                          }}
                        >
                          Inputs
                        </button>
                      </div>

                      <pre
                        style={{
                          background: "var(--bg-input)",
                          padding: "8px",
                          borderRadius: "6px",
                          fontSize: "0.72rem",
                          fontFamily: "var(--font-mono)",
                          color: "var(--text-primary)",
                          maxHeight: "130px",
                          overflowY: "auto",
                          margin: 0,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {JSON.stringify(taskInspectorTab === "outputs" ? (task.outputs || task.output || "None") : (task.inputs || task.input || "None"), null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* INPUT TAB */}
        {activeTab === "input" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.74rem", fontWeight: "700", color: "var(--text-secondary)" }}>
                Original Inbound Trigger Payload
              </span>
              <button
                type="button"
                onClick={() => handleCopy(runResult?.input, "inputJson")}
                style={{
                  background: "transparent",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "6px",
                  padding: "4px 8px",
                  fontSize: "0.72rem",
                  color: copiedField === "inputJson" ? "#10b981" : "var(--brand)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                {copiedField === "inputJson" ? <Check size={12} /> : <Copy size={12} />}
                {copiedField === "inputJson" ? "Copied" : "Copy Payload"}
              </button>
            </div>

            <pre
              style={{
                background: "var(--bg-input)",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid var(--border-subtle)",
                fontSize: "0.78rem",
                fontFamily: "var(--font-mono)",
                color: "var(--text-primary)",
                maxHeight: "450px",
                overflowY: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                margin: 0,
              }}
            >
              {JSON.stringify(runResult?.input || {}, null, 2)}
            </pre>
          </div>
        )}

        {/* FINAL RESULT TAB */}
        {activeTab === "output" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.74rem", fontWeight: "700", color: "var(--text-secondary)" }}>
                Persisted Final Workflow Output
              </span>
              <button
                type="button"
                onClick={() => handleCopy(runResult?.finalOutput || runResult?.output, "outputJson")}
                style={{
                  background: "transparent",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "6px",
                  padding: "4px 8px",
                  fontSize: "0.72rem",
                  color: copiedField === "outputJson" ? "#10b981" : "var(--brand)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                {copiedField === "outputJson" ? <Check size={12} /> : <Copy size={12} />}
                {copiedField === "outputJson" ? "Copied" : "Copy Output"}
              </button>
            </div>

            <pre
              style={{
                background: "var(--bg-input)",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid var(--border-subtle)",
                fontSize: "0.78rem",
                fontFamily: "var(--font-mono)",
                color: "var(--text-primary)",
                maxHeight: "450px",
                overflowY: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                margin: 0,
              }}
            >
              {JSON.stringify(runResult?.finalOutput !== undefined ? runResult.finalOutput : (runResult?.output || "No output produced"), null, 2)}
            </pre>
          </div>
        )}

        {/* RUN HISTORY TAB */}
        {activeTab === "history" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "4px" }}>
              Persisted PostgreSQL executions for this workflow. Click to load onto canvas and timeline.
            </div>

            {isLoadingHistory ? (
              <div style={{ textAlign: "center", padding: "30px 0" }}>
                <Clock size={20} className="animate-spin" style={{ margin: "0 auto" }} />
              </div>
            ) : recentRuns.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                No prior runs recorded for this workflow yet.
              </div>
            ) : (
              recentRuns.map((r) => {
                const isLoaded = runResult?.id === r.id || runResult?.runId === r.id;
                return (
                  <div
                    key={r.id}
                    onClick={() => onLoadRun?.(r.id)}
                    style={{
                      padding: "10px 12px",
                      background: isLoaded ? "rgba(57, 174, 169, 0.12)" : "var(--bg-secondary)",
                      border: `1px solid ${isLoaded ? "var(--brand)" : "var(--border-subtle)"}`,
                      borderRadius: "8px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span
                          style={{
                            fontSize: "0.68rem",
                            fontWeight: "700",
                            color: r.status === "SUCCEEDED" ? "#10b981" : "#f43f5e",
                          }}
                        >
                          {r.status}
                        </span>
                        <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>•</span>
                        <code style={{ fontSize: "0.7rem", color: "var(--text-primary)" }}>
                          {r.id.slice(0, 8)}...
                        </code>
                        <span style={{ fontSize: "0.65rem", padding: "1px 5px", background: "var(--bg-input)", borderRadius: "4px", color: "var(--text-muted)" }}>
                          {r.triggerType || "MANUAL"}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.66rem", color: "var(--text-muted)", marginTop: "2px" }}>
                        {r.createdAt ? new Date(r.createdAt).toLocaleString() : "N/A"}
                      </div>
                    </div>

                    <div style={{ textAlign: "right", fontSize: "0.72rem", color: "var(--text-muted)" }}>
                      <div>{r.durationMs || 0}ms</div>
                      <div style={{ fontSize: "0.65rem" }}>{r.taskCount || 0} tasks</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
