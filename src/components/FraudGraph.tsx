import React, { useState, useEffect, useRef } from 'react';
import { Shield, AlertOctagon, RefreshCw, UserCheck, Heart, FileText, User, HelpCircle, Phone, CreditCard, ChevronRight, Activity, Cpu } from 'lucide-react';

export interface GraphNode {
  id: string;
  label: string;
  type: 'doctor' | 'agent' | 'policy' | 'claim' | 'branch' | 'bank_account' | 'phone';
  detail: string;
  group: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface GraphLink {
  source: string;
  target: string;
  rel: string;
}

interface Syndicate {
  id: string;
  name: string;
  type: string;
  description: string;
  indicatorColor: string;
  metrics: {
    claimsCount: number;
    totalSoughtAmount: number;
    suspectedAgent: string;
    mainLink: string;
  };
  nodes: Omit<GraphNode, 'x' | 'y' | 'vx' | 'vy'>[];
  links: GraphLink[];
}

export default function FraudGraph() {
  const [syndicates, setSyndicates] = useState<Syndicate[]>([]);
  const [selectedSyndicate, setSelectedSyndicate] = useState<Syndicate | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Simulation Nodes & Links
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  
  // Interactive UI States
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  
  // Gemini Explanation states
  const [analysisText, setAnalysisText] = useState<string>('');
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 500, height: 400 });

  // Update container size dynamically
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setDimensions({
          width: Math.max(400, entry.contentRect.width),
          height: Math.max(350, entry.contentRect.height),
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Fetch all syndicates on mount
  useEffect(() => {
    const fetchSyndicates = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/fraud-graph');
        const data = await res.json();
        setSyndicates(data.syndicates || []);
        if (data.syndicates && data.syndicates.length > 0) {
          handleSelectSyndicate(data.syndicates[0]);
        }
      } catch (err) {
        console.error("Error loading fraud syndicates:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSyndicates();
  }, []);

  // Set nodes and start simulation
  const handleSelectSyndicate = (synd: Syndicate) => {
    setSelectedSyndicate(synd);
    setSelectedNode(null);
    setAnalysisText('');
    setAnalysisError(null);

    // Give nodes initial random positions around the center
    const cx = dimensions.width / 2;
    const cy = dimensions.height / 2;
    const initialNodes = synd.nodes.map((n, i) => {
      const angle = (i / synd.nodes.length) * Math.PI * 2;
      const radius = 100 + Math.random() * 30;
      return {
        ...n,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        vx: 0,
        vy: 0
      } as GraphNode;
    });

    setNodes(initialNodes);
    setLinks(synd.links);
    
    // Auto trigger Gemini forensic graph briefing
    triggerForensicAnalysis(synd);
  };

  const triggerForensicAnalysis = async (synd: Syndicate) => {
    try {
      setLoadingAnalysis(true);
      setAnalysisError(null);
      
      const response = await fetch('/api/fraud-explain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          syndicateId: synd.id,
          syndicateName: synd.name,
          description: synd.description,
          metrics: synd.metrics
        })
      });

      if (!response.ok) {
        throw new Error("Could not process Forensic intelligence query targeting Gemini AI model.");
      }

      const data = await response.json();
      setAnalysisText(data.analysis);
    } catch (err: any) {
      setAnalysisError(err.message || "Ensure process.env.GEMINI_API_KEY is defined.");
    } finally {
      setLoadingAnalysis(false);
    }
  };

  // SVG Node Physics Step Simulation
  useEffect(() => {
    if (nodes.length === 0) return;

    let animId: number;
    const cx = dimensions.width / 2;
    const cy = dimensions.height / 2;

    const stepSimulation = () => {
      setNodes((prevNodes) => {
        // Create lookup dictionary for speedy operations
        const nodeMap = new Map<string, GraphNode>(prevNodes.map(n => [n.id, n] as [string, GraphNode]));

        // Calculate forces
        const nextNodes = prevNodes.map((node) => {
          if (node.id === draggedNodeId) return node; // Skip dragged node

          let fx = 0;
          let fy = 0;

          // 1. Center Gravity force
          fx += (cx - node.x) * 0.01;
          fy += (cy - node.y) * 0.01;

          // 2. Node Repulsion (Anti-clumping)
          prevNodes.forEach((other) => {
            if (other.id === node.id) return;
            const dx = node.x - other.x;
            const dy = node.y - other.y;
            const distSq = dx * dx + dy * dy || 1;
            const dist = Math.sqrt(distSq);
            if (dist < 180) {
              const repel = (180 - dist) * 0.12;
              fx += (dx / dist) * repel;
              fy += (dy / dist) * repel;
            }
          });

          // 3. Link Attraction
          links.forEach((link) => {
            let otherId: string | null = null;
            if (link.source === node.id) {
              otherId = link.target;
            } else if (link.target === node.id) {
              otherId = link.source;
            }

            if (otherId) {
              const other = nodeMap.get(otherId);
              if (other) {
                const dx = other.x - node.x;
                const dy = other.y - node.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                // Target spring distance
                const targetDist = 90;
                if (dist > targetDist) {
                  const pull = (dist - targetDist) * 0.025;
                  fx += (dx / dist) * pull;
                  fy += (dy / dist) * pull;
                }
              }
            }
          });

          // Apply forces to velocity with friction/damping
          const vx = (node.vx + fx) * 0.82;
          const vy = (node.vy + fy) * 0.82;

          // Update position
          let x = node.x + vx;
          let y = node.y + vy;

          // 4. Elastic containment boundaries
          const margin = 25;
          if (x < margin) { x = margin; }
          if (x > dimensions.width - margin) { x = dimensions.width - margin; }
          if (y < margin) { y = margin; }
          if (y > dimensions.height - margin) { y = dimensions.height - margin; }

          return { ...node, x, y, vx, vy };
        });

        return nextNodes;
      });

      animId = requestAnimationFrame(stepSimulation);
    };

    animId = requestAnimationFrame(stepSimulation);
    return () => cancelAnimationFrame(animId);
  }, [nodes, links, draggedNodeId, dimensions]);

  // Handle Drag Events
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>, node: GraphNode) => {
    (e.target as any).setPointerCapture(e.pointerId);
    setDraggedNodeId(node.id);
    setSelectedNode(node);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!draggedNodeId) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setNodes((prevNodes) =>
      prevNodes.map((n) => (n.id === draggedNodeId ? { ...n, x, y, vx: 0, vy: 0 } : n))
    );
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (draggedNodeId) {
      (e.target as any).releasePointerCapture(e.pointerId);
      setDraggedNodeId(null);
    }
  };

  const getNodeIconColor = (type: string) => {
    switch (type) {
      case 'doctor': return { bg: 'bg-[#DE3E44]', border: 'border-[#EF4444]', text: 'text-white' };
      case 'agent': return { bg: 'bg-[#B5895F]', border: 'border-[#DDB088]', text: 'text-white' };
      case 'policy': return { bg: 'bg-[#1F6F78]', border: 'border-[#2BB5A8]', text: 'text-white' };
      case 'claim': return { bg: 'bg-[#EF4444]/20', border: 'border-[#DE3E44]', text: 'text-[#DE3E44]' };
      case 'bank_account': return { bg: 'bg-[#8F39E8]', border: 'border-[#B270FF]', text: 'text-white' };
      case 'phone': return { bg: 'bg-emerald-600', border: 'border-emerald-400', text: 'text-white' };
      default: return { bg: 'bg-[#3C5451]', border: 'border-[#5C7E7A]', text: 'text-white' };
    }
  };

  const renderNodeIcon = (type: string) => {
    switch (type) {
      case 'doctor': return <Heart size={14} />;
      case 'agent': return <User size={14} />;
      case 'policy': return <FileText size={14} />;
      case 'claim': return <AlertOctagon size={14} />;
      case 'bank_account': return <CreditCard size={14} />;
      case 'phone': return <Phone size={14} />;
      default: return <Activity size={14} />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Simulation Disclaimer */}
      <div className="bg-[#1C1A14] border border-[#B5895F]/30 rounded-xl p-4 flex items-start gap-3">
        <AlertOctagon className="text-[#B5895F] shrink-0 mt-0.5" size={16} />
        <div className="text-xs text-[#819290] leading-relaxed">
          <strong className="text-[#F3EFE9] font-medium block mb-0.5">⚠️ Forensics Simulation Disclaimer</strong>
          All entity nodes, claim records, phone links, and doctor-agent networks visualized on this interactive stage are completely simulated, synthetic data modeled for demonstration purposes. In production environments, this graph-theoretic loop analyzer connects to active Graph Stores (e.g., Neo4j/Amazon Neptune) to run live Cypher queries scanning for bank-mule and collusive crime rings.
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        
        {/* Left column: list of detected suspected networks and key indices info */}
        <div className="xl:w-1/3 space-y-4">
          <div className="bg-[#141B1A] border border-[#2C3C3A] rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="text-[#DE3E44]" size={18} />
              <h4 className="text-xs font-mono text-[#B5895F] tracking-wider uppercase font-semibold">Active Suspect Networks</h4>
            </div>
            
            {loading ? (
              <div className="p-4 text-center text-xs font-mono text-[#8B9F9C] flex items-center justify-center gap-2">
                <RefreshCw size={14} className="animate-spin text-[#2BB5A8]" />
                <span>Scanning active records...</span>
              </div>
            ) : (
              <div className="space-y-3">
                {syndicates.map((synd) => {
                  const isActive = selectedSyndicate?.id === synd.id;
                  return (
                    <button
                      key={synd.id}
                      onClick={() => handleSelectSyndicate(synd)}
                      className={`w-full text-left p-4 rounded-xl transition-all border block relative group ${
                        isActive
                          ? 'bg-[#1c1815] text-[#F3EFE9] border-[#B5895F]'
                          : 'bg-[#101514] border-[#232F2D] text-[#8B9F9C] hover:border-[#2BB5A8]/50'
                      }`}
                    >
                      {/* Left indicator bar */}
                      <span className="absolute top-4 left-0 bottom-4 w-[3px] rounded-r" style={{ backgroundColor: synd.indicatorColor }} />
                      
                      <div className="flex justify-between items-start gap-2 mb-1 pl-1">
                        <span className="font-serif font-bold text-sm text-[#F3EFE9]">{synd.name}</span>
                        <ChevronRight size={14} className="text-[#8B9F9C] group-hover:translate-x-0.5 transition-transform" />
                      </div>
                      
                      <div className="text-[10px] font-mono mb-2 text-[#8B9F9C] bg-[#141B1A] py-0.5 px-2 rounded inline-block">
                        {synd.type}
                      </div>
                      
                      <p className="text-[11px] leading-relaxed text-[#819290] pl-1 font-sans line-clamp-2">
                        {synd.description}
                      </p>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-[9px] font-mono border-t border-[#232F2D]/50 pt-2 pl-1">
                        <div>
                          <span className="text-[#8B9F9C]">SUSPECT CLAIMS:</span>{' '}
                          <strong className="text-[#F3EFE9]">{synd.metrics.claimsCount}</strong>
                        </div>
                        <div>
                          <span className="text-[#8B9F9C]">VOLUME SOUGHT:</span>{' '}
                          <strong className="text-[#DE3E44]">R{(synd.metrics.totalSoughtAmount / 1000).toFixed(0)}k</strong>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Node Icon Legend */}
          <div className="bg-[#141B1A] border border-[#2C3C3A] rounded-xl p-5">
            <h4 className="text-[11px] font-mono text-[#B5895F] tracking-wide uppercase mb-3">Graph Node Legend</h4>
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 rounded bg-[#DE3E44] flex items-center justify-center text-white"><Heart size={10} /></span>
                <span className="text-[#8B9F9C]">Doctors / Clinics</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 rounded bg-[#B5895F] flex items-center justify-center text-white"><User size={10} /></span>
                <span className="text-[#8B9F9C]">Brokers / Agents</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 rounded bg-[#1F6F78] flex items-center justify-center text-white"><FileText size={10} /></span>
                <span className="text-[#8B9F9C]">Policies</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 rounded bg-[#EF4444]/20 border border-[#DE3E44] flex items-center justify-center text-[#DE3E44]"><AlertOctagon size={10} /></span>
                <span className="text-[#8B9F9C]">Claims Submitted</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 rounded bg-[#8F39E8] flex items-center justify-center text-white"><CreditCard size={10} /></span>
                <span className="text-[#8B9F9C]">Bank Accounts</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 rounded bg-emerald-600 flex items-center justify-center text-white"><Phone size={10} /></span>
                <span className="text-[#8B9F9C]">IDs / Multiples</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Columns: Interactive Graph Render with Physics + Inspector */}
        <div className="xl:w-2/3 space-y-6">
          <div className="bg-[#141B1A] border border-[#2C3C3A] rounded-2xl overflow-hidden shadow-xl flex flex-col">
            
            {/* Header / Actions of Graph Window */}
            <div className="bg-[#101514] px-6 py-4 border-b border-[#2C3C3A] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                <span className="text-xs font-mono text-[#2BB5A8] tracking-widest uppercase font-semibold">
                  LIVE INTERACTIVE FORENSIC STAGE
                </span>
              </div>
              <div className="text-[10px] font-mono text-[#8B9F9C]">
                💡 Hint: Drag circles around to re-adjust layout
              </div>
            </div>

            {/* Simulated Canvas viewport */}
            <div 
              ref={containerRef}
              className="bg-[#090D0C]/90 relative cursor-grab active:cursor-grabbing border-b border-[#232F2D] overflow-hidden"
              style={{ height: '440px' }}
            >
              {/* Force directed Graph SVG Layer */}
              <svg
                width="100%"
                height="100%"
                className="select-none"
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              >
                <defs>
                  {/* Arrow pattern definitions for relationships directions */}
                  <marker
                    id="arrow"
                    viewBox="0 0 10 10"
                    refX="22"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#3D5451" />
                  </marker>
                </defs>

                {/* Draw link lines */}
                {links.map((link, idx) => {
                  const sourceNode = nodes.find(n => n.id === link.source);
                  const targetNode = nodes.find(n => n.id === link.target);
                  if (!sourceNode || !targetNode) return null;

                  const midX = (sourceNode.x + targetNode.x) / 2;
                  const midY = (sourceNode.y + targetNode.y) / 2;

                  return (
                    <g key={idx}>
                      <line
                        x1={sourceNode.x}
                        y1={sourceNode.y}
                        x2={targetNode.x}
                        y2={targetNode.y}
                        stroke="#2C3C3A"
                        strokeWidth="1.5"
                        strokeDasharray="4 3"
                        markerEnd="url(#arrow)"
                      />
                      {/* Sub-label for relation edges */}
                      <text
                        x={midX}
                        y={midY - 4}
                        fill="#8B9F9C"
                        fontSize="9"
                        fontFamily="monospace"
                        textAnchor="middle"
                        className="bg-[#090D0C] pointer-events-none select-none opacity-85"
                      >
                        {link.rel}
                      </text>
                    </g>
                  );
                })}

                {/* Draw circles node elements */}
                {nodes.map((node) => {
                  const { bg, border } = getNodeIconColor(node.type);
                  const isSelected = selectedNode?.id === node.id;
                  const isHovered = hoveredNode?.id === node.id;
                  const radius = isSelected ? 22 : 18;

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x},${node.y})`}
                      onPointerDown={(e) => handlePointerDown(e, node)}
                      onMouseEnter={() => setHoveredNode(node)}
                      onMouseLeave={() => setHoveredNode(null)}
                      className="cursor-pointer"
                    >
                      {/* Selection Highlight background glow ring */}
                      {(isSelected || isHovered) && (
                        <circle
                          r={radius + 6}
                          fill="transparent"
                          stroke={isSelected ? "#B5895F" : "#2BB5A8"}
                          strokeWidth="2"
                          strokeDasharray={isHovered && !isSelected ? "3 2" : undefined}
                          className="animate-spin-slow"
                          style={{ transformOrigin: 'center' }}
                        />
                      )}

                      {/* Solid container circle overlay */}
                      <circle
                        r={radius}
                        className={`${bg} border-2 ${border} shadow-[0_4px_10px_rgba(0,0,0,0.5)] transition-all`}
                        style={{ filter: isSelected ? 'drop-shadow(0 0 8px rgba(181,137,95,0.4))' : '' }}
                      />

                      {/* Embedded Lucide Icon representation */}
                      <g transform="translate(-7, -7)" className={`${isSelected ? 'scale-110' : ''} text-[#F3EFE9] pointer-events-none`}>
                        {renderNodeIcon(node.type)}
                      </g>
                    </g>
                  );
                })}
              </svg>

              {/* Dynamic Overlay Floating Tooltip */}
              {hoveredNode && (
                <div 
                  className="absolute pointer-events-none bg-[#0E1312] border border-[#2BB5A8]/50 px-3 py-2 rounded-lg text-[10px] font-mono text-[#F3EFE9] shadow-xl animate-fade-in"
                  style={{
                    left: `${Math.min(dimensions.width - 180, hoveredNode.x + 10)}px`,
                    top: `${Math.min(dimensions.height - 80, hoveredNode.y - 45)}px`,
                    zIndex: 60
                  }}
                >
                  <div className="font-bold text-[#F3EFE9]">{hoveredNode.label}</div>
                  <div className="text-[9px] text-[#2BB5A8] uppercase mb-1">{hoveredNode.type.replace('_', ' ')}</div>
                  <div className="text-[#8B9F9C] text-[9.5px] border-t border-[#232F2D] pt-1 mt-0.5">{hoveredNode.detail}</div>
                </div>
              )}
            </div>

            {/* Bottom Section: Active Node inspector panel details */}
            <div className="p-5 bg-[#101514] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="grid grid-cols-1 mb-1">
                <span className="text-[10px] font-mono text-[#8B9F9C] uppercase">Active Graph Inspector</span>
                {selectedNode ? (
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className={`h-8 w-8 rounded-lg ${getNodeIconColor(selectedNode.type).bg} border ${getNodeIconColor(selectedNode.type).border} flex items-center justify-center text-[#F3EFE9]`}>
                      {renderNodeIcon(selectedNode.type)}
                    </span>
                    <div>
                      <h5 className="font-serif font-bold text-sm text-[#F3EFE9]">{selectedNode.label}</h5>
                      <span className="text-[10px] font-mono text-[#2BB5A8] bg-[#1C2826] px-2 py-0.5 rounded border border-[#2BB5A8]/20">
                        {selectedNode.type.toUpperCase().replace('_', ' ')}: {selectedNode.detail}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[#8B9F9C] italic mt-1.5">No node selected. Click a node circle on the stage to inspect multi-layer attributes.</p>
                )}
              </div>

              {selectedSyndicate && (
                <div className="bg-[#141B1A] px-4 py-2 rounded-xl border border-[#232F2D] text-xs font-mono">
                  <div className="text-[10px] text-[#B5895F] uppercase font-bold mb-1">Selected Syndicate Scope</div>
                  <div className="text-[#F3EFE9] font-serif font-bold">{selectedSyndicate.name}</div>
                  <div className="text-[10.5px] text-[#8B9F9C] mt-0.5">Linked Agent: {selectedSyndicate.metrics.suspectedAgent}</div>
                </div>
              )}
            </div>
          </div>

          {/* Gemini Foreground AI Analysis Panel */}
          <div className="bg-gradient-to-br from-[#121E1C] to-[#0E1514] border border-[#2C3C3A] rounded-2xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-[#4285F4]/10 text-[#4285F4] px-2.5 py-1 rounded-full border border-[#4285F4]/20 text-[9px] font-mono">
              <Cpu size={11} className="animate-spin-slow" />
              <span>Gemini 3.5 Forensics</span>
            </div>
            
            <h4 className="text-xs font-mono text-[#2BB5A8] uppercase tracking-wider mb-4">
              🛡️ Graph Forensic Intelligence Report
            </h4>

            {loadingAnalysis ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
                <RefreshCw size={24} className="animate-spin text-[#2BB5A8]" />
                <span className="text-xs font-mono text-[#8B9F9C]">Grounded Gemini model tracing relation hop queries...</span>
              </div>
            ) : analysisError ? (
              <div className="bg-[#1C1213] border border-red-900/40 rounded-xl p-4 text-xs font-mono text-[#DE3E44] leading-relaxed">
                🚨 Failure compiling deep forensic trace: {analysisError}
              </div>
            ) : (
              <div className="space-y-4 text-sm text-[#F3EFE9] leading-relaxed select-text">
                {/* Visual line divider and markdown printer */}
                <div className="markdown-body prose prose-invert font-sans max-w-none text-[14px]">
                  {analysisText.split(/(### .*)/).map((chunk, index) => {
                    if (chunk.startsWith('### ')) {
                      return (
                        <h4 key={index} className="text-sm font-semibold text-[#B5895F] font-mono tracking-wide uppercase mt-6 mb-2 border-b border-[#2C3C3A] pb-1">
                          {chunk.replace('### ', '')}
                        </h4>
                      );
                    }
                    if (chunk.includes('```')) {
                      // Format Cypher Match expressions
                      const parts = chunk.split(/```/);
                      return parts.map((sub, sIdx) => {
                        if (sIdx % 2 === 1) {
                          return (
                            <pre key={sIdx} className="text-[11.5px] font-mono text-[#C4D0CE] bg-[#0E1312] p-4 rounded-lg overflow-x-auto select-all border border-[#1e2a28] my-3 leading-tight leading-relaxed">
                              {sub.replace('cypher\n', '')}
                            </pre>
                          );
                        }
                        return <p key={sIdx} className="mb-2">{sub}</p>;
                      });
                    }
                    return <p key={index} className="mb-3 text-[#C4D0CE] font-light leading-relaxed whitespace-pre-line">{chunk}</p>;
                  })}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
