import { Message } from './speaking-agent';
import { PlannerAgent } from './planner-agent';
import { SpeakingAgent } from './speaking-agent';
import { Database, AgentAction } from './types';

const actionRegex = /^Action: (\w+): (.*)$/;

export class AgentOrchestrator {
  private knownActions: Record<string, AgentAction>;

  constructor(
    private maxTurns: number = 3,
    private plannerAgent: PlannerAgent = new PlannerAgent(),
    private speakingAgent: SpeakingAgent = new SpeakingAgent(),
    actions: Record<string, AgentAction> = {
      'web_search': this.webSearch
    }
  ) {
    this.knownActions = actions;
    console.log('[AgentOrchestrator] Initializing with custom agents');
  }

  registerAction(name: string, action: AgentAction) {
    this.knownActions[name] = action;
  }

  private async webSearch(query: string): Promise<string> {
    console.log('[webSearch] Executing search for query:', query);
    try {
      const { search } = await import('duck-duck-scrape');
      const results = await search(query);
      console.log('[webSearch] Search completed, found results');
      return results.results.map((result: any) => result.description).join('\n');
    } catch (error) {
      console.error('[webSearch] Error during search:', error);
      throw error;
    }
  }

  async chat(message: string, history: Message[] = []): Promise<{ response: string; observation?: string | null }> {
    if (!message) {
      throw new Error('Message is required');
    }

    // 1. First, let the planner agent analyze the message and determine actions
    const messages = history.length > 0 
      ? [...history, { role: 'user' as const, content: message, type: 'text' as const }]
      : message;

    // For demo purposes, using a mock user ID and empty db
    const userId = 'demo-user';
    const db = null;

    const [response, observation] = await this.processMessage(messages, userId, db);
    return { response, observation };
  }

  private async processMessage(
    messages: string | Message[],
    userId: string,
    db: Database
  ): Promise<[string, string | null]> {
    console.log('[AgentOrchestrator] Starting message processing');
    let i = 0;
    
    let nextPrompt = messages;
    let observation: string | null = null;

    while (i < this.maxTurns) {
      i++;
      console.log(`[AgentOrchestrator] Starting turn ${i}/${this.maxTurns}`);
      try {
        // 2. Get the planner's analysis and action requests
        const plannerResult = await this.plannerAgent.plan(nextPrompt);
        console.log('[AgentOrchestrator] Planner agent result:', plannerResult);
        
        // 3. Check if any actions were requested
        const actions = plannerResult
          .split('\n')
          .map(line => actionRegex.exec(line))
          .filter((match): match is RegExpExecArray => match !== null);

        if (actions.length > 0) {
          // 4. Execute the requested action
          const [, action, actionInput] = actions[0];
          console.log(`[AgentOrchestrator] Detected action: ${action}`);
          if (!(action in this.knownActions)) {
            console.error(`[AgentOrchestrator] Unknown action: ${action}`);
            const errorMsg = `Unknown action: ${action}. Available actions: ${Object.keys(this.knownActions).join(', ')}`;
            return [errorMsg, null];
          }

          try {
            observation = await this.knownActions[action](actionInput, userId, db);
            nextPrompt = `Observation: ${observation}`;
            console.log(`[AgentOrchestrator] Action ${action} completed successfully`);
          } catch (e) {
            console.error(`[AgentOrchestrator] Error executing ${action}:`, e);
            return [`Error executing ${action}: ${e instanceof Error ? e.message : String(e)}`, null];
          }
        } else {
          // 5. No more actions needed, let the speaking agent generate a response
          console.log('[AgentOrchestrator] No actions needed, generating user response');
          
          // Prepare context for the speaking agent
          const userPrompt = typeof messages === 'string' 
            ? `General Context: ${messages}\nPlanner Context: ${plannerResult}${observation ? `\nAdditional Context: ${observation}` : ''}`
            : `General Context: ${messages[messages.length - 1].content}\nPlanner Context: ${plannerResult}${observation ? `\nAdditional Context: ${observation}` : ''}`;
          
          // Pass the full conversation history and context to the speaking agent
          const plannerMessages = this.plannerAgent.getMessages();
          const response = await this.speakingAgent.call([...plannerMessages, { role: 'user', content: userPrompt, type: 'text' }]);
          return [response, observation];
        }
      } catch (e) {
        console.error('[AgentOrchestrator] Error in agent loop:', e);
        return [`Error in agent loop: ${e instanceof Error ? e.message : String(e)}`, null];
      }
    }

    console.log('[AgentOrchestrator] Maximum turns reached');
    return ["Maximum turns reached", null];
  }
} 