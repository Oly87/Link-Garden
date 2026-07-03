export type ItemType = 'url' | 'note' | 'text' | 'video' | 'snippet';

export interface AiMetadata {
  title: string;
  summary: string;
  tags: string[];
  keyInsights: string[];
  importanceScore: number; // 1 to 10
  readingTime: number; // in minutes
  category: string;
  suggestedRelatedTopics: string[];
  actionItems: string[];
}

export interface GardenItem {
  id: string;
  type: ItemType;
  content: string; // The URL itself, note body, or raw text snippet
  noteContent?: string; // Additional user-added notes/annotations for this item
  createdAt: string;
  pinned: boolean;
  favorite: boolean;
  archived: boolean;
  collectionId: string | null;
  aiMetadata: AiMetadata;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  createdAt: string;
  citations?: { id: string; title: string }[]; // Cite items from the garden
}

export interface TopicTrend {
  topic: string;
  count: number;
  description: string;
}

export interface GardenReflection {
  recentLearnings: string;
  topTopics: TopicTrend[];
  knowledgeGaps: string[];
  recommendations: string[];
  recurringIdeas: string[];
  contradictions: string[];
  updatedAt: string;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  icon?: string; // lucide icon name
  createdAt: string;
}
