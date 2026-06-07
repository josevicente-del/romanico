# Action Plan

- URL: `http://localhost:8080/`
- Overall score: `36/100`

## Priority Fixes

1. **Missing H1 on page**
   - Priority: `Critical`
   - Area: `environment`
   - Evidence: No primary content heading was detected, which weakens topical clarity.
   - Fix: Ensure each page has exactly one descriptive H1 aligned to intent.
2. **Average internal links per page is only 0.0 (target: 5-10).**
   - Priority: `Critical`
   - Area: `link_profile`
   - Evidence: See audit output.
   - Fix: Increase internal linking by adding contextual links within content.
3. **Meta description is missing or out of range**
   - Priority: `Warning`
   - Area: `environment`
   - Evidence: This can reduce SERP CTR and snippet quality.
   - Fix: Update page templates to set complete title/meta/OG/Twitter tags.
4. **Title tag needs optimization**
   - Priority: `Warning`
   - Area: `environment`
   - Evidence: Title length/content is likely suboptimal for rankings and click-through.
   - Fix: Update page templates to set complete title/meta/OG/Twitter tags.
5. **No llms.txt found**
   - Priority: `Warning`
   - Area: `environment`
   - Evidence: AI crawlers and assistants have no curated machine-readable guidance for key pages.
   - Fix: Add `/llms.txt` at site root with concise site description and key URLs.
6. **Performance measurement incomplete**
   - Priority: `Info`
   - Area: `environment`
   - Evidence: PageSpeed API returned an error, so CWV recommendations are less reliable.
   - Fix: Set `PAGESPEED_API_KEY` in your environment or `.env` file (see `.env.example`), then rerun. The CLI also accepts `--api-key`. Prioritize LCP/INP/CLS fixes from that output.
