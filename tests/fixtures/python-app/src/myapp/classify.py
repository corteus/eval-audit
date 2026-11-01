class Classifier:
    def __init__(self, anthropic_client):
        self.anthropic_client = anthropic_client

    def classify(self, text: str) -> str:
        message = self.anthropic_client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=64,
            messages=[{"role": "user", "content": text}],
        )
        return message.content[0].text
