declare module 'duckduckgo-search' {
  export class DDGS {
    constructor();
    text(query: string, options?: { maxResults?: number }): Promise<Array<{ snippet: string }>>;
  }
} 