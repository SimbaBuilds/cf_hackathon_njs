import { NextResponse } from 'next/server';
import { queryAgent } from '@/lib/utils/controller_agent';

export async function POST(request: Request) {
  try {
    const { message } = await request.json();
    
    // For demo purposes, using a mock user ID and empty db
    const userId = 'demo-user';
    const db = null;
    
    const [response] = await queryAgent(message, userId, db);
    
    return NextResponse.json({ response });
  } catch (error) {
    console.error('Error in chat route:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    );
  }
} 