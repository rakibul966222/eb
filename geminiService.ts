
import { GoogleGenAI } from "@google/genai";

// Guideline: Use this process.env.API_KEY string directly when initializing
// We use a getter to ensure we always use the latest API key available in the environment.
export class GeminiService {
  private get ai() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  // Handle text and image analysis
  async getAiResponse(userPrompt: string, imageBase64?: string): Promise<string> {
    try {
      if (!process.env.API_KEY) return "AI services are currently unavailable (API Key missing).";
      
      const parts: any[] = [{ text: userPrompt }];
      
      if (imageBase64) {
        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: imageBase64.split(',')[1] // Remove prefix
          }
        });
      }

      // Guideline: Always use ai.models.generateContent
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts },
        config: {
          systemInstruction: "You are an intelligent chat assistant. If an image is provided, analyze it. If not, just chat. Keep responses concise.",
          temperature: 0.7,
        }
      });

      // Guideline: Use the .text property (not a method)
      return response.text || "I couldn't process that.";
    } catch (error) {
      console.error("Gemini Error:", error);
      return "Error processing AI response.";
    }
  }

  // Generate image using Gemini 2.5 Flash Image
  async generateImage(prompt: string): Promise<string | null> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
        config: {
          imageConfig: { aspectRatio: "1:1" }
        }
      });

      // Guideline: Iterate through parts to find the image part, do not assume it is the first part.
      for (const candidate of response.candidates || []) {
        for (const part of candidate.content.parts) {
          if (part.inlineData) {
            return `data:image/png;base64,${part.inlineData.data}`;
          }
        }
      }
      return null;
    } catch (error) {
      console.error("Image Generation Error:", error);
      return null;
    }
  }
}

export const gemini = new GeminiService();
