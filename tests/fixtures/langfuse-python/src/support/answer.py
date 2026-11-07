from langfuse import observe
from langfuse.openai import OpenAI

ANSWER_PROMPT = """Answer the customer in three sentences or fewer."""


@observe()
def answer(question: str) -> str:
    response = OpenAI().chat.completions.create(
        model="gpt-4.1",
        messages=[{"role": "system", "content": ANSWER_PROMPT}, {"role": "user", "content": question}],
    )
    return response.choices[0].message.content
