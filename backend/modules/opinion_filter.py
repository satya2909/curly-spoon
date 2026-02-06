def llm_filter_opinions(text: str, client) -> str:
    if client is None:
        return text

    prompt = f"""
Extract ONLY opinion-bearing sentences from the text below.

Rules:
- Keep sentences that express judgment, evaluation, liking, disliking
- Keep food quality opinions (taste, texture, size, freshness)
- Remove descriptions, storytelling, introductions, promotions
- Remove factual statements with no opinion
- Do NOT rewrite sentences
- Do NOT add new content

Return ONLY the extracted sentences.
If none exist, return an empty string.

Text:
{text}
"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.0,
        max_tokens=512
    )

    return response.choices[0].message.content.strip()
