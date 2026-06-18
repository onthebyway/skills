---
name: client-request-triage
description: Use when the user provides a raw client request from email, Slack, or a ticket and wants help interpreting the real goal, reproducing or detecting the issue, asking only necessary follow-up via ask_user_question, and producing a concise root cause summary.
---

# Client Request Triage

## Purpose

Turn a raw client message into a researched, concise triage: what the client is really reporting, whether the issue can be reproduced or detected, the brief root cause analysis, and any non-discoverable context needed from the user.

## When to use

Use this skill when the user shares client-provided text from an email, Slack message, project management ticket, support ticket, bug report, feature request, or account thread and asks what it means, what to ask, or how to resolve it.

## Workflow

1. **Preserve the raw request**
   - Treat the client message as the source of truth.
   - Do not rewrite it in a way that loses nuance, urgency, dates, names, links, errors, or commitments.

2. **Interpret the real goal**
   - Identify what the client is explicitly asking for.
   - Infer the likely underlying goal, business need, user pain, or operational blocker.
   - Separate symptoms from the desired outcome.
   - Flag assumptions clearly.

3. **Do self-service research before asking questions**
   - If the request contains a website, URL, page name, ticket link, error text, product name, or other discoverable clue, investigate it before asking the user for information.
   - For websites/pages, fetch and inspect the live page HTML where possible, follow obvious relevant links, and use screenshot/browser tools when the visual state matters.
   - Check whether facts can be determined directly: CMS/framework, forms/plugins, visible email addresses, console/network errors, tracking/forms endpoints, metadata, page structure, public DNS/hosting hints, documentation, repository files, or tickets available in the workspace.
   - Do not ask the user questions that can reasonably be answered from public/project context.
   - Record what was checked, with evidence.

4. **Classify the request**
   - Choose the best-fit type: incident, bug, support question, configuration issue, new feature request, or unclear.
   - Estimate urgency and impact from both the client message and discovered evidence.
   - Note if urgency/impact still needs confirmation.

5. **Identify missing information after research**
   - List only the information genuinely needed to move forward after self-service research.
   - Prefer asking the user about historic, relationship, access, commercial, or project-specific context that cannot be discovered independently.
   - Ask the client only for evidence they uniquely possess, such as examples of received emails, screenshots from their account, exact timing, affected users, business impact, or permission to make a change.
   - Do not put questions for the user into the markdown output. If the user's answer changes the next action, ask via the `ask_user_question` tool before producing the final triage.
   - If the user's answer would not change the root cause analysis, proceed with a stated assumption instead of asking.

6. **Ask before deep diving only if truly blocked**
   - If essential non-discoverable context is missing, ask the user via `ask_user_question` before proceeding.
   - Group all user questions into one `ask_user_question` invocation with concise choices when possible.
   - If the missing information must come from the client, include a client-ready clarification message in the final output that is concise, respectful, and matches the original language.
   - If there is enough information to investigate, continue without unnecessary back-and-forth.

7. **Reproduce or detect the issue**
   - Make a concrete attempt to reproduce the reported issue whenever safe and possible.
   - For website/UI issues, use browser/screenshot tools when visual evidence matters and inspect HTML/network/console signals when implementation evidence matters.
   - For code/config/data issues, inspect the relevant files or available artifacts and identify the exact code path, setting, plugin, endpoint, or data condition involved.
   - If direct reproduction is not safe or possible, detect the issue indirectly through code, configuration, logs, public signals, or a clearly stated simulation.
   - Capture only concise evidence: what was checked, what reproduced/detected, and what did not.

8. **Do brief root cause analysis**
   - Explain the most likely cause in practical terms.
   - Distinguish confirmed cause from likely cause.
   - Include confidence level and what would raise confidence.
   - Do not provide generic recommended next steps unless the user explicitly asks for solutions or implementation planning.

## Output format

Keep the final output concise and focused on reproduction/detection plus root cause. Preserve information that changes understanding, priority, confidence, or cause, but avoid turning the triage into an essay. Do not restate basic context the user already knows from the client relationship, such as sender name, site URL, CMS, obvious page title, or raw request details, unless that fact is important evidence for the root cause.

Default length target: 6–12 bullets total. Use fewer bullets for simple requests. Use more only when complexity genuinely requires it. Do not include a generic “recommended next steps” section.

Use this structure unless the user asks for a different format:

```markdown
## Read on the Request
- What they likely need:
- Priority/impact:

## Reproduction / Detection
- What was reproduced or detected:
- Evidence:
- If not reproducible, why:

## Brief Root Cause Analysis
- Likely cause:
- Confidence:
- What would confirm it, if needed:

## Client Clarification Needed
- Include only if the client must provide evidence/approval before work can continue.
- Do not include questions for the user here; ask those via `ask_user_question` before final output.
```

## Communication style

- Be direct, practical, and calm.
- Avoid over-apologizing or admitting fault before cause is known.
- Do not promise timelines, fixes, refunds, or product changes unless the user has provided that commitment.
- Prefer language that shows ownership: “I’ll take a look,” “We’re checking,” “The next useful detail would be...”
- Keep client-facing drafts short and specific when the user asks for one; otherwise omit them.
- Avoid “research log” style output unless the user asks for it; summarize only the reproduction/detection evidence and root cause details that matter.
- Prefer compact bullets over paragraphs. Remove filler, hedging, and repeated context.
- If a section has nothing decision-relevant to add, omit it rather than writing placeholder text.

## Notes

- If the raw request is ambiguous, do not overfit the interpretation. Present 2–3 plausible interpretations and say what evidence would distinguish them.
- If the request mentions a public website, always inspect the site/page before asking basic implementation questions.
- Use basic facts discovered during research as internal working context; do not surface them in the final output unless they affect reproduction/detection or root cause.
- Questions for the user must be asked via `ask_user_question`, not written into the final markdown. If additional user context is needed after research/RCA, stop and use the tool before final output.
- Client-facing clarification questions may appear in the final output only as a ready-to-send message and only when the client uniquely has the evidence/approval.
- If network access, authentication, or tooling prevents investigation, say exactly what was attempted and what blocked it.
- If the request is actually product feedback or a feature request, capture the user problem and desired outcome before discussing implementation.
- If the request appears urgent or production-impacting, prioritize reproducing/detecting scope and immediate risk over exhaustive root-cause analysis.
