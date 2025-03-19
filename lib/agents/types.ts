import { Message } from './speaking-agent';

export interface SearchResult {
  title: string;
  description: string;
  url: string;
}

// Use unknown type since we don't need specific database functionality for now
export type Database = unknown;

export type AgentAction = (query: string, userId: string, db: Database) => Promise<string>; 