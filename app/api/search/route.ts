import { NextResponse } from 'next/server';
import { search } from 'duck-duck-scrape';

export async function POST(request: Request) {
  try {
    const { query, agentRequest } = await request.json();
    
    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // Only allow requests from the agent orchestrator
    if (!agentRequest) {
      return NextResponse.json(
        { error: 'Search can only be performed through the agent system' },
        { status: 403 }
      );
    }

    const results = await search(query);
    const descriptions = results.results.map(result => result.description).join('\n');
    
    return NextResponse.json({ results: descriptions });
  } catch (error) {
    console.error('[Search API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to perform search' },
      { status: 500 }
    );
  }
} 