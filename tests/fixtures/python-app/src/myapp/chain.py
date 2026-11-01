class Router:
    def __init__(self, routing_chain):
        self.routing_chain = routing_chain

    async def route(self, question: str) -> str:
        return await self.routing_chain.ainvoke({"question": question})


def completion(value):
    """A local helper named like LiteLLM's; this file does not import litellm."""
    return value
