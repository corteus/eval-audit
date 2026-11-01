from litellm import completion

SUMMARY_PROMPT = """Summarize the ticket in two sentences and name the product area."""


def summarize(ticket: str) -> str:
    response = completion(
        model="gpt-4o-mini",
        messages=[{"role": "system", "content": SUMMARY_PROMPT}, {"role": "user", "content": ticket}],
    )
    return response.choices[0].message.content
