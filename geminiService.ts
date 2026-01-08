
import { GoogleGenAI } from "@google/genai";

export class GeminiService {
  private get ai() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async getAiResponse(userPrompt: string, imageBase64?: string): Promise<string> {
    try {
      if (!process.env.API_KEY) return "AI services are currently offline.";
      
      const parts: any[] = [{ text: userPrompt }];
      
      if (imageBase64) {
        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: imageBase64.split(',')[1]
          }
        });
      }

      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts },
        config: {
          systemInstruction: "You are the EB Assistant, a helpful AI within the EB ecosystem. Keep responses professional and concise.",
          temperature: 0.7,
        }
      });

      return response.text || "I'm having trouble thinking right now.";
    } catch (error) {
      console.error("Gemini Error:", error);
      return "Error reaching AI brain.";
    }
  }

  async generateImage(prompt: string): Promise<string | null> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
        config: {
          imageConfig: { aspectRatio: "1:1" }
        }
      });

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
