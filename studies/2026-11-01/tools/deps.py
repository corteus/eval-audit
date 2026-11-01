import os, re, sys, json
root = sys.argv[1]
SKIP = {'node_modules','.git','dist','build','vendor','.venv','venv'}
PY = re.compile(r'(?im)^\s*["\']?(openai|anthropic|litellm|langchain[\w-]*|llama[-_]index[\w-]*|google-genai|google-generativeai|ollama|mistralai|cohere|groq|dashscope|zhipuai|instructor|pydantic-ai[\w-]*|browser-use|dspy[\w-]*)\b')
JS = re.compile(r'"(openai|@anthropic-ai/sdk|@anthropic-ai/claude-agent-sdk|ai|@ai-sdk/[\w-]+|@langchain/[\w-]+|langchain|@google/genai|@google/generative-ai|ollama|@mistralai/mistralai|cohere-ai|groq-sdk|@openrouter/ai-sdk-provider)"\s*:')
out = {}
for repo in sorted(os.listdir(root)):
    found = set(); manifests = 0
    for dp, dns, fns in os.walk(os.path.join(root, repo)):
        dns[:] = [d for d in dns if d not in SKIP and not d.startswith('.')]
        if dp.count(os.sep) - root.count(os.sep) > 5: dns[:] = []
        for fn in fns:
            p = os.path.join(dp, fn)
            if fn in ('pyproject.toml','setup.py','setup.cfg') or re.match(r'requirements[\w.-]*\.txt$', fn):
                rx = PY
            elif fn == 'package.json':
                rx = JS
            else: continue
            manifests += 1
            try: t = open(p, encoding='utf-8', errors='ignore').read()
            except Exception: continue
            for m in rx.finditer(t): found.add(m.group(1).lower())
    out[repo] = {'manifests': manifests, 'llm_deps': sorted(found)}
    print(f"{repo}\t{manifests}\t{','.join(sorted(found))[:150]}")
json.dump(out, open(sys.argv[2], 'w'), indent=1)
