import { OpenAI } from 'openai';
import { getOpenAIClient } from '../openai/openai_client';

// Types
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  type: 'text';
}

const SpeakingAgentPrompt = `
You are a friendly and helpful AI agent responsible for communicating with human users. Your role is to:
1. Take the planner agent's analysis and any search results/observations
2. Generate clear, concise, and natural responses that incorporate this information
3. Be conversational and engaging
4. Keep responses focused and relevant to the human user's input
5. Avoid sharing internal thought processes or technical details

You will receive input in this format:
General Context: [The full conversation history]
Planner Context: [The planner agent's analysis and any action results]
Additional Context: [Optional results from web searches or other actions]

Remember to:
- Use the provided context and search results to inform your response
- Be direct and clear in your responses
- Keep responses concise and to the point
- If the context contains relevant information, incorporate it naturally into your response
- Maintain a helpful and professional tone
`.trim();

export class SpeakingAgent {
  private messages: Message[];
  private client: OpenAI | null = null;

  constructor(system: string | Message[] = SpeakingAgentPrompt) {
    console.log('[SpeakingAgent] Initializing with system prompt');
    this.messages = [];

    if (Array.isArray(system)) {
      this.messages = system;
      console.log('[SpeakingAgent] Initialized with message array');
    } else if (typeof system === 'string' && system) {
      this.messages.push({
        role: 'system',
        content: system,
        type: 'text'
      });
      console.log('[SpeakingAgent] Initialized with system string');
    }
  }

  private async getClient(): Promise<OpenAI> {
    if (!this.client) {
      console.log('[SpeakingAgent] Creating new OpenAI client');
      this.client = await getOpenAIClient();
    }
    return this.client;
  }

  async call(message: string | Message[]): Promise<string> {
    console.log('[SpeakingAgent] Processing new message');
    if (Array.isArray(message)) {
      for (const msg of message) {
        if ('role' in msg && 'content' in msg && 'type' in msg) {
          this.messages.push(msg as Message);
        } else {
          console.error('[SpeakingAgent] Invalid message format:', msg);
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
    console.log('[SpeakingAgent] Executing OpenAI request');
    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      temperature: 1.0,
      messages: this.messages.map(({ role, content }) => ({ role, content }))
    });
    
    const result = completion.choices[0].message.content || '';
    console.log('[SpeakingAgent] Generated response:', result);
    
    this.messages.push({
      role: 'assistant',
      content: result,
      type: 'text'
    });
    console.log('[SpeakingAgent] Message processed successfully');
    return result;
  }

  // Add method to get conversation history
  getMessages(): Message[] {
    return [...this.messages];
  }
}
