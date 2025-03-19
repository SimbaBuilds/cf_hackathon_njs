import { OpenAI } from 'openai';
import { getOpenAIClient } from '../openai/openai_client';

// Types
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  type: 'text';
}

const userInteractionAgentPrompt = `
You are a friendly and helpful AI assistant. Your role is to:
1. Provide clear, concise, and natural responses to user messages
2. Be conversational and engaging
3. Keep responses focused and relevant to the user's input
4. Avoid sharing internal thought processes or technical details
5. If you need more information, ask specific questions
6. Follow instructions given by a controller AI that performs actions and makes decisions

You will receive input in this format:
User Query: [The original user question]
Context: [The controller agent's analysis and response]
Search Results: [Optional search results from web searches]

Remember to:
- Use the provided context and search results to inform your response
- Be direct and clear in your responses
- Keep responses concise and to the point
- If the context contains relevant information, incorporate it naturally into your response
`.trim();

export class UserInteractionAgent {
  private messages: Message[];
  private client: OpenAI | null = null;

  constructor(system: string | Message[] = userInteractionAgentPrompt) {
    console.log('[UserInteractionAgent] Initializing with system prompt');
    this.messages = [];

    if (Array.isArray(system)) {
      this.messages = system;
      console.log('[UserInteractionAgent] Initialized with message array');
    } else if (typeof system === 'string' && system) {
      this.messages.push({
        role: 'system',
        content: system,
        type: 'text'
      });
      console.log('[UserInteractionAgent] Initialized with system string');
    }
  }

  private async getClient(): Promise<OpenAI> {
    if (!this.client) {
      console.log('[UserInteractionAgent] Creating new OpenAI client');
      this.client = await getOpenAIClient();
    }
    return this.client;
  }

  async call(message: string | Message[]): Promise<string> {
    console.log('[UserInteractionAgent] Processing new message');
    if (Array.isArray(message)) {
      for (const msg of message) {
        if ('role' in msg && 'content' in msg && 'type' in msg) {
          this.messages.push(msg as Message);
        } else {
          console.error('[UserInteractionAgent] Invalid message format:', msg);
          throw new Error("Each message must contain 'role', 'content', and 'type'.");
        }
      }
    } else {
      this.messages.push({
        role: 'user',
        content: message,
        type: 'text'
      });
    }

    const client = await this.getClient();
    console.log('[UserInteractionAgent] Executing OpenAI request');
    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.7,
      messages: this.messages.map(({ role, content }) => ({ role, content }))
    });
    
    const result = completion.choices[0].message.content || '';
    console.log('[UserInteractionAgent] Generated response:', result);
    
    this.messages.push({
      role: 'assistant',
      content: result,
      type: 'text'
    });
    console.log('[UserInteractionAgent] Message processed successfully');
    return result;
  }
}
