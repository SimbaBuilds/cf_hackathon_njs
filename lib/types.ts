export interface AgentConfig {
  maxTurns?: number;
  temperature?: number;
  model?: string;
}

export interface AgentResponse {
  response: string;
  observation: string | null;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  type: 'text';
}

export interface AgentOrchestratorState {
  maxTurns: number;
  planner: PlannerAgentState;
  speaker: SpeakingAgentState;
  knownActions: Record<string, string>;
  messages: Message[];
}

export interface PlannerAgentState {
  messages: Message[];
  temperature: number;
  model: string;
}

export interface SpeakingAgentState {
  messages: Message[];
  temperature: number;
  model: string;
} 