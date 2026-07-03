import React, { useState, useMemo } from 'react';
import { Sprout, Clock, Compass, BookOpen, Link, FileText, Video } from 'lucide-react';
import { GardenItem } from '../types.js';

interface SproutsGraphProps {
  items: GardenItem[];
  onFocusItem: (id: string) => void;
}

export default function SproutsGraph({ items, onFocusItem }: SproutsGraphProps) {
  const [selectedNode, setSelectedNode] = useState<GardenItem | null>(null);

  // Filter out archived items
  const activeItems = useMemo(() => {
    return items.filter(item => !item.archived);
  }, [items]);

  // Organic coordinate generation (Radial layout with randomized offsets so it looks like a growing plant/tree)
  const nodePositions = useMemo(() => {
    const positions: { [id: string]: { x: number; y: number } } = {};
    const center = { x: 50, y: 50 }; // percentages

    activeItems.forEach((item, idx) => {
      // Alternate radius and angles to distribute organically
      const total = activeItems.length;
      const angle = (idx / total) * 2 * Math.PI + (idx % 2 === 0 ? 0.2 : -0.2);
      const radius = 20 + (idx % 3) * 10; // distributed rings

      positions[item.id] = {
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle)
      };
    });

    return positions;
  }, [activeItems]);

  // Calculate connections (lines) between nodes sharing tags or category
  const connections = useMemo(() => {
    const lines: { id: string; from: { x: number; y: number }; to: { x: number; y: number }; sharedTags: string[] }[] = [];
    const processedPairs = new Set<string>();

    activeItems.forEach((itemA) => {
      activeItems.forEach((itemB) => {
        if (itemA.id === itemB.id) return;
        const pairKey = [itemA.id, itemB.id].sort().join('-');
        if (processedPairs.has(pairKey)) return;

        // Check for shared tags
        const tagsA = itemA.aiMetadata?.tags || [];
        const tagsB = itemB.aiMetadata?.tags || [];
        const sharedTags = tagsA.filter(tag => tagsB.includes(tag));

        // Connect if they share categories or tags
        const sharesCategory = itemA.aiMetadata?.category === itemB.aiMetadata?.category;
        
        if (sharedTags.length > 0 || (sharesCategory && itemA.aiMetadata?.category)) {
          const fromPos = nodePositions[itemA.id];
          const toPos = nodePositions[itemB.id];
          
          if (fromPos && toPos) {
            lines.push({
              id: pairKey,
              from: fromPos,
              to: toPos,
              sharedTags: sharedTags
            });
            processedPairs.add(pairKey);
          }
        }
      });
    });

    return lines;
  }, [activeItems, nodePositions]);

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'url': return <Link className="w-4.5 h-4.5 text-sage-600" />;
      case 'video': return <Video className="w-4.5 h-4.5 text-rose-500" />;
      case 'note': return <FileText className="w-4.5 h-4.5 text-amber-500" />;
      default: return <Sprout className="w-4.5 h-4.5 text-sage-600" />;
    }
  };

  return (
    <div className="relative w-full h-[550px] bg-white border border-sage-100 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between">
      {/* Graph Header */}
      <div className="absolute top-4 left-4 z-10 bg-white/80 backdrop-blur-sm p-3.5 border border-sage-100 rounded-xl max-w-xs">
        <h4 className="font-display font-semibold text-sm text-garden-slate flex items-center gap-1.5 leading-none">
          <Sprout className="w-4 h-4 text-sage-500 animate-bloom" />
          The Knowledge Sprouts
        </h4>
        <p className="text-[10px] text-sage-400 mt-1 font-mono leading-relaxed">
          Nodes represent saved seeds. Lines sprout where ideas share categories or tag roots. Click nodes to trace connections.
        </p>
      </div>

      {/* Floating details summary card (if node selected) */}
      {selectedNode && (
        <div className="absolute bottom-4 left-4 right-4 md:right-auto md:w-96 z-10 p-4 bg-garden-cream border border-sage-200 rounded-xl shadow-lg animate-fade-in space-y-3">
          <div className="flex items-start justify-between">
            <span className="px-2.5 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-mono bg-white border border-sage-100 text-sage-500">
              {selectedNode.aiMetadata.category || 'General'}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-sage-400 font-mono">
              <Clock className="w-3.5 h-3.5" />
              {selectedNode.aiMetadata.readingTime || 2}m read
            </span>
          </div>
          
          <h5 className="font-display font-semibold text-sm text-garden-slate line-clamp-1">
            {selectedNode.aiMetadata.title}
          </h5>
          
          <p className="text-xs text-sage-500 line-clamp-2 italic">
            "{selectedNode.aiMetadata.summary}"
          </p>

          <div className="flex items-center justify-between pt-2 border-t border-sage-100/70">
            <div className="flex flex-wrap gap-1">
              {selectedNode.aiMetadata.tags.slice(0, 2).map(tag => (
                <span key={tag} className="px-1.5 py-0.5 bg-white text-[9px] font-mono rounded text-sage-400 border border-sage-50">
                  #{tag}
                </span>
              ))}
            </div>
            <button
              onClick={() => { onFocusItem(selectedNode.id); }}
              className="flex items-center gap-0.5 text-[10px] font-bold text-sage-600 hover:text-garden-slate hover:underline"
            >
              Reveal Node
              <Compass className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* SVG Canvas Workspace */}
      <div className="flex-1 w-full relative">
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {/* Connection lines */}
          {connections.map((line) => (
            <line
              key={line.id}
              x1={`${line.from.x}%`}
              y1={`${line.from.y}%`}
              x2={`${line.to.x}%`}
              y2={`${line.to.y}%`}
              className="stroke-sage-200 hover:stroke-sage-400 transition"
              strokeWidth="1.5"
              strokeDasharray={line.sharedTags.length > 0 ? "0" : "4 4"}
            />
          ))}
        </svg>

        {/* Botanical leaf nodes */}
        {activeItems.map((item) => {
          const pos = nodePositions[item.id] || { x: 50, y: 50 };
          const isSelected = selectedNode?.id === item.id;
          return (
            <div
              key={item.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10 group"
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              onClick={() => setSelectedNode(item)}
            >
              {/* Pulse effect */}
              <div className={`absolute inset-0 rounded-full transition-all duration-300 scale-150 ${
                isSelected 
                  ? 'bg-sage-400/20' 
                  : 'bg-sage-100/10 group-hover:bg-sage-200/20'
              }`} />
              
              {/* Main circle */}
              <div className={`relative flex items-center justify-center w-10 h-10 rounded-full border shadow-sm transition duration-300 ${
                isSelected
                  ? 'bg-sage-500 text-white border-sage-600 scale-110'
                  : 'bg-white border-sage-200 text-sage-500 hover:border-sage-400'
              }`}>
                {getItemIcon(item.type)}
                
                {/* Floating label on hover */}
                <span className="absolute bottom-11 scale-0 group-hover:scale-100 bg-garden-slate text-white text-[10px] py-1 px-2.5 rounded-lg whitespace-nowrap shadow-md pointer-events-none transition origin-bottom font-display">
                  {item.aiMetadata.title}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
