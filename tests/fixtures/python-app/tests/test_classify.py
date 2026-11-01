from unittest.mock import MagicMock

from myapp import classify


def test_classify_returns_text():
    client = MagicMock()
    client.messages.create.return_value.content = [MagicMock(text="billing")]
    assert classify.Classifier(client).classify("refund please") == "billing"
