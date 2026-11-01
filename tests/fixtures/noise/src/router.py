def route(structured_llm, question):
    return structured_llm.invoke(question)


def summarize(model, prompt):
    """Pure-sync path using ``model.invoke()`` so no event loop is created."""
    # model.invoke() would block here, so callers use a thread
    return prompt


async def remote(ctx):  # ``await ctx.llm.acomplete(...)`` is proxied elsewhere
    return ctx


def build_kwargs():
    """Build kwargs for anthropic.messages.create(). max_tokens is the output cap."""
    return {}
