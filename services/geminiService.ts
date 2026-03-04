import { GoogleGenAI, Type } from "@google/genai";
import { RecipePlan } from "../types";

// System instruction to ensure the text model outputs the exact JSON structure and style requested.
const SYSTEM_INSTRUCTION = `
You are a creative "Food Journal" designer (可愛手帳風設計師).
Your goal is to generate a structured plan for 3 social media images AND a short newsletter body.

**CRITICAL CONTENT RULES:**
1.  **Language**: All output must be in **Traditional Chinese (繁體中文)**.
2.  **Cover Headline**: SHORT & PUNCHY (e.g. "爆漿·飯糰"). Max 6 chars.
3.  **Cover Subtext**: A short emotional hook. Max 12 chars.
4.  **Steps**: **EXACTLY 4 STEPS**. The flow MUST be:
    - Step 1: Prep (e.g., 備料切菜)
    - Step 2: Mix/Process (e.g., 攪拌醃製)
    - Step 3: Cook/Heat (e.g., 下鍋烘烤)
    - Step 4: Finish/Decor (e.g., 裝飾擺盤)
    - Description MUST be under 12 chars (short & cute).
    - **visualFocus**: Describe the illustration in **English** (better for image gen). Focus on "cute hand-drawn watercolor sticker".
5.  **Ingredients**: Max 6 key items.
6.  **Signature**: ALWAYS "Designed by 尹甄的生活美學".
7.  **Newsletter Content**: A warm, friendly paragraph (approx 80 words).

**Visual Direction (for prompts - return in English):**
- **Cover Prompt**: Magazine cover style. Food placed in LOWER HALF. Clean TOP space for text. High aesthetic.
- **Ingredients Prompt**: Cute hand-drawn watercolor illustration of raw ingredients (e.g. flour bag, eggs, milk carton). **WHITE BACKGROUND**. Sticker style.
- **Final Prompt**: Side view, close-up. Delicious, glossy, fresh.
`;

const RECIPE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    topic: { type: Type.STRING },
    date: { type: Type.STRING },
    signature: { type: Type.STRING },
    coverHeadline: { type: Type.STRING },
    coverSubtext: { type: Type.STRING },
    newsletterContent: { type: Type.STRING },
    ingredients: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          amount: { type: Type.STRING },
        }
      }
    },
    steps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          action: { type: Type.STRING },
          description: { type: Type.STRING },
          visualFocus: { type: Type.STRING, description: "Visual description in English" },
        }
      },
      minItems: 4,
      maxItems: 4
    },
    tips: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    finalDishName: { type: Type.STRING },
    finalDishDescription: { type: Type.STRING },
    prompts: {
      type: Type.OBJECT,
      properties: {
        cover: {
          type: Type.OBJECT,
          properties: {
            generationPrompt: { type: Type.STRING }
          },
          required: ["generationPrompt"] 
        },
        ingredients: {
          type: Type.OBJECT,
          properties: {
            generationPrompt: { type: Type.STRING, description: "Prompt for cute ingredients illustration" }
          },
          required: ["generationPrompt"]
        },
        final: {
          type: Type.OBJECT,
          properties: {
            generationPrompt: { type: Type.STRING }
          },
          required: ["generationPrompt"]
        }
      },
      required: ["cover", "ingredients", "final"]
    }
  },
  required: ["topic", "date", "signature", "coverHeadline", "coverSubtext", "newsletterContent", "ingredients", "steps", "tips", "finalDishName", "finalDishDescription", "prompts"]
};

export const generateRecipePlan = async (topic: string): Promise<RecipePlan> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const today = new Date().toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', 
      contents: `Design a cute food journal for: "${topic}". Date: ${today}.`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: RECIPE_SCHEMA,
      }
    });

    let jsonStr = response.text;
    if (!jsonStr) throw new Error("No response text generated");
    jsonStr = jsonStr.replace(/^```json\s*/, "").replace(/\s*```$/, "");

    return JSON.parse(jsonStr) as RecipePlan;
  } catch (error) {
    console.error("Error generating recipe plan:", error);
    throw error;
  }
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const generateJournalImage = async (prompt: string, type: 'cover' | 'steps' | 'final' | 'ingredients'): Promise<string> => {
  const MAX_RETRIES = 3;
  const INITIAL_DELAY = 1000;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      let stylePrompt = "";
      
      if (type === 'cover') {
          // Magazine style for cover
          stylePrompt = `(Top-down view:1.2), Magazine Cover Composition. ${prompt}. The main food is placed in the LOWER CENTER to allow space for text at the top. High quality, soft natural light, aesthetic food photography.`;
      } else if (type === 'ingredients') {
          // Cute hand-drawn ingredients
          stylePrompt = `(Watercolor illustration:1.4), (Hand-drawn style:1.3). A group collection of: ${prompt}. Cute, simple, pastel colors, PURE WHITE background. Isolated items like stickers. No text. Artistic marker drawing. Knolling layout.`;
      } else if (type === 'steps') {
          // Cute hand-drawn steps
          stylePrompt = `(Watercolor illustration:1.5), (Hand-drawn doodle:1.4). ${prompt}. Cute, kawaii style, soft pastel colors, thick outlines. PURE WHITE background. Like a sticker or journal drawing. No text.`;
      } else {
          // Final Dish - Photogenic
          stylePrompt = `(Side view:1.4) or (Macro close-up:1.3). ${prompt}. Fresh, appetizing, glossy texture. Soft bokeh background. Professional food photography. High resolution.`;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: stylePrompt }]
        },
      });

      const parts = response.candidates?.[0]?.content?.parts;
      if (parts) {
        for (const part of parts) {
          if (part.inlineData && part.inlineData.data) {
               return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          }
        }
      }
      throw new Error("No image data returned in response.");
    } catch (error: any) {
      console.error(`Error generating ${type} image (Attempt ${attempt + 1}):`, error);
      
      const isOverloaded = error.message?.includes('503') || error.message?.includes('overloaded') || error.status === 503;
      const isContentError = error.message?.includes("No image data");

      if ((isOverloaded || isContentError) && attempt < MAX_RETRIES - 1) {
        const delay = INITIAL_DELAY * Math.pow(2, attempt);
        await wait(delay);
        continue;
      }
      throw error;
    }
  }
  throw new Error(`Failed to generate ${type} image after multiple retries.`);
};