import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sprout, Search, Plus, Sparkles, MessageSquare, Brain, LayoutGrid, 
  List, Calendar, Pin, Heart, Archive, Compass, Folder, PlusCircle, 
  FolderPlus, Loader2, X, AlertCircle, RefreshCw, BookOpen, ChevronRight, HelpCircle
} from 'lucide-react';
import AddNodeModal from './components/AddNodeModal.js';
import GardenCard from './components/GardenCard.js';
import GardenChat from './components/GardenChat.js';
import GardenReflection from './components/GardenReflection.js';
import SproutsGraph from './components/SproutsGraph.js';
import { GardenItem, Collection, ChatMessage, GardenReflection as ReflectionType, ItemType } from './types.js';

export default function App() {
  // Database state
  const [items, setItems] = useState<GardenItem[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [reflection, setReflection] = useState<ReflectionType | null>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<'grid' | 'list' | 'timeline' | 'graph' | 'reflection'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'importance'>('newest');
  const [showArchived, setShowArchived] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  
  // Interactive Panel states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSuggestingCollections, setIsSuggestingCollections] = useState(false);
  const [collectionSuggestions, setCollectionSuggestions] = useState<{name: string, description: string, icon: string}[]>([]);
  const [showSuggestionsDrawer, setShowSuggestionsDrawer] = useState(false);

  // Global loading / error / toast state
  const [isLoading, setIsLoading] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);

  // Fetch initial data on mount
  useEffect(() => {
    fetchInitialData();
  }, []);

  const triggerToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchInitialData = async () => {
    setIsLoading(true);
    setServerError(null);
    try {
      const [itemsRes, collectionsRes, chatRes, reflectionRes] = await Promise.all([
        fetch('/api/items'),
        fetch('/api/collections'),
        fetch('/api/chat'),
        fetch('/api/reflection')
      ]);

      if (!itemsRes.ok || !collectionsRes.ok || !chatRes.ok || !reflectionRes.ok) {
        throw new Error("Failed to contact Link Garden full-stack APIs.");
      }

      const itemsData = await itemsRes.json();
      const collectionsData = await collectionsRes.json();
      const chatData = await chatRes.json();
      const reflectionData = await reflectionRes.json();

      setItems(itemsData);
      setCollections(collectionsData);
      setChatHistory(chatData);
      if (reflectionData && reflectionData.recentLearnings) {
        setReflection(reflectionData);
      }
    } catch (err: any) {
      console.error(err);
      setServerError(err.message || "An unexpected connection error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  // Grow a new item (Gemini Extraction proxy)
  const handleGrowNode = async (type: ItemType, content: string, collectionId: string | null) => {
    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, content, collectionId })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to analyze node.");
      }

      const newItem: GardenItem = await res.json();
      setItems(prev => [newItem, ...prev]);
      triggerToast(`grown: "${newItem.aiMetadata.title}" successfully planted!`);
      
      // Auto-refresh reflections since there's a new item
      triggerSilentReflectionUpdate();
      return newItem;
    } catch (err: any) {
      triggerToast(err.message || "Growing process failed. Ensure API key is set.", 'error');
      return null;
    }
  };

  // Silent reflection check
  const triggerSilentReflectionUpdate = async () => {
    try {
      fetch('/api/reflection/grow', { method: 'POST' })
        .then(res => res.json())
        .then(data => {
          if (data && data.recentLearnings) setReflection(data);
        });
    } catch (e) {
      // Ignored
    }
  };

  // Update item details (Pin, Favorite, Archive, Journal)
  const handleUpdateItem = async (id: string, updates: Partial<GardenItem>) => {
    // Optimistic UI updates
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));

    try {
      const res = await fetch(`/api/items/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (!res.ok) {
        throw new Error("Failed to save updates.");
      }

      const updated: GardenItem = await res.json();
      // Re-set with server confirmed data
      setItems(prev => prev.map(item => item.id === id ? updated : item));
    } catch (err: any) {
      triggerToast("Failed to save changes. Reverting...", "error");
      // Revert initial items
      fetchInitialData();
    }
  };

  // Delete/prune item
  const handleDeleteItem = async (id: string) => {
    const target = items.find(x => x.id === id);
    if (!target) return;
    if (!confirm(`Are you sure you want to prune "${target.aiMetadata.title}" from your garden?`)) return;

    // Optimistic
    setItems(prev => prev.filter(x => x.id !== id));

    try {
      const res = await fetch(`/api/items/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      triggerToast("Node pruned from knowledge garden.");
    } catch (err) {
      triggerToast("Failed to prune node.", "error");
      fetchInitialData();
    }
  };

  // Chat conversation messenger
  const handleSendChatMessage = async (text: string) => {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });

      if (!res.ok) throw new Error();

      const botReply: ChatMessage = await res.json();
      setChatHistory(prev => [
        ...prev, 
        { id: `msg-${Date.now()}-user`, sender: 'user', text, createdAt: new Date().toISOString() },
        botReply
      ]);
    } catch (err) {
      triggerToast("AI Librarian failed to respond. Ensure Gemini key is active.", "error");
    }
  };

  // Clear Chat history
  const handleClearChatHistory = async () => {
    if (!confirm("Are you sure you want to sweep clear your conversation logs?")) return;
    try {
      const res = await fetch('/api/chat/clear', { method: 'POST' });
      if (!res.ok) throw new Error();
      const cleared = await res.json();
      setChatHistory(cleared);
      triggerToast("Chat logs cleared.");
    } catch (e) {
      triggerToast("Failed to clear history.", "error");
    }
  };

  // Trigger manual AI garden reflection
  const handleGrowReflection = async () => {
    try {
      const res = await fetch('/api/reflection/grow', { method: 'POST' });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to analyze.");
      }
      const data = await res.json();
      setReflection(data);
      triggerToast("Garden Reflection refreshed!");
    } catch (err: any) {
      triggerToast(err.message || "Failed to generate reflection.", "error");
    }
  };

  // Query bot garden suggestions for collections
  const handleSuggestCollections = async () => {
    setIsSuggestingCollections(true);
    setShowSuggestionsDrawer(true);
    try {
      const res = await fetch('/api/collections/suggest', { method: 'POST' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCollectionSuggestions(data.suggestions || []);
    } catch (err) {
      triggerToast("AI Botany failed to recommend collections.", "error");
      setShowSuggestionsDrawer(false);
    } finally {
      setIsSuggestingCollections(false);
    }
  };

  // Add suggested collection
  const handleCreateCollection = async (name: string, description: string, icon: string) => {
    try {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, icon })
      });

      if (!res.ok) throw new Error();

      const newColl: Collection = await res.json();
      setCollections(prev => [...prev, newColl]);
      triggerToast(`Biome "${newColl.name}" successfully created!`);
      // Filter suggestions list
      setCollectionSuggestions(prev => prev.filter(x => x.name !== name));
    } catch (e) {
      triggerToast("Failed to seed biome.", "error");
    }
  };

  const handleManualCreateCollection = async () => {
    const name = prompt("Enter a name for your custom garden biome:");
    if (!name || !name.trim()) return;
    const desc = prompt("Enter a quick description of ideas in this biome (optional):") || undefined;
    
    try {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: desc, icon: 'Folder' })
      });

      if (!res.ok) throw new Error();

      const newColl: Collection = await res.json();
      setCollections(prev => [...prev, newColl]);
      triggerToast(`Biome "${newColl.name}" created!`);
    } catch (e) {
      triggerToast("Failed to create biome.", "error");
    }
  };

  // Scroll to and highlight a specific card referenced in chat
  const handleFocusItem = (idOrTitle: string) => {
    // Find item by ID or matching title
    const foundItem = items.find(
      x => x.id === idOrTitle || x.aiMetadata.title.toLowerCase().includes(idOrTitle.toLowerCase())
    );

    if (foundItem) {
      // Toggle archived off if currently looking at unarchived
      if (foundItem.archived) {
        setShowArchived(true);
      } else {
        setShowArchived(false);
      }
      setSelectedCollectionId(foundItem.collectionId);
      setActiveTab('grid');
      setIsChatOpen(false); // Close chat to focus

      // Setup highlight triggers
      setHighlightedItemId(foundItem.id);
      setTimeout(() => {
        const el = document.getElementById(foundItem.id);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);

      // Remove highlight fade-out
      setTimeout(() => setHighlightedItemId(null), 4000);
    } else {
      triggerToast(`Unable to find specific card matching "${idOrTitle}"`, "info");
    }
  };

  // Filter & Sort computation
  const filteredAndSortedItems = useMemo(() => {
    let result = [...items];

    // Filter Archived / Active
    result = result.filter(item => item.archived === showArchived);

    // Filter Favorite
    if (showFavoritesOnly) {
      result = result.filter(item => item.favorite);
    }

    // Filter Biome collection
    if (selectedCollectionId !== null) {
      result = result.filter(item => item.collectionId === selectedCollectionId);
    }

    // Search query matching (title, summary, tags, notes)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item => {
        const title = item.aiMetadata.title.toLowerCase();
        const summary = item.aiMetadata.summary.toLowerCase();
        const tags = item.aiMetadata.tags.map(t => t.toLowerCase()).join(' ');
        const notes = (item.noteContent || '').toLowerCase();
        const category = (item.aiMetadata.category || '').toLowerCase();

        return title.includes(query) || summary.includes(query) || tags.includes(query) || notes.includes(query) || category.includes(query);
      });
    }

    // Sort items
    result.sort((a, b) => {
      if (sortBy === 'importance') {
        return b.aiMetadata.importanceScore - a.aiMetadata.importanceScore;
      }
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return sortBy === 'newest' ? timeB - timeA : timeA - timeB;
    });

    return result;
  }, [items, showArchived, showFavoritesOnly, selectedCollectionId, searchQuery, sortBy]);

  // Grouped timeline helper (grouped by Year-Month)
  const timelineGroups = useMemo(() => {
    const groups: { [key: string]: GardenItem[] } = {};
    filteredAndSortedItems.forEach(item => {
      const date = new Date(item.createdAt);
      const groupKey = date.toLocaleString('default', { month: 'long', year: 'numeric' });
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
    });
    return groups;
  }, [filteredAndSortedItems]);

  return (
    <div className="min-h-screen bg-garden-cream text-garden-slate flex flex-col font-sans relative antialiased select-none">
      
      {/* Toast Alert floating */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 py-3.5 px-5 rounded-xl shadow-xl border animate-fade-in ${
          toast.type === 'error' 
            ? 'bg-rose-50 border-rose-200 text-rose-800' 
            : toast.type === 'info'
            ? 'bg-sky-50 border-sky-200 text-sky-800'
            : 'bg-sage-50 border-sage-200 text-sage-800'
        }`}>
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p className="text-xs font-semibold">{toast.message}</p>
        </div>
      )}

      {/* Main Container Core */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden max-w-[1700px] w-full mx-auto">
        
        {/* Left Botanical Sidebar */}
        <aside className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-sage-100 flex flex-col justify-between shrink-0">
          <div className="p-5 flex-1 overflow-y-auto space-y-7">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-sage-50 border border-sage-100 text-sage-600 rounded-xl animate-bloom">
                <Sprout className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-display font-bold text-base leading-none text-garden-slate tracking-tight">
                  Link Garden
                </h1>
                <span className="text-[10px] text-sage-400 font-mono">
                  Personal knowledge oasis
                </span>
              </div>
            </div>

            {/* GROW NODE BUTTON */}
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-sage-600 text-white rounded-xl text-sm font-medium hover:bg-sage-700 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition active:translate-y-0"
            >
              <Plus className="w-4 h-4" />
              Plant New Seed
            </button>

            {/* Quick stats and connections */}
            <div className="space-y-2">
              <span className="text-[10px] font-semibold text-sage-400 uppercase tracking-widest font-mono block">
                Gardener Tabs
              </span>
              <div className="space-y-1">
                <button
                  onClick={() => { setActiveTab('grid'); setSelectedCollectionId(null); }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-medium transition ${
                    activeTab !== 'reflection' && selectedCollectionId === null
                      ? 'bg-sage-50 text-sage-800 border border-sage-100'
                      : 'text-sage-500 hover:text-garden-slate hover:bg-sage-50/50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Compass className="w-4 h-4" />
                    General Canopy
                  </span>
                  <span className="bg-sage-100 text-sage-600 px-2 py-0.5 rounded-full font-mono text-[10px]">
                    {items.filter(x => !x.archived).length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('reflection')}
                  className={`w-full flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium transition ${
                    activeTab === 'reflection'
                      ? 'bg-sage-50 text-sage-800 border border-sage-100'
                      : 'text-sage-500 hover:text-garden-slate hover:bg-sage-50/50'
                  }`}
                >
                  <Brain className="w-4 h-4 text-purple-400" />
                  Garden Reflections
                  <span className="ml-auto px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 border border-purple-100 text-[9px] uppercase tracking-wide font-mono font-bold animate-bloom">
                    AI
                  </span>
                </button>
              </div>
            </div>

            {/* BIOME BI-FOLD FOLDERS */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-sage-400 uppercase tracking-widest font-mono block">
                  Garden Biomes
                </span>
                <button 
                  onClick={handleManualCreateCollection}
                  className="text-sage-400 hover:text-sage-600 transition"
                  title="Add Custom Biome Folder"
                >
                  <FolderPlus className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1">
                {collections.map(coll => {
                  const count = items.filter(x => x.collectionId === coll.id && !x.archived).length;
                  const isSelected = selectedCollectionId === coll.id;
                  return (
                    <button
                      key={coll.id}
                      onClick={() => { setSelectedCollectionId(coll.id); setActiveTab('grid'); }}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-medium transition ${
                        isSelected && activeTab !== 'reflection'
                          ? 'bg-sage-50 text-sage-800 border border-sage-100'
                          : 'text-sage-500 hover:text-garden-slate hover:bg-sage-50/50'
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <Folder className="w-4 h-4 text-sage-400 shrink-0" />
                        <span className="truncate">{coll.name}</span>
                      </span>
                      <span className="bg-sage-100/50 text-sage-500 px-1.5 py-0.5 rounded-full font-mono text-[9px]">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* AI BIOME CONJURATOR */}
            <div className="p-3 bg-sage-50/50 border border-dashed border-sage-200 rounded-2xl text-center space-y-2.5">
              <Sparkles className="w-5 h-5 mx-auto text-sage-500 animate-bloom" />
              <div>
                <h5 className="font-display font-semibold text-xs text-garden-slate leading-tight">
                  Grow AI Biomes
                </h5>
                <p className="text-[10px] text-sage-400 mt-1 leading-relaxed">
                  Let botanist AI analyze current tags to suggest new beautiful biomes!
                </p>
              </div>
              <button
                onClick={handleSuggestCollections}
                className="w-full py-1.5 px-3 bg-white hover:bg-sage-100 text-sage-700 hover:text-sage-900 border border-sage-200 rounded-xl text-[10px] font-semibold tracking-wide shadow-xs transition"
              >
                Conjur Suggestions
              </button>
            </div>
          </div>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-sage-50 bg-garden-cream">
            <button
              onClick={() => { setShowArchived(!showArchived); }}
              className={`w-full flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium transition ${
                showArchived 
                  ? 'bg-amber-50 text-amber-800 border border-amber-100' 
                  : 'text-sage-500 hover:text-garden-slate hover:bg-sage-50/50'
              }`}
            >
              <Archive className="w-4 h-4" />
              Archived Sprouts
              <span className="ml-auto bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-mono text-[9px]">
                {items.filter(x => x.archived).length}
              </span>
            </button>
          </div>
        </aside>

        {/* Main Content Pane */}
        <main className="flex-1 flex flex-col overflow-y-auto p-5 md:p-7 space-y-6">
          
          {serverError && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-center gap-2.5 text-xs font-semibold">
              <AlertCircle className="w-4 h-4" />
              <p>{serverError}</p>
              <button onClick={fetchInitialData} className="ml-auto flex items-center gap-1 hover:underline">
                <RefreshCw className="w-3.5 h-3.5" />
                Retry connection
              </button>
            </div>
          )}

          {/* Search, Filter options */}
          {activeTab !== 'reflection' && (
            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
              
              {/* Search Seed box */}
              <div className="relative w-full lg:max-w-md shrink-0">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tags, takeaways, titles..."
                  className="w-full py-3.5 pl-11 pr-4 border border-sage-100 rounded-2xl focus:ring-2 focus:ring-sage-300 focus:outline-none bg-white text-garden-slate placeholder-sage-300 text-xs shadow-sm"
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-sage-300">
                  <Search className="w-4 h-4" />
                </div>
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-sage-400 hover:text-garden-slate">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Advanced Sort / Favorites togglers */}
              <div className="w-full lg:w-auto flex flex-wrap gap-2.5 items-center justify-end">
                <button
                  onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                  className={`flex items-center gap-1.5 py-2 px-3.5 border rounded-xl text-xs font-medium transition ${
                    showFavoritesOnly 
                      ? 'bg-rose-50 border-rose-200 text-rose-700' 
                      : 'bg-white border-sage-100 text-sage-500 hover:bg-sage-50'
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${showFavoritesOnly ? 'fill-current' : ''}`} />
                  Favorites
                </button>

                <div className="flex items-center gap-1.5 py-2 px-3.5 bg-white border border-sage-100 rounded-xl text-xs">
                  <span className="text-sage-400">Sort:</span>
                  <select
                    value={sortBy}
                    onChange={(e: any) => setSortBy(e.target.value)}
                    className="font-medium text-sage-600 focus:outline-none bg-transparent cursor-pointer"
                  >
                    <option value="newest">Recently Sown</option>
                    <option value="oldest">Deep Roots</option>
                    <option value="importance">Most Important</option>
                  </select>
                </div>

                {/* View selectors */}
                <div className="flex items-center gap-1 bg-white border border-sage-100 p-1 rounded-xl">
                  <button
                    onClick={() => setActiveTab('grid')}
                    className={`p-2 rounded-lg transition ${activeTab === 'grid' ? 'bg-sage-50 text-sage-700' : 'text-sage-400 hover:text-sage-600'}`}
                    title="Bento Grid View"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setActiveTab('list')}
                    className={`p-2 rounded-lg transition ${activeTab === 'list' ? 'bg-sage-50 text-sage-700' : 'text-sage-400 hover:text-sage-600'}`}
                    title="Minimal List View"
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setActiveTab('timeline')}
                    className={`p-2 rounded-lg transition ${activeTab === 'timeline' ? 'bg-sage-50 text-sage-700' : 'text-sage-400 hover:text-sage-600'}`}
                    title="Timeline Flow View"
                  >
                    <Calendar className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setActiveTab('graph')}
                    className={`p-2 rounded-lg transition ${activeTab === 'graph' ? 'bg-sage-50 text-sage-700' : 'text-sage-400 hover:text-sage-600'}`}
                    title="Knowledge Sprout Graph View"
                  >
                    <Sprout className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Main workspace section renderer */}
          {isLoading ? (
            /* Loading skeletons with nature pulse */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white border border-sage-50 rounded-2xl p-5 space-y-4 animate-pulse">
                  <div className="flex justify-between">
                    <div className="h-4 w-1/3 bg-slate-100 rounded" />
                    <div className="h-4 w-1/4 bg-slate-100 rounded" />
                  </div>
                  <div className="h-6 w-3/4 bg-slate-100 rounded" />
                  <div className="space-y-2">
                    <div className="h-4 bg-slate-100 rounded" />
                    <div className="h-4 w-5/6 bg-slate-100 rounded" />
                  </div>
                  <div className="h-4 w-1/2 bg-slate-100 rounded" />
                </div>
              ))}
            </div>
          ) : activeTab === 'reflection' ? (
            <GardenReflection 
              reflection={reflection} 
              onGrowReflection={handleGrowReflection} 
              itemCount={items.length} 
            />
          ) : activeTab === 'graph' ? (
            <SproutsGraph items={items} onFocusItem={handleFocusItem} />
          ) : filteredAndSortedItems.length === 0 ? (
            /* Zero entries state */
            <div className="flex flex-col items-center justify-center text-center p-12 max-w-md mx-auto">
              <div className="p-4 rounded-full bg-sage-50 text-sage-400 border border-sage-100 mb-4 animate-bloom">
                <Compass className="w-10 h-10" />
              </div>
              <h4 className="font-display font-semibold text-lg text-garden-slate mb-1">
                Quiet in this Biome
              </h4>
              <p className="text-xs text-sage-400 leading-relaxed mb-6">
                No active seeds correspond to your filters. Adjust your filters or plant a new seed node in this patch!
              </p>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="py-2.5 px-4 bg-sage-600 text-white hover:bg-sage-700 rounded-xl text-xs font-semibold shadow-md transition"
              >
                Grow New Sprout
              </button>
            </div>
          ) : activeTab === 'list' ? (
            /* COMPACT LIST VIEW */
            <div className="bg-white border border-sage-100 rounded-2xl overflow-hidden shadow-sm">
              <div className="grid grid-cols-1 divide-y divide-sage-50">
                {filteredAndSortedItems.map(item => (
                  <div 
                    key={item.id}
                    id={item.id}
                    className={`p-4 hover:bg-sage-50/40 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                      highlightedItemId === item.id ? 'bg-amber-50/60 ring-2 ring-amber-300' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="px-2 py-0.2 bg-slate-100 text-slate-700 text-[9px] font-mono rounded uppercase">
                          {item.aiMetadata.category || 'Idea'}
                        </span>
                        <span className="text-[10px] text-sage-400 font-mono">
                          {item.aiMetadata.readingTime}m read
                        </span>
                      </div>
                      <h5 className="font-display font-semibold text-sm text-garden-slate leading-snug truncate">
                        {item.aiMetadata.title}
                      </h5>
                      <p className="text-xs text-sage-500 truncate italic">
                        "{item.aiMetadata.summary}"
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button 
                        onClick={() => handleUpdateItem(item.id, { pinned: !item.pinned })}
                        className={`p-1.5 rounded-lg transition ${item.pinned ? 'text-amber-500' : 'text-sage-300 hover:text-sage-600'}`}
                      >
                        <Pin className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleUpdateItem(item.id, { favorite: !item.favorite })}
                        className={`p-1.5 rounded-lg transition ${item.favorite ? 'text-rose-500' : 'text-sage-300 hover:text-sage-600'}`}
                      >
                        <Heart className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleFocusItem(item.id)}
                        className="p-1.5 bg-sage-50 hover:bg-sage-100 border border-sage-100 text-sage-600 text-[10px] font-bold rounded-lg transition"
                      >
                        Grow Card
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : activeTab === 'timeline' ? (
            /* TIMELINE FLOW VIEW */
            <div className="space-y-8">
              {Object.keys(timelineGroups).map(groupKey => (
                <div key={groupKey} className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-sage-100 pb-2">
                    <Calendar className="w-4 h-4 text-sage-400" />
                    <h4 className="font-display font-bold text-sm text-sage-800">
                      {groupKey}
                    </h4>
                    <span className="text-[10px] bg-sage-100 text-sage-600 px-2 py-0.5 rounded-full font-mono">
                      {timelineGroups[groupKey].length} nodes
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {timelineGroups[groupKey].map(item => (
                      <div 
                        key={item.id} 
                        id={item.id}
                        className={`transition duration-500 ${highlightedItemId === item.id ? 'ring-4 ring-amber-300 rounded-2xl' : ''}`}
                      >
                        <GardenCard 
                          item={item} 
                          onUpdate={handleUpdateItem} 
                          onDelete={handleDeleteItem} 
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* BENTO GRID VIEW */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAndSortedItems.map(item => (
                <div 
                  key={item.id} 
                  id={item.id}
                  className={`transition duration-500 ${highlightedItemId === item.id ? 'ring-4 ring-amber-300 rounded-2xl shadow-xl scale-105' : ''}`}
                >
                  <GardenCard 
                    item={item} 
                    onUpdate={handleUpdateItem} 
                    onDelete={handleDeleteItem} 
                  />
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* FLOATING CHAT BUTTON */}
      {!isChatOpen && (
        <button
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-6 left-6 z-40 flex items-center gap-2 py-3.5 px-5 bg-garden-slate text-white rounded-full shadow-2xl hover:bg-sage-900 transition hover:-translate-y-0.5"
          title="Ask my Garden Assistant"
        >
          <div className="relative">
            <MessageSquare className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <span className="text-xs font-semibold font-display">Ask Garden</span>
        </button>
      )}

      {/* CHAT FLOATING SIDE DRAWER */}
      {isChatOpen && (
        <div className="fixed inset-y-0 left-0 w-full sm:w-96 z-50 bg-white shadow-2xl border-r border-sage-200 flex flex-col animate-slide-in">
          {/* Close button strip */}
          <div className="absolute top-4 right-14 z-50">
            <button 
              onClick={() => setIsChatOpen(false)}
              className="p-1.5 rounded-full bg-sage-50 text-sage-500 hover:text-garden-slate border border-sage-100 hover:bg-sage-100 transition shadow-sm"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <GardenChat 
              chatHistory={chatHistory} 
              onSendMessage={handleSendChatMessage} 
              onClearHistory={handleClearChatHistory}
              onFocusItem={handleFocusItem}
            />
          </div>
        </div>
      )}

      {/* AI BOTANY COLLECTION DRAWER */}
      {showSuggestionsDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/30 backdrop-blur-xs p-4">
          <div className="w-full max-w-md h-full bg-white rounded-2xl shadow-2xl border border-sage-100 p-6 flex flex-col justify-between overflow-hidden">
            <div className="space-y-4 flex-1 overflow-y-auto">
              <div className="flex items-center justify-between border-b border-sage-50 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-sage-600 animate-bloom" />
                  <h3 className="font-display font-semibold text-lg text-garden-slate">
                    AI Botanist Suggestions
                  </h3>
                </div>
                <button 
                  onClick={() => setShowSuggestionsDrawer(false)}
                  className="p-1 rounded-full text-sage-400 hover:text-garden-slate transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {isSuggestingCollections ? (
                <div className="flex flex-col items-center justify-center p-12 text-center space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-sage-500" />
                  <p className="text-xs text-sage-500 font-medium">Analyzing tag seeds to discover new botanical biomes...</p>
                </div>
              ) : collectionSuggestions.length === 0 ? (
                <div className="text-center p-8 text-sage-400 text-xs">
                  Save more diverse tags so the AI Botanist has enough variety to design biomes!
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  <p className="text-xs text-sage-400 leading-relaxed">
                    Based on the tags and notes inside your garden, the AI Gardener recommends creating these thematic folders to nurture your knowledge:
                  </p>
                  <div className="space-y-3">
                    {collectionSuggestions.map((sug, idx) => (
                      <div key={idx} className="p-4 bg-sage-50/50 border border-sage-100 rounded-xl flex items-start justify-between gap-4 hover:border-sage-300 transition">
                        <div>
                          <h4 className="font-display font-semibold text-sm text-sage-800 flex items-center gap-1.5">
                            <span className="p-1 bg-white border border-sage-100 text-sage-600 rounded text-xs leading-none">🌱</span>
                            {sug.name}
                          </h4>
                          <p className="text-[11px] text-sage-500 mt-1 leading-relaxed">
                            {sug.description}
                          </p>
                        </div>
                        <button
                          onClick={() => handleCreateCollection(sug.name, sug.description, sug.icon)}
                          className="px-2.5 py-1.5 bg-sage-600 hover:bg-sage-700 text-white rounded-lg text-[10px] font-bold tracking-wider uppercase transition shrink-0 shadow-xs"
                        >
                          Sow Biome
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-sage-100 pt-4 mt-4 flex justify-end">
              <button
                onClick={() => setShowSuggestionsDrawer(false)}
                className="py-2.5 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PLANT SEED MODAL */}
      <AddNodeModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onGrow={handleGrowNode}
        collections={collections}
        activeCollectionId={selectedCollectionId}
      />
    </div>
  );
}
