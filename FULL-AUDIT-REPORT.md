# Full Audit Report

- URL: `http://localhost:8080/`
- Generated: `2026-06-07T22:14:48.840433`
- Overall score: `36/100`
- Score confidence: `Low`
- Scoring version: `1`

## Score Card

| Category | Weight | Score |
| --- | ---: | ---: |
| Security Headers | 8 | 0 |
| Social Meta | 5 | 0 |
| Robots and Crawlers | 8 | 0 |
| Broken Links | 10 | 100 |
| Internal Links | 8 | 100 |
| Redirects | 3 | 100 |
| AI Search | 5 | 0 |
| Performance and Core Web Vitals | 13 | 0 |
| On-Page SEO | 10 | 0 |
| Readability | 8 | 0 |
| Entity SEO | 5 | 0 |
| Link Profile | 7 | 55 |
| Hreflang | 5 | 0 |
| Content Uniqueness | 5 | 100 |

## Findings

| Severity | Area | Finding | Evidence | Fix |
| --- | --- | --- | --- | --- |
| Critical | environment | Missing H1 on page | No primary content heading was detected, which weakens topical clarity. | Ensure each page has exactly one descriptive H1 aligned to intent. |
| Critical | link_profile | Average internal links per page is only 0.0 (target: 5-10). |  | Increase internal linking by adding contextual links within content. |
| Warning | environment | Meta description is missing or out of range | This can reduce SERP CTR and snippet quality. | Update page templates to set complete title/meta/OG/Twitter tags. |
| Warning | environment | Title tag needs optimization | Title length/content is likely suboptimal for rankings and click-through. | Update page templates to set complete title/meta/OG/Twitter tags. |
| Warning | environment | No llms.txt found | AI crawlers and assistants have no curated machine-readable guidance for key pages. | Add `/llms.txt` at site root with concise site description and key URLs. |
| info | broken_links | broken_links measurement incomplete | Failed to fetch page: Blocked: URL resolves to private/internal IP (127.0.0.1) | Rerun this check after resolving the environment/API/network limitation. |
| info | entity | entity measurement incomplete | Failed to fetch http://localhost:8080/ | Rerun this check after resolving the environment/API/network limitation. |
| Info | environment | Performance measurement incomplete | PageSpeed API returned an error, so CWV recommendations are less reliable. | Set `PAGESPEED_API_KEY` in your environment or `.env` file (see `.env.example`), then rerun. The CLI also accepts `--api-key`. Prioritize LCP/INP/CLS fixes from that output. |
| info | hreflang | hreflang measurement incomplete | Failed to fetch URL: http://localhost:8080/ | Rerun this check after resolving the environment/API/network limitation. |
| info | llms_txt | llms_txt measurement incomplete | Blocked: URL resolves to private/internal IP (127.0.0.1) | Rerun this check after resolving the environment/API/network limitation. |
| info | pagespeed | pagespeed measurement incomplete | Rate limited by Google API. Wait a few minutes or add an API key. | Rerun this check after resolving the environment/API/network limitation. |
| info | redirects | redirects measurement incomplete | Blocked: URL resolves to private/internal IP (127.0.0.1) | Rerun this check after resolving the environment/API/network limitation. |
| info | robots | robots measurement incomplete | Blocked: URL resolves to private/internal IP (127.0.0.1) | Rerun this check after resolving the environment/API/network limitation. |
| info | security | security measurement incomplete | Blocked: URL resolves to private/internal IP (127.0.0.1) | Rerun this check after resolving the environment/API/network limitation. |
| info | social | social measurement incomplete | Blocked: URL resolves to private/internal IP (127.0.0.1) | Rerun this check after resolving the environment/API/network limitation. |

## Measurement Notes

9 checks returned errors or incomplete measurements; treat affected scores as directional.
