from langfuse import RunnerContext
from langfuse.api import DatasetItem

from support.answer import answer


def task(item: DatasetItem, **kwargs):
    return answer(item.input)


def exact_match(*, output, expected_output, **kwargs):
    return 1.0 if output == expected_output else 0.0


def experiment(context: RunnerContext):
    return context.run_experiment(name="PR gate", task=task, evaluators=[exact_match])
