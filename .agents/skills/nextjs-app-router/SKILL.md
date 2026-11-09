---
name: nextjs-app-router
description: Next.js 14/15 App Router architecture, Server Components by default, optimistic mutations, metadata streaming, and boundary isolation.
---

# Next.js App Router Architecture Skill

## Architectural Commandments
1. **Server Components Default**: Default to React Server Components (`RSC`). Add `'use client'` only on interactive leaf nodes containing state, event handlers, or browser APIs.
2. **Streaming & Suspense**: Wrap asynchronous data boundaries in `<Suspense fallback={<Skeleton />}>` to avoid blocking SSR waterfalls.
3. **Route Handlers**: Implement API logic in `app/api/.../route.ts` with typed Request and Response models, Zod validation, and structured error payloads.
4. **Zero Untyped Props**: All component props, route parameters (`params`, `searchParams`), and server actions must be typed with strict TypeScript interfaces.

