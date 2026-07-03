import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { readDatabase, writeDatabase, initDatabase } from './src/server/db.js';
import { GardenItem, AiMetadata, ChatMessage, GardenReflection, Collection } from './src/types.js';

// Initialize the data directory and garden.json file
initDatabase();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Lazy initializer for Google GenAI client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required. Please check your AI Studio secrets configuration.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Scrapes simple metadata and content from a given URL to feed into Gemini as context
async function scrapeUrl(urlStr: string): Promise<{ title: string; text: string }> {
  try {
    const res = await fetch(urlStr, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(6000) // 6 seconds timeout
    });
    
    if (!res.ok) {
      return { title: '', text: '' };
    }
    
    const html = await res.text();
    
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';
    
    // Clean meta descriptions
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i) ||
                      html.match(/<meta[^>]*content=["']([\s\S]*?)["'][^>]*name=["']description["']/i);
    const desc = descMatch ? descMatch[1].trim() : '';
    
    // Simple text cleaning (strip script, style, html tags, get readable characters)
    let bodyText = html
      .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
      .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
      
    if (bodyText.length > 5000) {
      bodyText = bodyText.substring(0, 5000) + '...';
    }
    
    return {
      title,
      text: `Meta Description: ${desc}\n\nContent:\n${bodyText}`
    };
  } catch (err) {
    console.error("Scraping failed for URL:", urlStr, err);
    return { title: '', text: '' };
  }
}

// Structured response schema for item categorization & analysis
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "A highly concise, beautiful title. Limit to 5-10 words maximum. Remove clickbait and site prefixes.",
    },
    summary: {
      type: Type.STRING,
      description: "A gorgeous, comprehensive, yet highly scannable 2-3 sentence summary of the core message.",
    },
    tags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "3-5 highly relevant, lowercase single-word tags or conceptual categories (e.g. 'productivity', 'design', 'philosophy').",
    },
    keyInsights: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "3 highly valuable, punchy, actionable takeaways or insights from the content.",
    },
    importanceScore: {
      type: Type.INTEGER,
      description: "An importance rating from 1 (low value/casual) to 10 (life-changing/essential reference). Be realistic.",
    },
    readingTime: {
      type: Type.INTEGER,
      description: "Estimated reading or video watching time in minutes. For notes, list 1-2 minutes.",
    },
    category: {
      type: Type.STRING,
      description: "One single clean category. Limit to one of: 'Technology', 'Science', 'Productivity', 'Lifestyle', 'Health', 'Business', 'Philosophy', 'Art', 'Unknown'.",
    },
    suggestedRelatedTopics: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "2-3 related topics or keywords to explore further.",
    },
    actionItems: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "If applicable, list 1-3 specific, actionable steps or habits suggested. Empty array if none apply.",
    },
  },
  required: [
    "title",
    "summary",
    "tags",
    "keyInsights",
    "importanceScore",
    "readingTime",
    "category",
    "suggestedRelatedTopics",
    "actionItems"
  ]
};

// -----------------------------------------------------------------------------
// API Endpoints
// -----------------------------------------------------------------------------

// 1. Get all garden items
app.get('/api/items', async (req, res) => {
  try {
    const db = await readDatabase();
    res.json(db.items);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Create a new garden item (grows it with Gemini analysis)
app.post('/api/items', async (req, res) => {
  try {
    const { type, content, collectionId } = req.body;
    if (!type || !content) {
      return res.status(400).json({ error: "Type and Content are required." });
    }

    let pageTitle = "";
    let extractedText = "";

    // If it's a URL or Video, scrape page first
    if (type === 'url' || type === 'video') {
      const scraped = await scrapeUrl(content);
      pageTitle = scraped.title;
      extractedText = scraped.text;
    }

    const ai = getGeminiClient();
    
    // Formulate a clean prompt for structured metadata extraction
    const prompt = `
      You are an expert personal librarian and knowledge curator. Your task is to analyze the following content and extract highly polished, structured, and beautiful insights.
      
      Content Type: ${type}
      Original Input/URL: ${content}
      ${pageTitle ? `Scraped Page Title: ${pageTitle}` : ''}
      ${extractedText ? `Extracted Page Body:\n${extractedText}` : `Raw content:\n${content}`}
      
      Synthesize this into our knowledge garden structure. Fill out all the schema fields thoughtfully. Make the title concise and premium. Give realistic importance scores and read times.
    `;

    const aiResponse = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        systemInstruction: "You are the head curator of 'Link Garden'—a nature-inspired digital knowledge garden. Analyze inputs and generate precise, highly stylized, scannable summaries and metadata.",
      },
    });

    const parsedMetadata = JSON.parse(aiResponse.text || '{}') as AiMetadata;

    // Build the new GardenItem object
    const newItem: GardenItem = {
      id: `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type,
      content,
      createdAt: new Date().toISOString(),
      pinned: false,
      favorite: false,
      archived: false,
      collectionId: collectionId || null,
      aiMetadata: parsedMetadata,
    };

    // Save to server database
    const db = await readDatabase();
    db.items.unshift(newItem);
    await writeDatabase(db);

    res.status(201).json(newItem);
  } catch (error: any) {
    console.error("Failed to grow garden node:", error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Update garden item fields (pin, favorite, archive, annotation, folder)
app.put('/api/items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const db = await readDatabase();
    const index = db.items.findIndex(item => item.id === id);
    
    if (index === -1) {
      return res.status(404).json({ error: "Item not found." });
    }

    db.items[index] = {
      ...db.items[index],
      ...updates,
      // Ensure key identifiers don't change
      id: db.items[index].id,
      createdAt: db.items[index].createdAt,
    };

    await writeDatabase(db);
    res.json(db.items[index]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Delete an item from the garden
app.delete('/api/items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await readDatabase();
    
    const filtered = db.items.filter(item => item.id !== id);
    if (filtered.length === db.items.length) {
      return res.status(404).json({ error: "Item not found." });
    }

    db.items = filtered;
    await writeDatabase(db);
    res.json({ success: true, message: "Item pruned from your garden." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Get all collections
app.get('/api/collections', async (req, res) => {
  try {
    const db = await readDatabase();
    res.json(db.collections);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Create a new collection
app.post('/api/collections', async (req, res) => {
  try {
    const { name, description, icon } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Name is required." });
    }

    const newCollection: Collection = {
      id: `coll-${Date.now()}`,
      name,
      description,
      icon: icon || 'Folder',
      createdAt: new Date().toISOString(),
    };

    const db = await readDatabase();
    db.collections.push(newCollection);
    await writeDatabase(db);

    res.status(201).json(newCollection);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Get chat messages
app.get('/api/chat', async (req, res) => {
  try {
    const db = await readDatabase();
    res.json(db.chatHistory);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 8. Chat with your saved knowledge ("Ask my Garden")
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message content is required." });
    }

    const db = await readDatabase();
    const items = db.items.filter(item => !item.archived);

    // Save user message in history
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      sender: 'user',
      text: message,
      createdAt: new Date().toISOString()
    };
    db.chatHistory.push(userMsg);

    // Search and select top relevant items as context for the question
    const lowercaseQuery = message.toLowerCase();
    const searchScoredItems = items.map(item => {
      let score = 0;
      const title = item.aiMetadata?.title?.toLowerCase() || '';
      const summary = item.aiMetadata?.summary?.toLowerCase() || '';
      const content = item.content.toLowerCase();
      const tags = item.aiMetadata?.tags?.map(t => t.toLowerCase()) || [];
      const category = item.aiMetadata?.category?.toLowerCase() || '';
      const notes = (item.noteContent || '').toLowerCase();

      if (title.includes(lowercaseQuery)) score += 10;
      if (tags.some(tag => lowercaseQuery.includes(tag))) score += 8;
      if (category.includes(lowercaseQuery)) score += 5;
      if (summary.includes(lowercaseQuery)) score += 3;
      if (content.includes(lowercaseQuery)) score += 2;
      if (notes.includes(lowercaseQuery)) score += 2;

      return { item, score };
    });

    // Sort by relevance score
    const rankedContext = searchScoredItems
      .filter(x => x.score > 0 || lowercaseQuery.length < 3) // if short query, let's allow all
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(x => x.item);

    // If ranked context is empty but we have items, feed a random subset or the latest items
    const finalContext = rankedContext.length > 0 ? rankedContext : items.slice(0, 5);

    // Format context for Gemini
    const contextText = finalContext.map((item, idx) => {
      return `[Item ${idx + 1}]
ID: ${item.id}
Title: ${item.aiMetadata?.title || 'Untitled Node'}
Type: ${item.type}
Category: ${item.aiMetadata?.category || 'General'}
Summary: ${item.aiMetadata?.summary || 'No summary'}
Key Takeaways: ${item.aiMetadata?.keyInsights?.join(', ') || 'None'}
Tags: ${item.aiMetadata?.tags?.join(', ') || ''}
Saved Content/URL/Note: ${item.content}
User Notes: ${item.noteContent || 'None'}
`;
    }).join('\n---\n');

    const prompt = `
      You are the head personal librarian of the user's digital Link Garden. Your tone is warm, calm, supportive, philosophical, and highly intellectual—inspired by nature, personal notebooks, and libraries.
      
      Answer the user's question about their garden using the context items provided below.
      
      ## Core Guidelines:
      - Integrate relevant takeaways and summarize ideas beautifully.
      - **ALWAYS cite the sources in your output**. When talking about an item, reference its title in brackets like: [Readwise Reader: A Better Way to Read] or [How to Build a Second Brain]. This is critical so the user can easily trace back your thoughts.
      - If the user's query is about something not present or discussed in the garden, explicitly state that you couldn't find active Sprouts on this topic in their current garden. Then, provide a helpful general answer and suggest what kind of links or notes they could save to grow this area of knowledge!
      - Format your response in clean, beautiful Markdown (use bullet points, bold headers, and quotes). Keep it highly readable and calming.

      ## Garden Context Items:
      ${contextText || "The garden is currently empty. Encourage them to plant a seed first!"}

      ## User's Question:
      ${message}
    `;

    const ai = getGeminiClient();
    const chatResponse = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are the head personal librarian of 'Link Garden'—a serene, AI-guided personal knowledge garden. You guide users through their saved links and notes with absolute grace, rich wisdom, and accurate, source-cited answers.",
      },
    });

    const replyText = chatResponse.text || "I was unable to garden an answer. Please try watering me with another prompt!";

    // Extract citations to attach cleanly to the message object for the UI
    const citations: { id: string; title: string }[] = [];
    finalContext.forEach(item => {
      const escapedTitle = (item.aiMetadata?.title || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (escapedTitle) {
        const regex = new RegExp(escapedTitle, 'i');
        if (regex.test(replyText) || lowercaseQuery.includes((item.aiMetadata?.title || '').toLowerCase())) {
          citations.push({ id: item.id, title: item.aiMetadata.title });
        }
      }
    });

    // Save bot reply
    const botMsg: ChatMessage = {
      id: `msg-${Date.now()}-bot`,
      sender: 'bot',
      text: replyText,
      createdAt: new Date().toISOString(),
      citations: citations.length > 0 ? citations : finalContext.map(c => ({ id: c.id, title: c.aiMetadata.title })).slice(0, 3)
    };
    db.chatHistory.push(botMsg);
    await writeDatabase(db);

    res.json(botMsg);
  } catch (error: any) {
    console.error("Chat error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Clear chat logs
app.post('/api/chat/clear', async (req, res) => {
  try {
    const db = await readDatabase();
    db.chatHistory = [
      {
        id: "init-1",
        sender: "bot",
        text: "Your conversation history has been cleared. The garden path is freshly swept! Ask me anything about your saved ideas.",
        createdAt: new Date().toISOString()
      }
    ];
    await writeDatabase(db);
    res.json(db.chatHistory);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 9. Get recent garden reflection or trigger calculation if none
app.get('/api/reflection', async (req, res) => {
  try {
    const db = await readDatabase();
    if (db.reflection) {
      return res.json(db.reflection);
    }
    return res.json({ message: "No reflections grown yet. Click 'Grow Reflection' to trigger an AI analysis." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 10. Grow an AI garden reflection (analyzes everything in the garden)
const reflectionSchema = {
  type: Type.OBJECT,
  properties: {
    recentLearnings: {
      type: Type.STRING,
      description: "A gorgeous, high-level summary of what themes, topics, and tools the user has been curating recently. 3-4 sentences.",
    },
    topTopics: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          topic: { type: Type.STRING, description: "Name of the topic." },
          count: { type: Type.INTEGER, description: "Estimated percentage or focus density of this topic in the garden." },
          description: { type: Type.STRING, description: "A highly elegant, poetic sentence detailing why this topic matters in their garden." }
        },
        required: ["topic", "count", "description"]
      },
      description: "A list of the 3-4 main conceptual themes appearing in the garden, with focus weights.",
    },
    knowledgeGaps: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "2-3 areas that seem under-represented or ignored (e.g. 'You saved coding structures but have no notes on actual database schemas').",
    },
    recommendations: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "2-3 personalized, beautiful recommendations on articles, books, or ideas to research next based on their garden.",
    },
    recurringIdeas: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "2-3 overlapping patterns, shared frameworks, or interconnected concepts between their different tags.",
    },
    contradictions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "1-2 paradoxical or conflicting viewpoints found within their saved notes/bookmarks (e.g., focus blocking vs chaotic ideation). Offer a brief synthesis.",
    }
  },
  required: [
    "recentLearnings",
    "topTopics",
    "knowledgeGaps",
    "recommendations",
    "recurringIdeas",
    "contradictions"
  ]
};

app.post('/api/reflection/grow', async (req, res) => {
  try {
    const db = await readDatabase();
    const items = db.items.filter(item => !item.archived);

    if (items.length === 0) {
      return res.status(400).json({ error: "Your garden is empty. Please save some links, notes, or videos before growing a reflection." });
    }

    const itemsSummary = items.map((item, idx) => {
      return `[Node ${idx+1}]
Title: ${item.aiMetadata?.title || 'Untitled Node'}
Type: ${item.type}
Category: ${item.aiMetadata?.category || 'General'}
Tags: ${item.aiMetadata?.tags?.join(', ') || ''}
Summary: ${item.aiMetadata?.summary || 'No summary'}
User Notes: ${item.noteContent || ''}
`;
    }).join('\n---\n');

    const prompt = `
      You are the head landscape architect of the user's personal knowledge garden. Review the entire collection of their saved entries below and produce a deep, highly stylized, structured reflection report.
      
      Look for:
      1. Overall learning trends (what they are currently passionate about).
      2. The primary clusters of focus (the main topics).
      3. Ignored spaces or knowledge gaps (what they are ignoring).
      4. Recommendations on what seed to plant next.
      5. Recurring ideas (connections across fields).
      6. Synthesizable contradictions (opposing thoughts they are struggling with).

      Make the descriptions sound premium, highly polished, and incredibly elegant.
      
      ## Garden Items Catalog:
      ${itemsSummary}
    `;

    const ai = getGeminiClient();
    const aiResponse = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: reflectionSchema,
        systemInstruction: "You are the head landscape architect of 'Link Garden'—a calm, premium workspace for curated thoughts. Review logs and output beautiful, structured reflection JSON.",
      }
    });

    const report = JSON.parse(aiResponse.text || '{}') as GardenReflection;
    report.updatedAt = new Date().toISOString();

    db.reflection = report;
    await writeDatabase(db);

    res.json(report);
  } catch (error: any) {
    console.error("Failed to generate reflection:", error);
    res.status(500).json({ error: error.message });
  }
});

// 11. Auto-generate suggestion for collections based on current garden tags
app.post('/api/collections/suggest', async (req, res) => {
  try {
    const db = await readDatabase();
    const items = db.items;
    
    if (items.length === 0) {
      return res.json({ suggestions: [] });
    }

    const tags = Array.from(new Set(items.flatMap(item => item.aiMetadata?.tags || []))).slice(0, 15);
    
    const prompt = `
      You are a creative digital botanist. Based on these tags present in the user's knowledge garden, suggest 2 brand new collection names and short descriptions that would group these tags beautifully.
      Tags: ${tags.join(', ')}
      
      Keep the collection names nature-themed, poetic, and premium (e.g. "Wildflower Bed", "Deep Roots", "Canopy Moss", "Fern Glade", "Orchard Streams").
      
      Return a JSON array of objects, each containing:
      - name: string (2-3 words, poetic)
      - description: string (1 short sentence, elegant)
      - icon: string (Choose a valid Lucide icon name from: 'Leaf', 'Sprout', 'Flower', 'Trees', 'Compass', 'Book', 'Code', 'Layers', 'Brain', 'Compass', 'Lightbulb')
    `;

    const suggestSchema = {
      type: Type.OBJECT,
      properties: {
        suggestions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              description: { type: Type.STRING },
              icon: { type: Type.STRING }
            },
            required: ["name", "description", "icon"]
          }
        }
      },
      required: ["suggestions"]
    };

    const ai = getGeminiClient();
    const aiResponse = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: suggestSchema
      }
    });

    const parsed = JSON.parse(aiResponse.text || '{"suggestions": []}');
    res.json(parsed);
  } catch (error: any) {
    console.error("Failed to suggest collections:", error);
    res.status(500).json({ error: error.message });
  }
});

// -----------------------------------------------------------------------------
// Vite Server Integration & Static Assets
// -----------------------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Link Garden full-stack server running on http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
