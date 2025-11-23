import { GoogleGenAI } from "@google/genai";
import { ChatMessage } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateAIResponse = async (
  currentMessage: string,
  history: ChatMessage[]
): Promise<string> => {
  try {
    const context = history
      .map((msg) => `${msg.senderName}: ${msg.text}`)
      .join("\n");

    const prompt = `
      You are a helpful, friendly AI assistant participating in a group chat. 
      Use the following conversation context to answer the user's request briefly and naturally.
      
      CONTEXT:
      ${context}
      
      USER REQUEST:
      ${currentMessage}
      
      RESPONSE (Keep it under 100 words):
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return response.text || "I couldn't generate a response.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Sorry, I'm having trouble connecting to the AI right now.";
  }
};

export const generateConversationStarter = async (): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: "Generate a fun, unique, and engaging conversation starter question for a group of friends. Just the question.",
        });
        return response.text || "What's the best meal you've ever had?";
    } catch (error) {
        return "What's the best meal you've ever had?";
    }
}