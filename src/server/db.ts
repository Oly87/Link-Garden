import { randomUUID } from 'crypto';
import { GardenItem, Collection, ChatMessage, GardenReflection, ItemType } from '../types.js';
import { getSupabase } from './supabase.js';

export interface GardenDatabase {
  items: GardenItem[];
  collections: Collection[];
  chatHistory: ChatMessage[];
  reflection: GardenReflection | null;
}

// Strictly typed representation of Supabase database rows
interface DbCollection {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  created_at: string;
}

interface DbGardenItem {
  id: string;
  type: string;
  content: string;
  note_content: string | null;
  created_at: string;
  pinned: boolean;
  favorite: boolean;
  archived: boolean;
  collection_id: string | null;
  
  // Individual metadata columns from SQL schema
  title: string | null;
  summary: string | null;
  tags: string[] | null;
  key_insights: string[] | null;
  importance_score: number | null;
  reading_time: number | null;
  category: string | null;
  suggested_related_topics: string[] | null;
  action_items: string[] | null;
}

interface DbChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  created_at: string;
  citations: { id: string; title: string }[] | null;
}

interface DbGardenReflection {
  id: string;
  recent_learnings: string;
  top_topics: any;
  knowledge_gaps: string[];
  recommendations: string[];
  recurring_ideas: string[];
  contradictions: string[];
  updated_at: string;
}

// Default initial state for database seeding
const defaultDb: GardenDatabase = {
  items: [
    {
      id: "seed-1",
      type: "url",
      content: "https://readwise.io",
      createdAt: new Date().toISOString(),
      pinned: true,
      favorite: true,
      archived: false,
      collectionId: "coll-1",
      aiMetadata: {
        title: "Readwise Reader: A Better Way to Read",
        summary: "A robust, multi-format reading tool designed to aggregate newsletters, articles, and PDFs into a single, beautifully readable interface with powerful annotation, highlighting, and retrieval workflows.",
        tags: ["reading", "productivity", "knowledge"],
        keyInsights: [
          "Information triage is a critical bottleneck in the knowledge work era; robust aggregators are essential.",
          "Highlighters that connect directly to note-taking apps double the value of reading.",
          "Custom text-to-speech engine lets you consume text articles as high-fidelity audio streams."
        ],
        importanceScore: 8,
        readingTime: 4,
        category: "Productivity",
        suggestedRelatedTopics: ["Digital Gardens", "Zettelkasten", "Note Taking"],
        actionItems: [
          "Import current newsletter subscriptions directly into Reader.",
          "Set up daily review digest of key highlighted quotes."
        ]
      }
    },
    {
      id: "seed-2",
      type: "note",
      content: "Deep Work Ritual: Focus purely for 90-minute blocks in the early morning. Keep a notepad next to the keyboard to scribble down distracting thoughts and quickly discard them to retain complete focus flow.",
      createdAt: new Date(Date.now() - 3600000 * 24).toISOString(), // 1 day ago
      pinned: false,
      favorite: true,
      archived: false,
      collectionId: "coll-2",
      aiMetadata: {
        title: "The 90-Minute Focus Ritual",
        summary: "An actionable focus methodology that uses uninterrupted, time-boxed blocks coupled with a mental dump sheet to maintain cognitive focus, avoid attention residue, and master deep creative tasks.",
        tags: ["focus", "rituals", "productivity"],
        keyInsights: [
          "Human focus naturally declines after 90 minutes; planning sessions around this cycle maximizes peak cognitive output.",
          "A distraction sheet offloads secondary thoughts, freeing up immediate working memory.",
          "Uninterrupted isolation creates a compounding mental state essential for complex coding and writing."
        ],
        importanceScore: 9,
        readingTime: 2,
        category: "Lifestyle",
        suggestedRelatedTopics: ["Attention Residue", "Circadian Rhythms", "Time Blocking"],
        actionItems: [
          "Block out 8:00 AM - 9:30 AM on the calendar for deep work.",
          "Place a dedicated minimalist physical notebook on the desk purely for logging intrusive focus thoughts."
        ]
      }
    },
    {
      id: "seed-3",
      type: "video",
      content: "https://www.youtube.com/watch?v=PrkXJeDcoTI",
      createdAt: new Date(Date.now() - 3600000 * 48).toISOString(), // 2 days ago
      pinned: false,
      favorite: false,
      archived: false,
      collectionId: "coll-1",
      aiMetadata: {
        title: "How to Build a Second Brain",
        summary: "A framework by Tiago Forte designed to capture, organize, distill, and express ideas using the PARA system (Projects, Areas, Resources, Archives), converting information consumption into active production.",
        tags: ["brain", "organization", "para"],
        keyInsights: [
          "The brain is for having ideas, not holding them; digital systems act as structural cognitive extensions.",
          "The PARA methodology organizes information by actionable intent rather than abstract academic topic.",
          "Distillation is the secret sauce—only saving highly resonant summaries makes information retrievable later."
        ],
        importanceScore: 9,
        readingTime: 12,
        category: "Technology",
        suggestedRelatedTopics: ["PARA Method", "Personal Knowledge Management", "Notion"],
        actionItems: [
          "Create Projects, Areas, Resources, and Archives folders across desktop, cloud storage, and email.",
          "Review information ingestion habits and discard 50% of trivial bookmarks."
        ]
      }
    }
  ],
  collections: [
    {
      id: "coll-1",
      name: "The Canopy",
      description: "Overarching systems, knowledge architectures, and long-form reading databases.",
      icon: "BookOpen",
      createdAt: new Date().toISOString()
    },
    {
      id: "coll-2",
      name: "Fern Sprouts",
      description: "Quick daily rituals, mental habits, health guidelines, and fleeting inspirations.",
      icon: "Leaf",
      createdAt: new Date().toISOString()
    },
    {
      id: "coll-3",
      name: "The Undergrowth",
      description: "Draft thoughts, raw snippets, coding code-blocks, and raw technical references.",
      icon: "Code",
      createdAt: new Date().toISOString()
    }
  ],
  chatHistory: [
    {
      id: "init-1",
      sender: "bot",
      text: "Welcome to your **Link Garden**! I am your personal AI Gardener. Save links, articles, notes, or videos, and I will grow them into categorized, insightful knowledge. Ask me anything about your saved ideas!",
      createdAt: new Date().toISOString()
    }
  ],
  reflection: null
};

/**
 * Kept for interface compatibility with server.ts. No-op.
 */
export function initDatabase() {
  console.log("Supabase storage layer initialized successfully.");
}

/**
 * Map Supabase `garden_items` columns to frontend `GardenItem` interface,
 * reconstructing the nested `aiMetadata` object.
 */
function mapDbItem(row: DbGardenItem): GardenItem {
  return {
    id: row.id,
    type: row.type as ItemType,
    content: row.content,
    noteContent: row.note_content || undefined,
    createdAt: row.created_at,
    pinned: row.pinned ?? false,
    favorite: row.favorite ?? false,
    archived: row.archived ?? false,
    collectionId: row.collection_id,
    aiMetadata: {
      title: row.title || '',
      summary: row.summary || '',
      tags: row.tags || [],
      keyInsights: row.key_insights || [],
      importanceScore: row.importance_score || 0,
      readingTime: row.reading_time || 0,
      category: row.category || '',
      suggestedRelatedTopics: row.suggested_related_topics || [],
      actionItems: row.action_items || []
    }
  };
}

/**
 * Map Supabase `collections` columns to frontend `Collection` interface.
 */
function mapDbCollection(row: DbCollection): Collection {
  return {
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    icon: row.icon || undefined,
    createdAt: row.created_at
  };
}

/**
 * Map Supabase `chat_messages` columns to frontend `ChatMessage` interface.
 */
function mapDbChatMessage(row: DbChatMessage): ChatMessage {
  return {
    id: row.id,
    sender: row.sender,
    text: row.text,
    createdAt: row.created_at,
    citations: row.citations || undefined
  };
}

/**
 * Map Supabase `garden_reflections` columns to frontend `GardenReflection` interface.
 */
function mapDbReflection(row: DbGardenReflection): GardenReflection {
  return {
    recentLearnings: row.recent_learnings,
    topTopics: row.top_topics || [],
    knowledgeGaps: row.knowledge_gaps || [],
    recommendations: row.recommendations || [],
    recurringIdeas: row.recurring_ideas || [],
    contradictions: row.contradictions || [],
    updatedAt: row.updated_at
  };
}

/**
 * Seed database with default initial Link Garden data using correct tables and flattened columns.
 */
async function seedDatabase(client: any) {
  console.log("Seeding initial default garden data to Supabase...");

  // Seed collections
  const collRows = defaultDb.collections.map(c => ({
    id: c.id,
    name: c.name,
    description: c.description || null,
    icon: c.icon || null,
    created_at: c.createdAt
  }));
  const { error: collErr } = await client.from('collections').insert(collRows);
  if (collErr) {
    console.error("Error seeding collections:", JSON.stringify(collErr, null, 2));
  }

  // Seed items (with flattened AI metadata)
  const itemRows = defaultDb.items.map(item => ({
    id: item.id,
    type: item.type,
    content: item.content,
    note_content: item.noteContent || null,
    created_at: item.createdAt,
    pinned: item.pinned,
    favorite: item.favorite,
    archived: item.archived,
    collection_id: item.collectionId || null,
    
    // Flattened AI metadata
    title: item.aiMetadata.title,
    summary: item.aiMetadata.summary,
    tags: item.aiMetadata.tags,
    key_insights: item.aiMetadata.keyInsights,
    importance_score: item.aiMetadata.importanceScore,
    reading_time: item.aiMetadata.readingTime,
    category: item.aiMetadata.category,
    suggested_related_topics: item.aiMetadata.suggestedRelatedTopics,
    action_items: item.aiMetadata.actionItems
  }));
  const { error: itemErr } = await client.from('garden_items').insert(itemRows);
  if (itemErr) {
    console.error("Error seeding garden_items:", JSON.stringify(itemErr, null, 2));
  }

  // Seed chat messages
  const chatRows = defaultDb.chatHistory.map(m => ({
    id: m.id,
    sender: m.sender,
    text: m.text,
    created_at: m.createdAt,
    citations: m.citations || []
  }));
  const { error: chatErr } = await client.from('chat_messages').insert(chatRows);
  if (chatErr) {
    console.error("Error seeding chat_messages:", JSON.stringify(chatErr, null, 2));
  }
}

/**
 * Read complete garden state from Supabase
 */
export async function readDatabase(): Promise<GardenDatabase> {
  const client = getSupabase();

  // Load collections, items, and chat history
  const { data: collections, error: collErr } = await client.from('collections').select('*');
  if (collErr) {
    console.error("Failed to query collections:", collErr);
  }
  const { data: items, error: itemsErr } = await client.from('garden_items').select('*');
  if (itemsErr) {
    console.error("Failed to query garden_items:", itemsErr);
  }
  const { data: chatHistory, error: chatErr } = await client.from('chat_messages').select('*');
  if (chatErr) {
    console.error("Failed to query chat_messages:", chatErr);
  }

  let finalCollections = collections || [];
  let finalItems = items || [];
  let finalChatHistory = chatHistory || [];

  // Robust Self-Healing: Check and seed collections if empty
  if (finalCollections.length === 0) {
    try {
      console.log("Collections table is empty. Seeding default collections...");
      const collRows = defaultDb.collections.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description || null,
        icon: c.icon || null,
        created_at: c.createdAt
      }));
      const { error: errorIns } = await client.from('collections').insert(collRows);
      if (errorIns) {
        console.error("Error seeding collections:", JSON.stringify(errorIns, null, 2));
      } else {
        const { data: freshColl } = await client.from('collections').select('*');
        if (freshColl) finalCollections = freshColl;
      }
    } catch (err) {
      console.error("Exception seeding collections:", err);
    }
  }

  // Robust Self-Healing: Check and seed garden_items if empty
  if (finalItems.length === 0) {
    try {
      console.log("Garden items table is empty. Seeding default garden items...");
      const itemRows = defaultDb.items.map(item => ({
        id: item.id,
        type: item.type,
        content: item.content,
        note_content: item.noteContent || null,
        created_at: item.createdAt,
        pinned: item.pinned,
        favorite: item.favorite,
        archived: item.archived,
        collection_id: item.collectionId || null,
        
        // Flattened AI metadata
        title: item.aiMetadata.title,
        summary: item.aiMetadata.summary,
        tags: item.aiMetadata.tags,
        key_insights: item.aiMetadata.keyInsights,
        importance_score: item.aiMetadata.importanceScore,
        reading_time: item.aiMetadata.readingTime,
        category: item.aiMetadata.category,
        suggested_related_topics: item.aiMetadata.suggestedRelatedTopics,
        action_items: item.aiMetadata.actionItems
      }));
      const { error: errorIns } = await client.from('garden_items').insert(itemRows);
      if (errorIns) {
        console.error("Error seeding garden_items:", JSON.stringify(errorIns, null, 2));
      } else {
        const { data: freshItems } = await client.from('garden_items').select('*');
        if (freshItems) finalItems = freshItems;
      }
    } catch (err) {
      console.error("Exception seeding garden_items:", err);
    }
  }

  // Robust Self-Healing: Check and seed chat_messages if empty
  if (finalChatHistory.length === 0) {
    try {
      console.log("Chat messages table is empty. Seeding default chat messages...");
      const chatRows = defaultDb.chatHistory.map(m => ({
        id: m.id,
        sender: m.sender,
        text: m.text,
        created_at: m.createdAt,
        citations: m.citations || []
      }));
      const { error: errorIns } = await client.from('chat_messages').insert(chatRows);
      if (errorIns) {
        console.error("Error seeding chat_messages:", JSON.stringify(errorIns, null, 2));
      } else {
        const { data: freshChat } = await client.from('chat_messages').select('*');
        if (freshChat) finalChatHistory = freshChat;
      }
    } catch (err) {
      console.error("Exception seeding chat_messages:", err);
    }
  }

  // Load latest reflection
  const { data: reflectionData, error: refErr } = await client
    .from('garden_reflections')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (refErr) {
    console.error("Failed to query reflection:", refErr);
  }

  const mappedItems = (finalItems || []).map(mapDbItem).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const mappedCollections = (finalCollections || []).map(mapDbCollection).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const mappedChat = (finalChatHistory || []).map(mapDbChatMessage).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const mappedReflection = reflectionData ? mapDbReflection(reflectionData) : null;

  return {
    items: mappedItems,
    collections: mappedCollections,
    chatHistory: mappedChat,
    reflection: mappedReflection
  };
}

/**
 * Write/Sync garden state back to Supabase by comparing list and upserting changes.
 */
export async function writeDatabase(db: GardenDatabase): Promise<void> {
  const client = getSupabase();

  // 1. ITEMS SYNC
  try {
    const { data: currentDbItems } = await client.from('garden_items').select('id');
    const currentIds = (currentDbItems || []).map((x: { id: string }) => x.id);
    const newIds = db.items.map(x => x.id);
    const deletedIds = currentIds.filter(id => !newIds.includes(id));

    if (deletedIds.length > 0) {
      await client.from('garden_items').delete().in('id', deletedIds);
    }

    if (db.items.length > 0) {
      const rowsToUpsert = db.items.map(item => ({
        id: item.id,
        type: item.type,
        content: item.content,
        note_content: item.noteContent || null,
        created_at: item.createdAt,
        pinned: item.pinned,
        favorite: item.favorite,
        archived: item.archived,
        collection_id: item.collectionId,
        
        // Flattened AI metadata
        title: item.aiMetadata?.title || '',
        summary: item.aiMetadata?.summary || '',
        tags: item.aiMetadata?.tags || [],
        key_insights: item.aiMetadata?.keyInsights || [],
        importance_score: item.aiMetadata?.importanceScore || 0,
        reading_time: item.aiMetadata?.readingTime || 0,
        category: item.aiMetadata?.category || '',
        suggested_related_topics: item.aiMetadata?.suggestedRelatedTopics || [],
        action_items: item.aiMetadata?.actionItems || []
      }));
      await client.from('garden_items').upsert(rowsToUpsert);
    }
  } catch (err) {
    console.error("Failed syncing garden_items table:", err);
  }

  // 2. COLLECTIONS SYNC
  try {
    const { data: currentDbColls } = await client.from('collections').select('id');
    const currentCollIds = (currentDbColls || []).map((x: { id: string }) => x.id);
    const newCollIds = db.collections.map(x => x.id);
    const deletedCollIds = currentCollIds.filter(id => !newCollIds.includes(id));

    if (deletedCollIds.length > 0) {
      await client.from('collections').delete().in('id', deletedCollIds);
    }

    if (db.collections.length > 0) {
      const rowsToUpsert = db.collections.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description || null,
        icon: c.icon || null,
        created_at: c.createdAt
      }));
      await client.from('collections').upsert(rowsToUpsert);
    }
  } catch (err) {
    console.error("Failed syncing collections table:", err);
  }

  // 3. CHAT HISTORY SYNC
  try {
    const { data: currentChat } = await client.from('chat_messages').select('id');
    const currentChatIds = (currentChat || []).map((x: { id: string }) => x.id);
    const newChatIds = db.chatHistory.map(x => x.id);
    const deletedChatIds = currentChatIds.filter(id => !newChatIds.includes(id));

    if (deletedChatIds.length > 0) {
      await client.from('chat_messages').delete().in('id', deletedChatIds);
    }

    if (db.chatHistory.length > 0) {
      const rowsToUpsert = db.chatHistory.map(m => ({
        id: m.id,
        sender: m.sender,
        text: m.text,
        created_at: m.createdAt,
        citations: m.citations || []
      }));
      await client.from('chat_messages').upsert(rowsToUpsert);
    }
  } catch (err) {
    console.error("Failed syncing chat_messages table:", err);
  }

  // 4. REFLECTION SYNC
  if (db.reflection) {
    try {
      // Find the existing reflection's UUID from DB to reuse it and prevent duplicate inserts
      const { data: existingRef } = await client
        .from('garden_reflections')
        .select('id')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const reflectionId = existingRef?.id || randomUUID();

      const payload = {
        id: reflectionId,
        recent_learnings: db.reflection.recentLearnings,
        top_topics: db.reflection.topTopics,
        knowledge_gaps: db.reflection.knowledgeGaps,
        recommendations: db.reflection.recommendations,
        recurring_ideas: db.reflection.recurringIdeas,
        contradictions: db.reflection.contradictions,
        updated_at: db.reflection.updatedAt
      };
      await client.from('garden_reflections').upsert(payload);
    } catch (err) {
      console.error("Failed syncing garden_reflections table:", err);
    }
  }
}
