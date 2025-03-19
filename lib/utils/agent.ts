import { DDGS } from 'duckduckgo-search';
import { getOpenAIClient } from '../openai/openai_client';
import { OpenAI } from 'openai';

// Types
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  type: 'text';
}

interface SearchResult {
  snippet: string;
}

// Use unknown type since we don't need specific database functionality for now
type Database = unknown;

// Constants
const agentPrompt = `
=== Context ===
You are an AI agent designed to analyze user requests and determine necessary actions. Your role is to:
1. Analyze the request
2. Determine if any actions are needed
3. Request specific actions when required
4. Provide a clear response about what was done or what needs to be done
5. Your job is not to interact with the user, but to invoke actions and report back results and next steps.

Additional Context: 

You operate in a loop of 3 phases: Thought, Action, and Observation.
At the end of the loop you will output a Response.

1. Thought: Analyze the current situation and determine how to proceed.
2. Action: If an action is needed, request it using exactly this format:
   Action: <action_name>: <parameters>
3. Observation: You will receive the result of your action
4. Response: Provide a clear summary of what was done and how to proceed.

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

Response: I've retrieved the latest information about the Trump administration's use of the 1787 Alien Enemies Act.  The administration recently declared Tren De Aragua a foreign terrorist organization and incoking the act to deport them.  You can now continue the conversation using this information.
`.trim();

class ControllerAgent {
  private messages: Message[];
  private client: OpenAI | null = null;

  constructor(system: string | Message[] = agentPrompt) {
    console.log('[ControllerAgent] Initializing with system prompt');
    this.messages = [];

    if (Array.isArray(system)) {
      this.messages = system;
      console.log('[ControllerAgent] Initialized with message array');
    } else if (typeof system === 'string' && system) {
      this.messages.push({
        role: 'system',
        content: system,
        type: 'text'
      });
      console.log('[ControllerAgent] Initialized with system string');
    }
  }

  private async getClient(): Promise<OpenAI> {
    if (!this.client) {
      console.log('[ControllerAgent] Creating new OpenAI client');
      this.client = await getOpenAIClient();
    }
    return this.client;
  }

  async call(message: string | Message[]): Promise<string> {
    console.log('[ControllerAgent] Processing new message');
    if (Array.isArray(message)) {
      for (const msg of message) {
        if ('role' in msg && 'content' in msg && 'type' in msg) {
          this.messages.push(msg as Message);
        } else {
          console.error('[ControllerAgent] Invalid message format:', msg);
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

    const result = await this.execute();
    this.messages.push({
      role: 'assistant',
      content: result,
      type: 'text'
    });
    console.log('[ControllerAgent] Message processed successfully');
    return result;
  }

  private async execute(): Promise<string> {
    console.log('[ControllerAgent] Executing OpenAI request');
    const client = await this.getClient();
    const completion = await client.chat.completions.create({
      model: "gpt-4",
      temperature: 0.7,
      messages: this.messages.map(({ role, content }) => ({ role, content }))
    });
    console.log('[ControllerAgent] OpenAI request completed');
    return completion.choices[0].message.content || '';
  }
}

class UserInteractionAgent {
  private messages: Message[];
  private client: OpenAI | null = null;

  constructor(system: string | Message[] = '') {
    console.log('[UserInteractionAgent] Initializing');
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
      model: "gpt-4",
      temperature: 0.7,
      messages: this.messages.map(({ role, content }) => ({ role, content }))
    });
    
    const result = completion.choices[0].message.content || '';
    this.messages.push({
      role: 'assistant',
      content: result,
      type: 'text'
    });
    console.log('[UserInteractionAgent] Message processed successfully');
    return result;
  }
}

async function webSearch(query: string): Promise<string> {
  console.log('[webSearch] Executing search for query:', query);
  const ddgs = new DDGS();
  const results = await ddgs.text(query, { maxResults: 5 });
  console.log('[webSearch] Search completed, found results');
  return (results as SearchResult[]).map(result => result.snippet).join('\n');
}

const knownActions: Record<string, (query: string, userId: string, db: Database) => Promise<string>> = {
  'search the web': webSearch
};

const actionRegex = /^Action: (\w+): (.*)$/;

export async function queryAgent(
  messages: string | Message[],
  userId: string,
  db: Database,
  maxTurns: number = 3
): Promise<[string, string | null]> {
  console.log('[queryAgent] Starting agent query with maxTurns:', maxTurns);
  let i = 0;
  
  const controllerAgent = new ControllerAgent();
  const userAgent = new UserInteractionAgent();
  let nextPrompt = messages;
  let observation: string | null = null;
  let finalResponse: string | null = null;

  while (i < maxTurns) {
    i++;
    console.log(`[queryAgent] Starting turn ${i}/${maxTurns}`);
    try {
      // First, let the controller agent analyze and plan
      const controllerResult = await controllerAgent.call(nextPrompt);
      console.log('[queryAgent] Controller agent result:', controllerResult);
      
      const actions = controllerResult
        .split('\n')
        .map(line => actionRegex.exec(line))
        .filter((match): match is RegExpExecArray => match !== null);

      if (actions.length > 0) {
        const [, action, actionInput] = actions[0];
        console.log(`[queryAgent] Detected action: ${action}`);
        if (!(action in knownActions)) {
          console.error(`[queryAgent] Unknown action: ${action}`);
          const errorMsg = `Unknown action: ${action}. Available actions: ${Object.keys(knownActions).join(', ')}`;
          return [errorMsg, null];
        }

        try {
          observation = await knownActions[action](actionInput, userId, db);
          nextPrompt = `Observation: ${observation}`;
          console.log(`[queryAgent] Action ${action} completed successfully`);
        } catch (e) {
          console.error(`[queryAgent] Error executing ${action}:`, e);
          return [`Error executing ${action}: ${e instanceof Error ? e.message : String(e)}`, null];
        }
      } else {
        console.log('[queryAgent] No actions needed, generating user response');
        // If no actions are needed, let the user agent handle the response
        // Pass both the original message and the controller's analysis
        const userPrompt = `Original message: ${typeof messages === 'string' ? messages : messages[messages.length - 1].content}\n\nController's analysis: ${controllerResult}`;
        finalResponse = await userAgent.call(userPrompt);
        console.log('[queryAgent] User agent generated response:', finalResponse);
        return [finalResponse, observation];
      }
    } catch (e) {
      console.error('[queryAgent] Error in agent loop:', e);
      return [`Error in agent loop: ${e instanceof Error ? e.message : String(e)}`, null];
    }
  }

  console.log('[queryAgent] Maximum turns reached');
  return ["Maximum turns reached", null];
}
