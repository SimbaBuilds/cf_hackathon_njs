import { getOpenAIClient } from '../openai/openai_client';
import { OpenAI } from 'openai';
import { Message } from './speaking-agent';

// Constants
const agentPrompt = `
=== Context ===
You are an AI agent designed to analyze human user requests and determine necessary actions. Your role is to:
1. Analyze the request
2. Determine if any actions are needed
3. Request specific actions when required
4. Provide a clear response about what was done or what needs to be done
5. Your job is not to interact with the user, but to invoke actions and report back results and next steps to other AI agents.

Additional Context: 

You operate in a loop of 3 phases: Thought, Action, and Observation.
When it is determined that no more actions are needed you will output a Response.

1. Thought: Analyze the current situation and determine how to proceed.
2. Action: If an action is needed, request it using exactly this format:
   Action: <action_name>: <parameters>
3. Observation: You will receive the result of your action
4. Response: Provide a clear summary of what was or was not done.

=== Available Actions ===

1. Action Name: web_search
   Description: Search the web for current information
   Parameters: 
     - query (string): The search query
   Returns: Text snippets from web search results
   Example: Action: web_search: Current inflation rate in United States 2024

=== Error Handling ===
If an action fails:
1. You will receive an error message in the Observation
2. Explain what went wrong in your response

=== Example Flow ===

State: The user is asking about the Trump administration's recent use of the 1787 Alien Enemies Act.
Thought: This requires current information from news sources so I should invoke an action to search the web.
Action: web_search: Trump administration recent use of the 1787 Alien Enemies Act

Observation: [Search Results]

Response: I've retrieved the latest information about the Trump administration's use of the 1787 Alien Enemies Act.  The administration recently declared Tren De Aragua a foreign terrorist organization and is using the act to deport the alleged terrorists.  You can now continue the conversation using this information.
`.trim();

export class PlannerAgent {
  private messages: Message[];
  private client: OpenAI | null = null;

  constructor(system: string | Message[] = agentPrompt) {
    console.log('[PlannerAgent] Initializing with system prompt');
    this.messages = [];

    if (Array.isArray(system)) {
      this.messages = system;
      console.log('[PlannerAgent] Initialized with message array');
    } else if (typeof system === 'string' && system) {
      this.messages.push({
        role: 'system',
        content: system,
        type: 'text'
      });
      console.log('[PlannerAgent] Initialized with system string');
    }
  } 

  private async getClient(): Promise<OpenAI> {
    if (!this.client) {
      console.log('[PlannerAgent] Creating new OpenAI client');
      this.client = await getOpenAIClient();
    }
    return this.client;
  }

  async plan(message: string | Message[]): Promise<string> {
    console.log('[PlannerAgent] Processing new message');
    if (Array.isArray(message)) {
      for (const msg of message) {
        if ('role' in msg && 'content' in msg && 'type' in msg) {
          this.messages.push(msg as Message);
        } else {
          console.error('[PlannerAgent] Invalid message format:', msg);
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

    // Pass the full conversation history to execute
    const result = await this.execute(this.messages);
    this.messages.push({
      role: 'assistant',
      content: result,
      type: 'text'
    });
    console.log('[PlannerAgent] Message processed successfully');
    return result;
  }

  private async execute(messages: Message[]): Promise<string> {
    console.log('[PlannerAgent] Executing OpenAI request');
    const client = await this.getClient();
    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      temperature: 1.0,
      messages: messages.map(({ role, content }) => ({ role, content }))
    });
    console.log('[PlannerAgent] OpenAI request completed');
    return completion.choices[0].message.content || '';
  }

  getMessages(): Message[] {
    return this.messages;
  }
} 