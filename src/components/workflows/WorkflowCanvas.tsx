import { useCallback, useRef, useState, useEffect } from "react";
import type { WorkflowNode, WorkflowEdge, WorkflowNodeType } from "./designer-types";
import { NODE_META } from "./designer-types";
import { CheckCircle2, GitBranch, Zap, Bell } from "lucide-react";

const ICON_MAP = { CheckCircle2, GitBranch, Zap, Bell };
const NODE_W = 180;
const NODE_H = 64;

interface CanvasProps {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onMoveNode: (id: string, x: number, y: number) => void;
  onAddEdge: (from: string, to: string) => void;
  onDeleteNode: (id: string) => void;
  onDeleteEdge: (id: string) => void;
}

export const WorkflowCanvas = ({
  nodes, edges, selectedNodeId, onSelectNode, onMoveNode, onAddEdge, onDeleteNode, onDeleteEdge,
}: CanvasProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<{ id: string; offX: number; offY: number } | null>(null);
  const [connecting, setConnecting] = useState<{ fromId: string; mx: number; my: number } | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const toSvg = useCallback((clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: clientX - rect.left - pan.x, y: clientY - rect.top - pan.y };
  }, [pan]);

  const handleMouseDown = (e: React.MouseEvent, nodeId?: string) => {
    if (nodeId) {
      const node = nodes.find((n) => n.id === nodeId)!;
      const p = toSvg(e.clientX, e.clientY);
      if (e.shiftKey) {
        setConnecting({ fromId: nodeId, mx: p.x, my: p.y });
      } else {
        setDragging({ id: nodeId, offX: p.x - node.x, offY: p.y - node.y });
        onSelectNode(nodeId);
      }
      e.stopPropagation();
    } else {
      onSelectNode(null);
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging) {
      const p = toSvg(e.clientX, e.clientY);
      onMoveNode(dragging.id, p.x - dragging.offX, p.y - dragging.offY);
    } else if (connecting) {
      const p = toSvg(e.clientX, e.clientY);
      setConnecting((c) => c ? { ...c, mx: p.x, my: p.y } : null);
    } else if (isPanning) {
      setPan({
        x: panStart.current.panX + (e.clientX - panStart.current.x),
        y: panStart.current.panY + (e.clientY - panStart.current.y),
      });
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (connecting) {
      const p = toSvg(e.clientX, e.clientY);
      const target = nodes.find(
        (n) => p.x >= n.x && p.x <= n.x + NODE_W && p.y >= n.y && p.y <= n.y + NODE_H && n.id !== connecting.fromId
      );
      if (target) onAddEdge(connecting.fromId, target.id);
      setConnecting(null);
    }
    setDragging(null);
    setIsPanning(false);
  };

  const getEdgePath = (from: WorkflowNode, to: WorkflowNode) => {
    const x1 = from.x + NODE_W / 2;
    const y1 = from.y + NODE_H;
    const x2 = to.x + NODE_W / 2;
    const y2 = to.y;
    const cy = (y1 + y2) / 2;
    return `M${x1},${y1} C${x1},${cy} ${x2},${cy} ${x2},${y2}`;
  };

  const getIcon = (type: WorkflowNodeType) => {
    const meta = NODE_META[type];
    const Icon = ICON_MAP[meta.icon as keyof typeof ICON_MAP];
    return Icon;
  };

  return (
    <svg
      ref={svgRef}
      className="w-full h-full bg-muted/20 cursor-grab active:cursor-grabbing"
      onMouseDown={(e) => handleMouseDown(e)}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--muted-foreground))" opacity="0.5" />
        </marker>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.4" />
        </pattern>
      </defs>

      <g transform={`translate(${pan.x},${pan.y})`}>
        <rect x="-5000" y="-5000" width="10000" height="10000" fill="url(#grid)" />

        {/* Edges */}
        {edges.map((edge) => {
          const from = nodes.find((n) => n.id === edge.from);
          const to = nodes.find((n) => n.id === edge.to);
          if (!from || !to) return null;
          return (
            <g key={edge.id}>
              <path
                d={getEdgePath(from, to)}
                fill="none"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth="2"
                opacity="0.4"
                markerEnd="url(#arrowhead)"
                className="cursor-pointer hover:opacity-100"
                onDoubleClick={() => onDeleteEdge(edge.id)}
              />
              {edge.label && (
                <text
                  x={(from.x + to.x + NODE_W) / 2}
                  y={(from.y + NODE_H + to.y) / 2}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px]"
                >
                  {edge.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Connecting line */}
        {connecting && (() => {
          const from = nodes.find((n) => n.id === connecting.fromId);
          if (!from) return null;
          return (
            <line
              x1={from.x + NODE_W / 2} y1={from.y + NODE_H}
              x2={connecting.mx} y2={connecting.my}
              stroke="hsl(var(--accent))" strokeWidth="2" strokeDasharray="6,3" opacity="0.7"
            />
          );
        })()}

        {/* Nodes */}
        {nodes.map((node) => {
          const meta = NODE_META[node.type];
          const Icon = getIcon(node.type);
          const isSelected = selectedNodeId === node.id;
          return (
            <g
              key={node.id}
              transform={`translate(${node.x},${node.y})`}
              onMouseDown={(e) => handleMouseDown(e, node.id)}
              className="cursor-move"
            >
              <rect
                width={NODE_W} height={NODE_H} rx="12"
                fill="hsl(var(--card))"
                stroke={isSelected ? meta.color : "hsl(var(--border))"}
                strokeWidth={isSelected ? 2.5 : 1}
                className="drop-shadow-sm"
              />
              {/* Color accent bar */}
              <rect x="0" y="0" width="4" height={NODE_H} rx="2" fill={meta.color} />
              {/* Icon */}
              <foreignObject x="14" y={(NODE_H - 20) / 2} width="20" height="20">
                <Icon size={18} style={{ color: meta.color }} />
              </foreignObject>
              {/* Label */}
              <text x="42" y={NODE_H / 2 - 6} className="fill-foreground text-[12px] font-semibold" dominantBaseline="middle">
                {node.label || meta.label}
              </text>
              <text x="42" y={NODE_H / 2 + 10} className="fill-muted-foreground text-[10px]" dominantBaseline="middle">
                {meta.label}
              </text>
              {/* Delete button */}
              {isSelected && (
                <g
                  transform={`translate(${NODE_W - 20}, 4)`}
                  className="cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); onDeleteNode(node.id); }}
                >
                  <circle r="8" cx="8" cy="8" fill="hsl(var(--destructive))" opacity="0.8" />
                  <text x="8" y="8" textAnchor="middle" dominantBaseline="central" className="fill-white text-[10px]">✕</text>
                </g>
              )}
            </g>
          );
        })}
      </g>

      {/* Help text */}
      <text x="16" y="24" className="fill-muted-foreground/50 text-[11px]">
        Shift+سحب للربط • نقر مزدوج لحذف خط • اسحب للتحريك
      </text>
    </svg>
  );
};
