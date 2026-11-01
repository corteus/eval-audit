from inspect_ai import Task, task
from inspect_ai.dataset import Sample

from myapp.summarize import summarize


@task
def summary_quality():
    return Task(dataset=[Sample(input="Printer jams on page 2", target="hardware")], solver=[])
