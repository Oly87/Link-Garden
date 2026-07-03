import React, { useState } from 'react';
import { Sparkles, Brain, Award, ShieldAlert, ArrowUpRight, Compass, CompassIcon, Split, HelpCircle, Loader2, RotateCw } from 'lucide-react';
import { GardenReflection as ReflectionType } from '../types.js';

interface GardenReflectionProps {
  reflection: ReflectionType | null;
  onGrowReflection: () => Promise<void>;
  itemCount: number;
}

export default function GardenReflection({ reflection, onGrowReflection, itemCount }: GardenReflectionProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGrow = async () => {
    setIsGenerating(true);
    try {
      await onGrowReflection();
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const getPercentageBarColor = (index: number) => {
    switch (index % 3) {
      case 0: return 'bg-sage-500';
      case 1: return 'bg-sky-400';
      case 2: return 'bg-purple-400';
      default: return 'bg-sage-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Dynamic Summary Card or Empty State */}
      {!reflection ? (
        <div className="flex flex-col items-center justify-center text-center p-12 bg-white border border-sage-100 rounded-2xl shadow-sm max-w-2xl mx-auto">
          <div className="p-4 rounded-full bg-sage-50 border border-sage-100 text-sage-600 mb-4 animate-bloom">
            <Brain className="w-12 h-12" />
          </div>
          <h3 className="font-display font-semibold text-2xl text-garden-slate mb-2">
            Grow Your First Reflection
          </h3>
          <p className="text-sm text-sage-500 max-w-md mb-6 leading-relaxed">
            Plant some seeds (save links, write notes) and let our AI Librarian review your knowledge garden. You'll unlock insights about your learning focus, hidden gaps, recurring connections, and paradoxes.
          </p>
          <button
            onClick={handleGrow}
            disabled={isGenerating || itemCount === 0}
            className="flex items-center gap-2 px-6 py-3 bg-sage-600 text-white rounded-xl font-medium text-sm hover:bg-sage-700 shadow-md hover:shadow-lg disabled:opacity-50 transition"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Reflecting over garden...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Grow AI Garden Reflection
              </>
            )}
          </button>
          {itemCount === 0 && (
            <p className="text-xs text-rose-500 mt-2 font-mono">
              Please save at least 1 link or note first before asking for a reflection!
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main learning narrative card (Col span 2) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Health and learning narrative */}
            <div className="p-6 bg-white border border-sage-100 rounded-2xl shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-sage-50 text-sage-600">
                    <Brain className="w-5 h-5" />
                  </div>
                  <h3 className="font-display font-semibold text-lg text-garden-slate">
                    Garden Cognitive Summary
                  </h3>
                </div>
                <button
                  onClick={handleGrow}
                  disabled={isGenerating}
                  className="flex items-center gap-1 text-xs font-semibold text-sage-500 hover:text-garden-slate hover:bg-sage-50 py-1.5 px-3 rounded-lg border border-sage-100 transition"
                >
                  {isGenerating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RotateCw className="w-3.5 h-3.5" />
                  )}
                  Regrow
                </button>
              </div>

              <div className="p-4 bg-sage-50/50 border border-sage-100 rounded-xl">
                <p className="text-sm text-sage-700 leading-relaxed italic">
                  "{reflection.recentLearnings}"
                </p>
              </div>

              <span className="text-[10px] text-sage-400 font-mono block text-right pt-2 border-t border-sage-50">
                Librarian review calculated on {new Date(reflection.updatedAt).toLocaleString()}
              </span>
            </div>

            {/* Overlapping frameworks (connections) & paradoxes (contradictions) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Connections */}
              <div className="p-6 bg-white border border-sage-100 rounded-2xl shadow-sm space-y-4">
                <h4 className="font-display font-semibold text-base text-garden-slate flex items-center gap-2">
                  <Split className="w-4 h-4 text-sky-500" />
                  Interconnected Biomes
                </h4>
                <ul className="space-y-3">
                  {reflection.recurringIdeas?.map((idea, idx) => (
                    <li key={idx} className="text-xs text-sage-600 leading-relaxed bg-sky-50/20 border border-sky-100/50 p-3 rounded-xl">
                      {idea}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Paradoxes */}
              <div className="p-6 bg-white border border-sage-100 rounded-2xl shadow-sm space-y-4">
                <h4 className="font-display font-semibold text-base text-garden-slate flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-500" />
                  Workflow Paradoxes
                </h4>
                <ul className="space-y-3">
                  {reflection.contradictions?.map((para, idx) => (
                    <li key={idx} className="text-xs text-sage-600 leading-relaxed bg-rose-50/20 border border-rose-100/50 p-3 rounded-xl">
                      {para}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Sidebar Metrics (Col span 1) */}
          <div className="space-y-6">
            {/* Top Topics Density Bento */}
            <div className="p-6 bg-white border border-sage-100 rounded-2xl shadow-sm space-y-4">
              <h4 className="font-display font-semibold text-base text-garden-slate flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                Garden Flora Density
              </h4>
              <div className="space-y-4">
                {reflection.topTopics?.map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-garden-slate">{item.topic}</span>
                      <span className="text-sage-400 font-mono">{item.count}% focus</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-50 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${getPercentageBarColor(idx)}`} 
                        style={{ width: `${item.count}%` }} 
                      />
                    </div>
                    <p className="text-[10px] text-sage-500 italic leading-normal">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Gaps Warning */}
            <div className="p-6 bg-white border border-sage-100 rounded-2xl shadow-sm space-y-3">
              <h4 className="font-display font-semibold text-base text-garden-slate flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                Under-Watered Patches
              </h4>
              <p className="text-xs text-sage-400 leading-relaxed mb-2">
                Areas of knowledge you haven't saved links or snippets on recently:
              </p>
              <div className="space-y-2">
                {reflection.knowledgeGaps?.map((gap, idx) => (
                  <div key={idx} className="p-2.5 bg-amber-50/40 border border-amber-100 text-xs text-sage-700 rounded-xl leading-relaxed">
                    {gap}
                  </div>
                ))}
              </div>
            </div>

            {/* Recommendations */}
            <div className="p-6 bg-white border border-sage-100 rounded-2xl shadow-sm space-y-3">
              <h4 className="font-display font-semibold text-base text-garden-slate flex items-center gap-2">
                <Compass className="w-4 h-4 text-sage-600" />
                Seed Suggestions
              </h4>
              <div className="space-y-2">
                {reflection.recommendations?.map((rec, idx) => (
                  <div key={idx} className="flex gap-2 p-2 rounded-xl hover:bg-sage-50 transition border border-transparent hover:border-sage-100">
                    <div className="w-5 h-5 rounded-full bg-sage-100 flex items-center justify-center text-sage-600 font-mono text-[10px] font-semibold shrink-0">
                      {idx + 1}
                    </div>
                    <p className="text-xs text-sage-600 leading-normal font-medium">
                      {rec}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
