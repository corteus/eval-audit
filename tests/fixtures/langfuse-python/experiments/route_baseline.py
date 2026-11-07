# Written for Langfuse Python SDK v3: each dataset item is linked to a run by hand.
from langfuse import get_client

from support.route import route

langfuse = get_client()
dataset = langfuse.get_dataset("ticket-routing")

for item in dataset.items:
    with item.run(run_name="baseline") as span:
        output = route(item.input)
        span.update(output=output)
        span.score_trace(name="correct", value=float(output == item.expected_output))
