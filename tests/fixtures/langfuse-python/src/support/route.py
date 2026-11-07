from langfuse import observe
from langfuse.openai import OpenAI


@observe()
def route(ticket: str) -> str:
    response = OpenAI().chat.completions.create(
        model="gpt-4.1-mini",
        messages=[{"role": "user", "content": f"Route this ticket to billing, tech or sales: {ticket}"}],
    )
    return response.choices[0].message.content
