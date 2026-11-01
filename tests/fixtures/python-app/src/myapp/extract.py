def extract(client, document: str) -> str:
    response = client.models.generate_content(model="gemini-2.5-flash", contents=document)
    return response.text
