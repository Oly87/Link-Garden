import React, { useState, useEffect } from 'react';
import { X, Link, FileText, Video, Sparkles, Sprout, ArrowRight } from 'lucide-react';
import { ItemType, GardenItem } from '../types.js';

interface AddNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGrow: (type: ItemType, content: string, collectionId: string | null) => Promise<GardenItem | null>;
  collections: { id: string; name: string }[];
  activeCollectionId: string | null;
}

const LOADING_STEPS = [
  "Preparing the soil...",
  "Sowing the informational seed...",
  "Watering the core concepts...",
  "Sprouting AI summaries...",
  "Synthesizing key takeaways...",
  "Growing tags and insights...",
  "Pruning and final polishing..."
];

export default function AddNodeModal({ isOpen, onClose, onGrow, collections, activeCollectionId }: AddNodeModalProps) {
  const [type, setType] = useState<ItemType>('url');
  const [content, setContent] = useState('');
  const [collectionId, setCollectionId] = useState<string | null>(activeCollectionId);
  const [isGrowing, setIsGrowing] = useState(false);
  const [loadingStepIdx, setLoadingStepIdx] = useState(0);

  useEffect(() => {
    setCollectionId(activeCollectionId);
  }, [activeCollectionId]);

  // Cycle through calming nature loading steps during analysis
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGrowing) {
      setLoadingStepIdx(0);
      interval = setInterval(() => {
        setLoadingStepIdx((prev) => (prev + 1) % LOADING_STEPS.length);
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isGrowing]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsGrowing(true);
    try {
      const success = await onGrow(type, content.trim(), collectionId);
      if (success) {
        setContent('');
        onClose();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGrowing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div 
        id="add-node-dialog"
        className="w-full max-w-xl overflow-hidden bg-white rounded-2xl shadow-2xl border border-sage-100 transition-all"
      >
        {isGrowing ? (
          /* CALM NATURE LOADING STATE */
          <div className="flex flex-col items-center justify-center p-12 text-center bg-garden-cream">
            <div className="relative flex items-center justify-center w-24 h-24 mb-6 rounded-full bg-sage-50 text-sage-600 border border-sage-100">
              <Sprout className="w-12 h-12 animate-bloom text-sage-600" />
              <div className="absolute inset-0 rounded-full border-2 border-dashed border-sage-300 animate-spin [animation-duration:15s]" />
            </div>
            
            <h3 className="font-display text-2xl font-semibold text-garden-slate mb-2">
              Cultivating Your Idea
            </h3>
            
            <div className="h-6 overflow-hidden mt-2">
              <p className="text-sage-600 font-medium text-sm transition-all duration-500">
                {LOADING_STEPS[loadingStepIdx]}
              </p>
            </div>
            
            <p className="max-w-xs mt-4 text-xs text-sage-400">
              Gemini is reading, summarizing, and growing tags for your link. This might take up to 10 seconds.
            </p>
          </div>
        ) : (
          /* FORM ENTRY STATE */
          <form onSubmit={handleSubmit} className="flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-sage-50 bg-garden-cream">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-sage-600" />
                <h3 className="font-display font-semibold text-lg text-garden-slate">
                  Plant a New Seed
                </h3>
              </div>
              <button 
                type="button" 
                onClick={onClose}
                className="p-1 rounded-full text-sage-400 hover:text-garden-slate hover:bg-sage-50 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-6">
              {/* Type Selection */}
              <div>
                <label className="block text-xs font-semibold text-sage-500 uppercase tracking-wider mb-2">
                  Seed Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => { setType('url'); setContent(''); }}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-sm font-medium transition ${
                      type === 'url' 
                        ? 'bg-sage-50 border-sage-400 text-sage-800' 
                        : 'border-sage-100 text-sage-500 hover:bg-sage-50'
                    }`}
                  >
                    <Link className="w-4 h-4" />
                    Web Link
                  </button>
                  <button
                    type="button"
                    onClick={() => { setType('note'); setContent(''); }}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-sm font-medium transition ${
                      type === 'note' 
                        ? 'bg-sage-50 border-sage-400 text-sage-800' 
                        : 'border-sage-100 text-sage-500 hover:bg-sage-50'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    Note / Idea
                  </button>
                  <button
                    type="button"
                    onClick={() => { setType('video'); setContent(''); }}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-sm font-medium transition ${
                      type === 'video' 
                        ? 'bg-sage-50 border-sage-400 text-sage-800' 
                        : 'border-sage-100 text-sage-500 hover:bg-sage-50'
                    }`}
                  >
                    <Video className="w-4 h-4" />
                    Video Link
                  </button>
                </div>
              </div>

              {/* Content Input */}
              <div>
                <label className="block text-xs font-semibold text-sage-500 uppercase tracking-wider mb-2">
                  {type === 'url' && "Website URL"}
                  {type === 'note' && "Note Content"}
                  {type === 'video' && "YouTube or Video URL"}
                </label>
                
                {type === 'note' ? (
                  <textarea
                    rows={5}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Scribble your quick thought, snippet, or book quote here..."
                    className="w-full p-4 border border-sage-100 rounded-xl bg-garden-cream focus:ring-2 focus:ring-sage-300 focus:outline-none text-garden-slate placeholder-sage-300 text-sm"
                    required
                  />
                ) : (
                  <div className="relative">
                    <input
                      type="url"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder={type === 'video' ? "https://youtube.com/watch?v=..." : "https://example.com/article-slug"}
                      className="w-full p-4 pl-12 border border-sage-100 rounded-xl bg-garden-cream focus:ring-2 focus:ring-sage-300 focus:outline-none text-garden-slate placeholder-sage-300 text-sm"
                      required
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-sage-300">
                      {type === 'url' ? <Link className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                    </div>
                  </div>
                )}
              </div>

              {/* Collection Folder Assignment */}
              <div>
                <label className="block text-xs font-semibold text-sage-500 uppercase tracking-wider mb-2">
                  Assign to Garden Biome (Optional)
                </label>
                <select
                  value={collectionId || ''}
                  onChange={(e) => setCollectionId(e.target.value || null)}
                  className="w-full p-3 border border-sage-100 rounded-xl bg-garden-cream focus:ring-2 focus:ring-sage-300 focus:outline-none text-garden-slate text-sm"
                >
                  <option value="">Unassigned (General Undergrowth)</option>
                  {collections.map(coll => (
                    <option key={coll.id} value={coll.id}>
                      {coll.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-sage-50 bg-garden-cream">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-sage-600 hover:text-garden-slate transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!content.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-sage-600 text-white rounded-xl text-sm font-medium hover:bg-sage-700 shadow-md hover:shadow-lg disabled:opacity-50 disabled:shadow-none transition"
              >
                Plant Seed
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
