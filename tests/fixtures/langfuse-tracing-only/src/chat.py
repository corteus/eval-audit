from langfuse import get_client, observe
from langfuse.openai import OpenAI

langfuse = get_client()

# Experiments are planned: langfuse.run_experiment(name="chat", data=..., task=...)


@observe()
def chat(message: str) -> str:
    prompt = langfuse.get_prompt("chat-system")
    response = OpenAI().chat.completions.create(
        model="gpt-4.1",
        messages=[{"role": "system", "content": prompt.compile()}, {"role": "user", "content": message}],
    )
    return response.choices[0].message.content


def record_feedback(trace_id: str, thumbs_up: bool) -> None:
    langfuse.create_score(trace_id=trace_id, name="user-feedback", value=1.0 if thumbs_up else 0.0)


def list_examples():
    # Shows dataset items in the admin page; nothing is run against them.
    dataset = langfuse.get_dataset("chat-examples")
    return [item.input for item in dataset.items]
