# AI Agent

Status: **module shell only** — no domain logic implemented yet.

Source: `src/modules/ai-agent/ai-agent.module.ts`

```ts
@Module({
  imports: [CqrsModule],
  controllers: [],
  providers: [],
})
export class AiAgentModule {}
```

It is wired into `AppModule` but has no controllers, entities, repositories, or DTOs.

## Intended scope (per `CLAUDE.md`)

Act as a bridge/proxy connecting the frontend to an AI instance to assist users with design prompts. During development this is meant to interface with a **local** AI API — e.g. a local Ollama instance running Qwen — rather than a hosted third-party LLM API. None of this exists in code yet.

## Likely integration points, once built

- **Customizations** — design-prompt assistance would presumably feed into whatever the Customization Engine ends up doing with user-uploaded/generated designs (also currently unbuilt — see `docs/features/customizations.md`).
- The **Comments** module's `HttpCommentModerationAdapter` (`infrastructure/moderation/http-comment-moderation.adapter.ts`) is the closest existing precedent in this codebase for calling an external local/sibling service over HTTP with a timeout and explicit failure handling (never swallow, never guess) — worth reviewing before building the AI Agent's own HTTP client to a local Ollama instance.
- Following the established module layout, a real implementation should add `domain/`, `application/`, `infrastructure/`, `presentation/`, and `testing/` folders mirroring Catalog/Orders/Comments.
