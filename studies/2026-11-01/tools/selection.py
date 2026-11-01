import csv, json, sys
deps = json.load(open('deps.json'))
D = {
# Python
'NousResearch/hermes-agent':'app','Significant-Gravitas/AutoGPT':'app','huggingface/transformers':'x:model library',
'langgenius/dify':'app','open-webui/open-webui':'app','langchain-ai/langchain':'x:framework',
'Graphify-Labs/graphify':'app','harry0703/MoneyPrinterTurbo':'app','browser-use/browser-use':'x:library (self-described)',
'TauricResearch/TradingAgents':'x:framework (self-described)','vllm-project/vllm':'x:inference/serving','unclecode/crawl4ai':'x:crawler library for LLMs',
'datawhalechina/hello-agents':'x:tutorial','bytedance/deer-flow':'app','shareAI-lab/learn-claude-code':'x:tutorial',
'unslothai/unsloth':'x:training/local model runner','headroomlabs-ai/headroom':'x:token-compression infrastructure','rohitg00/ai-engineering-from-scratch':'x:tutorial',
'hiyouga/LlamaFactory':'x:fine-tuning','asgeirtj/system_prompts_leaks':'x:collection','mem0ai/mem0':'x:memory infrastructure',
'ZhuLinsen/daily_stock_analysis':'app','sansan0/TrendRadar':'app','blader/humanizer':'x:agent skill',
'BerriAI/litellm':'x:gateway/SDK','MemPalace/mempalace':'x:memory infrastructure','pathwaycom/serviette':'x:RAG server infrastructure',
'hesreallyhim/awesome-claude-code':'x:list','bojieli/ai-agent-book':'x:book','run-llama/llama_index':'x:framework',
'zhayujie/CowAgent':'app','paperless-ngx/paperless-ngx':'app','AstrBotDevs/AstrBot':'app','langchain-ai/langgraph':'x:framework',
'ray-project/ray':'x:compute engine','HKUDS/LightRAG':'x:RAG library','VectifyAI/PageIndex':'x:RAG library','google/langextract':'x:library (self-described)',
'sgl-project/sglang':'x:inference/serving','p-e-w/heretic':'x:model modification tool','HKUDS/Vibe-Trading':'app',
'virgiliojr94/book-to-skill':'app','microsoft/graphrag':'x:RAG library','mukul975/Anthropic-Cybersecurity-Skills':'x:skills collection',
'agentscope-ai/agentscope':'x:agent framework','onyx-dot-app/onyx':'app','ahujasid/mcp-for-blender':'x:MCP server',
'tirth8205/code-review-graph':'x:MCP/code-index infrastructure','ScrapeGraphAI/Scrapegraph-ai':'x:library (self-described)','openai/openai-agents-python':'x:framework',
'Fosowl/agenticSeek':'app',
# TypeScript
'firecrawl/firecrawl':'x:web-data API infrastructure','paperclipai/paperclip':'app','OpenHands/OpenHands':'app','upstash/context7':'x:docs platform/MCP for agents',
'CherryHQ/cherry-studio':'app','linshenkx/prompt-optimizer':'app','CopilotKit/CopilotKit':'x:framework','ItzCrazyKns/Vane':'app','can1357/oh-my-pi':'app',
'langfuse/langfuse':'x:eval/observability tool','DayuanJiang/next-ai-draw-io':'app','iOfficeAI/AionUi':'app','ComposioHQ/composio':'x:SDK/tool infrastructure',
'TencentCloud/TencentDB-Agent-Memory':'x:memory infrastructure','labring/FastGPT':'app','mastra-ai/mastra':'x:framework','yamadashy/repomix':'app',
'QwenLM/qwen-code':'app','vercel/ai':'x:SDK','hypit-ai/hypit':'app','promptfoo/promptfoo':'x:eval tool','toon-format/toon':'x:serialization format',
'walkinglabs/learn-harness-engineering':'x:tutorial','winfunc/opcode':'app','dyad-sh/dyad':'app','kortix-ai/suna':'app','mlc-ai/web-llm':'x:inference engine',
'ahmedkhaleel2004/gitdiagram':'app','lidge-jun/opencodex':'x:provider proxy','rowboatlabs/rowboat':'app','Anionex/banana-slides':'app',
'corsairdev/corsair':'x:integration infrastructure','NanmiCoder/cc-haha':'app','botpress/botpress':'app',
}
w = csv.writer(open('../selection.csv','w', newline=''))
w.writerow(['search_language','rank_by_stars','repo','stars_in_search','pushed_at','description','class','llm_sdk_dependencies_found','decision','reason'])
for lang in ['Python','TypeScript']:
    rows = [l.rstrip('\n').split('\t') for l in open(f'search_topic_llm_{lang}.tsv')][1:]
    taken = 0
    for i,(name,stars,pushed,desc) in enumerate(rows,1):
        if taken == 15: break
        c = D[name]
        key = name.replace('/','_')
        dep = deps.get(key, {}).get('llm_deps')
        depstr = ','.join(dep) if dep is not None else 'not checked'
        if c.startswith('x:'):
            dec, reason, cls = 'excluded', 'not an end-user application: '+c[2:], 'non-application'
        elif not dep:
            dec, reason, cls = 'excluded', 'application, but no LLM SDK dependency in any manifest', 'application'
        else:
            dec, reason, cls = 'included', '', 'application'; taken += 1
        w.writerow([lang,i,name,stars,pushed,desc,cls,depstr,dec,reason])
    print(lang, 'taken', taken, 'examined', i)
