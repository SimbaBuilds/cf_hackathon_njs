from openai import OpenAI
import re
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import UUID
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, APIRouter, Form
from typing import Optional, Dict, List
from pydantic import BaseModel
from typing import List
from dotenv import load_dotenv
import os
from duckduckgo_search import DDGS
load_dotenv()

client = OpenAI(api_key = os.getenv("OPENAI_API_KEY"))


additional_context = """
"""

agent_prompt = f"""
=== Context ===
You are an AI agent designed to analyze user requests and determine necessary actions. Your role is to:
1. Analyze the request
2. Determine if any actions are needed
3. Request specific actions when required
4. Provide a clear response about what was done or what needs to be done

Additional Context: {additional_context}

You operate in a loop of 3 phases: Thought, Action, and Observation.
At the end of the loop you will output a Response.

1. Thought: Analyze the current situation and determine how to proceed.
2. Action: If an action is needed, request it using exactly this format:
   Action: <action_name>: <parameters>
3. Observation: You will receive the result of your action
4. Response: Provide a clear summary of what was done and/or what needs to be done next

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

""".strip()

class Agent:
    def __init__(self, system = agent_prompt):
        self.messages = []

        if isinstance(system, list):
            # Initialize with a list of dictionaries
            self.messages = system
        elif isinstance(system, str) and system:
            # Initialize with a system message string
            self.messages.append({
                "role": "system", 
                "content": system,  #
                "type": "text"      
            })

    def __call__(self, message):
        if isinstance(message, list):
            # Assuming the list contains dictionaries in the expected format
            for msg in message:
                if 'role' in msg and 'content' in msg and 'type' in msg:
                    self.messages.append(msg)
                else:
                    raise ValueError("Each message must contain 'role', 'content', and 'type'.")
        else:
            # Append a single user message
            self.messages.append({
                "role": "user", 
                "content": message,  # Content is a plain string
                "type": "text"       # Assuming "type" is required
            })
        result = self.execute()
        self.messages.append({
            "role": "assistant", 
            "content": result,  # Content is a plain string
            "type": "text"      # Assuming "type" is required
        })
        return result

    def execute(self):
        completion = client.chat.completions.create(
                        model="gpt-4o", 
                        temperature=0.7,
                        messages=self.messages)
        return completion.choices[0].message.content



def web_search(query):
    ddgs = DDGS()
    results = ddgs.text(query, max_results=5)
    return "\n".join([result['snippet'] for result in results])

known_actions = {
    "search the web": web_search
  
}

action_re = re.compile('^Action: (\w+): (.*)$')   # python regular expression to selection action

def query_agent(messages, user_id: UUID, db, max_turns=3):
    i = 0
    print("agent queried")
    bot = Agent()
    next_prompt = messages
    observation = None  
    
    while i < max_turns:
        i += 1
        try:
            result = bot(next_prompt)
            actions = [
                action_re.match(a) 
                for a in result.split('\n') 
                if action_re.match(a)
            ]
            
            if actions:
                action, action_input = actions[0].groups()
                if action not in known_actions:
                    error_msg = f"Unknown action: {action}. Available actions: {', '.join(known_actions.keys())}"
                    return error_msg, None
                    
                try:
                    observation = known_actions[action](action_input, user_id, db)
                    next_prompt = f"Observation: {observation}"
                except Exception as e:
                    return f"Error executing {action}: {str(e)}", None
            else:
                # Extract the response part (everything after the last Observation)
                response_lines = result.split('\n')
                response_start = 0
                for i, line in enumerate(response_lines):
                    if line.startswith('Observation:'):
                        response_start = i + 1
                response = '\n'.join(response_lines[response_start:]).strip()
                return response, observation
                
        except Exception as e:
            return f"Error in agent loop: {str(e)}", None










