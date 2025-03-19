import { useState } from 'react';
import { Message } from '../lib/agents/speaking-agent';
import { AgentOrchestrator } from '../lib/agents/agent-orchestrator';

interface ChatMessage extends Omit<Message, 'type'> {
  role: 'user' | 'assistant';
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const orchestrator = new AgentOrchestrator();

  const sendMessage = async (userMessage: string) => {
    if (!userMessage.trim() || isLoading) return;

    console.log('[Chat] User submitted message:', userMessage);
    setInput('');
    setMessages(prev => [...prev, { 
      role: 'user', 
      content: userMessage 
    }]);
    setIsLoading(true);

    try {
      console.log('[Chat] Processing message with AgentOrchestrator');
      const { response } = await orchestrator.chat(
        userMessage,
        messages.map(msg => ({ ...msg, type: 'text' as const }))
      );

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: response 
      }]);
    } catch (error) {
      console.error('[Chat] Error processing request:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, there was an error processing your request.' 
      }]);
    } finally {
      setIsLoading(false);
      console.log('[Chat] Request processing completed');
    }
  };

  return {
    messages,
    input,
    setInput,
    isLoading,
    sendMessage
  };
}
