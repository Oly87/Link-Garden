import React, { useState } from 'react';
import { Pin, Heart, Archive, Trash2, Clock, Droplets, ChevronDown, ChevronUp, Edit2, Check, ExternalLink, Bookmark, HelpCircle } from 'lucide-react';
import { GardenItem } from '../types.js';

interface GardenCardProps {
  item: GardenItem;
  onUpdate: (id: string, updates: Partial<GardenItem>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function GardenCard({ item, onUpdate, onDelete }: GardenCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [userNote, setUserNote] = useState(item.noteContent || '');
  const [isSavingNote, setIsSavingNote] = useState(false);

  const { title, summary, tags, keyInsights, importanceScore, readingTime, category, suggestedRelatedTopics, actionItems } = item.aiMetadata;

  const handleNoteSave = async () => {
    setIsSavingNote(true);
    try {
      await onUpdate(item.id, { noteContent: userNote.trim() || undefined });
      setIsEditingNote(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingNote(false);
    }
  };

  // Maps categories to elegant soft colors
  const getCategoryColor = (cat: string) => {
    switch (cat?.toLowerCase()) {
      case 'technology': return 'bg-sky-50 text-sky-800 border-sky-100';
      case 'productivity': return 'bg-sage-100 text-sage-800 border-sage-200';
      case 'science': return 'bg-purple-50 text-purple-800 border-purple-100';
      case 'lifestyle': return 'bg-amber-50 text-amber-800 border-amber-100';
      case 'philosophy': return 'bg-rose-50 text-rose-800 border-rose-100';
      case 'health': return 'bg-emerald-50 text-emerald-800 border-emerald-100';
      case 'business': return 'bg-indigo-50 text-indigo-800 border-indigo-100';
      default: return 'bg-slate-50 text-slate-800 border-slate-100';
    }
  };

  return (
    <div 
      className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl bg-white border border-sage-100 hover:border-sage-300 shadow-sm hover:shadow-md transition-all duration-300 ${
        item.pinned ? 'ring-2 ring-sage-400' : ''
      }`}
    >
      {/* Dynamic Header Ribbon */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-sage-200 via-sage-300 to-sage-400 opacity-70" />

      {/* Main Content Area */}
      <div className="p-5 pt-6 flex-1">
        
        {/* Category & Action Badges */}
        <div className="flex items-center justify-between mb-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className={`px-2.5 py-0.5 rounded-full font-medium text-[10px] uppercase tracking-wider border ${getCategoryColor(category)}`}>
              {category || 'Idea'}
            </span>
            <span className="flex items-center gap-1 text-sage-400 font-mono">
              <Clock className="w-3.5 h-3.5" />
              {readingTime ? `${readingTime}m` : '1m'}
            </span>
          </div>

          {/* Quick action buttons (Pin / Heart) */}
          <div className="flex items-center gap-1">
            <button 
              onClick={() => onUpdate(item.id, { pinned: !item.pinned })}
              className={`p-1 rounded-full transition ${
                item.pinned 
                  ? 'text-amber-500 bg-amber-50 hover:bg-amber-100' 
                  : 'text-sage-300 hover:text-sage-600 hover:bg-sage-50'
              }`}
              title={item.pinned ? "Unpin from Canopy" : "Pin to Canopy"}
            >
              <Pin className="w-4 h-4 fill-current" />
            </button>
            <button 
              onClick={() => onUpdate(item.id, { favorite: !item.favorite })}
              className={`p-1 rounded-full transition ${
                item.favorite 
                  ? 'text-rose-500 bg-rose-50 hover:bg-rose-100' 
                  : 'text-sage-300 hover:text-rose-600 hover:bg-rose-50'
              }`}
              title={item.favorite ? "Unfavorite" : "Favorite"}
            >
              <Heart className={`w-4 h-4 ${item.favorite ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>

        {/* Title */}
        <h4 className="font-display font-semibold text-lg text-garden-slate leading-snug group-hover:text-sage-800 transition">
          {item.type === 'url' || item.type === 'video' ? (
            <a 
              href={item.content} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="inline-flex items-baseline gap-1 hover:underline"
            >
              {title}
              <ExternalLink className="w-3.5 h-3.5 shrink-0 text-sage-300" />
            </a>
          ) : (
            title
          )}
        </h4>

        {/* Original Content Source / Note preview (if long) */}
        {item.type === 'note' && (
          <p className="mt-2 text-xs text-sage-400 bg-sage-50/50 border border-dashed border-sage-100 p-2.5 rounded-lg line-clamp-2">
            "{item.content}"
          </p>
        )}

        {/* Summarize block (Cosmos/Reader-like blockquote style) */}
        <p className="mt-3 text-sm text-sage-600 leading-relaxed italic">
          {summary}
        </p>

        {/* Dynamic Tag Leaf Badges */}
        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-4">
            {tags.map(tag => (
              <span 
                key={tag} 
                className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-sage-50/50 border border-sage-100 text-xs font-mono text-sage-500"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Expandable Key Insights & Action Items */}
        {isExpanded && (
          <div className="mt-5 pt-4 border-t border-sage-50 space-y-4 animate-fade-in">
            {/* Insights */}
            {keyInsights && keyInsights.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold text-sage-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Bookmark className="w-3.5 h-3.5 text-sage-500" />
                  Key Insights
                </h5>
                <ul className="space-y-1.5">
                  {keyInsights.map((insight, idx) => (
                    <li key={idx} className="text-xs text-sage-600 pl-3 border-l-2 border-sage-300 leading-relaxed">
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action items */}
            {actionItems && actionItems.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold text-sage-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-sage-500" />
                  Habit Sprouts
                </h5>
                <ul className="space-y-1">
                  {actionItems.map((item, idx) => (
                    <li key={idx} className="text-xs text-sage-600 flex items-start gap-1.5">
                      <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-sage-400 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Suggested Related Topics */}
            {suggestedRelatedTopics && suggestedRelatedTopics.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold text-sage-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-sage-400" />
                  Related Biomes
                </h5>
                <div className="flex flex-wrap gap-1">
                  {suggestedRelatedTopics.map(topic => (
                    <span key={topic} className="px-2 py-0.5 rounded bg-sage-50 text-[11px] text-sage-500 border border-sage-100">
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Collapsible Journal Annotation Form */}
      <div className="px-5 pb-4 border-t border-sage-50 bg-garden-cream">
        <div className="pt-3">
          {isEditingNote ? (
            <div className="space-y-2">
              <textarea
                rows={2}
                value={userNote}
                onChange={(e) => setUserNote(e.target.value)}
                placeholder="Write your personal annotations, research questions, or tags..."
                className="w-full p-2 text-xs border border-sage-100 rounded-lg bg-white focus:ring-1 focus:ring-sage-300 focus:outline-none text-garden-slate placeholder-sage-300"
              />
              <div className="flex justify-end gap-1.5">
                <button
                  onClick={() => { setUserNote(item.noteContent || ''); setIsEditingNote(false); }}
                  className="px-2.5 py-1 text-[11px] font-medium text-sage-400 hover:text-sage-600 transition"
                  disabled={isSavingNote}
                >
                  Cancel
                </button>
                <button
                  onClick={handleNoteSave}
                  className="flex items-center gap-1 px-2.5 py-1 bg-sage-600 text-white rounded-md text-[11px] font-medium hover:bg-sage-700 transition"
                  disabled={isSavingNote}
                >
                  <Check className="w-3 h-3" />
                  {isSavingNote ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {item.noteContent ? (
                  <p className="text-xs text-sage-500 italic line-clamp-2">
                    <span className="font-semibold text-[10px] text-sage-400 uppercase tracking-wider block not-italic">
                      My Annotations
                    </span>
                    "{item.noteContent}"
                  </p>
                ) : (
                  <span className="text-[11px] text-sage-300 italic block">
                    No private journal added...
                  </span>
                )}
              </div>
              <button 
                onClick={() => setIsEditingNote(true)}
                className="p-1 rounded text-sage-400 hover:text-sage-600 hover:bg-sage-50 shrink-0 transition"
                title="Edit Annotations"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Footer Area with Droplets (Importance) & Expand/Prune Controls */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-sage-50/70 text-xs">
          
          {/* Importance Waterdroplets */}
          <div className="flex items-center gap-1 text-sage-500 font-medium" title={`Importance Rating: ${importanceScore}/10`}>
            <Droplets className="w-4 h-4 text-sky-400 shrink-0 fill-current" />
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <span 
                  key={i} 
                  className={`w-1.5 h-1.5 rounded-full ${
                    i < Math.round(importanceScore / 2) ? 'bg-sky-400' : 'bg-slate-100'
                  }`} 
                />
              ))}
            </div>
          </div>

          {/* Expand and Delete Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-0.5 py-1 px-2.5 rounded-lg text-sage-500 hover:text-garden-slate hover:bg-sage-100/50 transition font-medium"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Less
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Grow
                </>
              )}
            </button>
            <button
              onClick={() => onUpdate(item.id, { archived: !item.archived })}
              className={`p-1.5 rounded-lg transition ${
                item.archived 
                  ? 'text-amber-600 bg-amber-50' 
                  : 'text-sage-400 hover:text-sage-600 hover:bg-sage-100/50'
              }`}
              title={item.archived ? "Restore to Garden" : "Archive Node"}
            >
              <Archive className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(item.id)}
              className="p-1.5 rounded-lg text-sage-400 hover:text-rose-600 hover:bg-rose-50 transition"
              title="Prune Node (Delete)"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
