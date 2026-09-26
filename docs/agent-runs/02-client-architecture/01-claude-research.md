You are the primary engineering architect for Stage 2 of DoodleBee.

READ FIRST:

docs/Agents.md
docs/Design.md
docs/projectInfo.md
docs/01-information-architecture.md
docs/01-screen-state-map.md
docs/02-client-architecture.md

Also inspect the repository and existing code before making recommendations.

TASK:

Research and propose the production React Native + Expo client architecture for DoodleBee V1.

You must investigate:

1. Expo Router organization
2. feature/module folder structure
3. Zustand store boundaries
4. server/game state vs UI state
5. REST client architecture
6. WebSocket/Socket.IO client architecture
7. reconnect/session handling
8. drawing/canvas architecture
9. shared TypeScript domain/event types
10. React Hook Form + Zod usage
11. Reanimated integration
12. testing architecture
13. Expo/EAS compatibility
14. mobile performance implications

IMPORTANT:

Do not implement the application yet.

Do not introduce backend architecture.

Do not invent new product features.

Do not redesign Figma.

Do not add microservices.

Do not silently choose technologies where the PRD says they must be evaluated.

For every major decision provide:

- recommendation
- alternatives
- reason
- tradeoffs
- risks
- implementation impact

Pay particular attention to the drawing library because the PRD explicitly leaves it open for evaluation.

Inspect the actual repository before recommending a folder structure.

OUTPUT:

Create/update:

docs/agent-runs/02-client-architecture/01-claude-research.md

The document must contain:

- files inspected
- current repository findings
- proposed architecture
- folder structure
- navigation structure
- state ownership model
- realtime model
- drawing recommendation
- dependencies
- risks
- unresolved questions

Do not claim anything was tested unless it was actually tested.

At the end provide a concise implementation recommendation for Stage 2.