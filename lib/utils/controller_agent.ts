import { getOpenAIClient } from '../openai/openai_client';
import { OpenAI } from 'openai';
import { SpeakingAgent, Message } from '../agents/speaking-agent';

// Types
interface SearchResult {
  title: string;
  description: string;
  url: string;
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

class ActionAgent {
  private messages: Message[];
  private client: OpenAI | null = null;

  constructor(system: string | Message[] = agentPrompt) {
    console.log('[ActionAgent] Initializing with system prompt');
    this.messages = [];

    if (Array.isArray(system)) {
      this.messages = system;
      console.log('[ActionAgent] Initialized with message array');
    } else if (typeof system === 'string' && system) {
      this.messages.push({
        role: 'system',
        content: system,
        type: 'text'
      });
      console.log('[ActionAgent] Initialized with system string');
    }
  } 

  private async getClient(): Promise<OpenAI> {
    if (!this.client) {
      console.log('[ActionAgent] Creating new OpenAI client');
      this.client = await getOpenAIClient();
    }
    return this.client;
  }

  async call(message: string | Message[]): Promise<string> {
    console.log('[ActionAgent] Processing new message');
    if (Array.isArray(message)) {
      for (const msg of message) {
        if ('role' in msg && 'content' in msg && 'type' in msg) {
          this.messages.push(msg as Message);
        } else {
          console.error('[ActionAgent] Invalid message format:', msg);
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
    console.log('[ActionAgent] Message processed successfully');
    return result;
  }

  private async execute(messages: Message[]): Promise<string> {
    console.log('[ActionAgent] Executing OpenAI request');
    const client = await this.getClient();
    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      temperature: 1.0,
      messages: messages.map(({ role, content }) => ({ role, content }))
    });
    console.log('[ActionAgent] OpenAI request completed');
    return completion.choices[0].message.content || '';
  }

  getMessages(): Message[] {
    return this.messages;
  }
}

async function webSearch(query: string): Promise<string> {
  console.log('[webSearch] Executing search for query:', query);
  try {
    const { search } = await import('duck-duck-scrape');
    const results = await search(query);
    console.log('[webSearch] Search completed, found results');
    return results.results.map((result: SearchResult) => result.description).join('\n');
  } catch (error) {
    console.error('[webSearch] Error during search:', error);
    throw error;
  }
}

const knownActions: Record<string, (query: string, userId: string, db: Database) => Promise<string>> = {
  'web_search': webSearch
};

const actionRegex = /^Action: (\w+): (.*)$/;

export async function queryAgents(
  messages: string | Message[],
  userId: string,
  db: Database,
  maxTurns: number = 3
): Promise<[string, string | null]> {
  console.log('[queryAgents] Starting agent query with maxTurns:', maxTurns);
  let i = 0;
  
  const actionAgent = new ActionAgent();
  const userAgent = new SpeakingAgent();
  let nextPrompt = messages;
  let observation: string | null = null;

  while (i < maxTurns) {
    i++;
    console.log(`[queryAgents] Starting turn ${i}/${maxTurns}`);
    try {
      const controllerResult = await actionAgent.call(nextPrompt);
      console.log('[queryAgents] Controller agent result:', controllerResult);
      
      const actions = controllerResult
        .split('\n')
        .map(line => actionRegex.exec(line))
        .filter((match): match is RegExpExecArray => match !== null);

      if (actions.length > 0) {
        const [, action, actionInput] = actions[0];
        console.log(`[queryAgents] Detected action: ${action}`);
        if (!(action in knownActions)) {
          console.error(`[queryAgents] Unknown action: ${action}`);
          const errorMsg = `Unknown action: ${action}. Available actions: ${Object.keys(knownActions).join(', ')}`;
          return [errorMsg, null];
        }

        try {
          observation = await knownActions[action](actionInput, userId, db);
          nextPrompt = `Observation: ${observation}`;
          console.log(`[queryAgents] Action ${action} completed successfully`);
        } catch (e) {
          console.error(`[queryAgents] Error executing ${action}:`, e);
          return [`Error executing ${action}: ${e instanceof Error ? e.message : String(e)}`, null];
        }
      } else {
        console.log('[queryAgents] No actions needed, generating user response');
        // Pass the full conversation history to the user agent
        const userPrompt = typeof messages === 'string' 
          ? `User Query: ${messages}\nContext: ${controllerResult}${observation ? `\nSearch Results: ${observation}` : ''}`
          : `User Query: ${messages[messages.length - 1].content}\nContext: ${controllerResult}${observation ? `\nSearch Results: ${observation}` : ''}`;
        
        // Add the full conversation history from the controller agent
        const controllerMessages = actionAgent.getMessages();
        const response = await userAgent.call([...controllerMessages, { role: 'user', content: userPrompt, type: 'text' }]);
        return [response, observation];
      }
    } catch (e) {
      console.error('[queryAgents] Error in agent loop:', e);
      return [`Error in agent loop: ${e instanceof Error ? e.message : String(e)}`, null];
    }
  }

  console.log('[queryAgents] Maximum turns reached');
  return ["Maximum turns reached", null];
}
