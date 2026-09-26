# Stage 02 — Client Foundation Build Record

- **Agent:** Codex (Stage 02 Client Architecture BUILD WORKER)
- **Scope:** CLIENT FOUNDATION ONLY. No game logic, rooms, multiplayer, scoring,
  chat, drawing sync, auth, backend, realtime event contracts, API calls, or
  production screens.
- **Authority:** `04-architecture-decision.md` (ADR v2.0) + `decision.md`
  (D02-001 … D02-020).
- **Idempotency note:** an earlier agent had already written part of the
  foundation. This build inspected that state first, kept what was correct, and
  repaired what was broken rather than recreating the project.

---

## 1. Environment (verified)

| Item | Value |
|---|---|
| OS / shell | Windows, PowerShell 5.1.26100.9549 |
| Repo | `D:\doodlebee` |
| Git | branch `master`, **no commits yet** (all files untracked) |
| Node | v22.23.2 |
| npm | 10.9.8 |
| Java | 24.0.1 |
| Android SDK | `C:\Users\harsh\AppData\Local\Android\Sdk` (adb, emulator) |
| Emulator | `emulator-5554` — Pixel_6, Android 16 (API 36), x86_64 |
| Expo Go on device | 57.0.9 (versionCode 444) |

**Harness caveats (not project defects):**
- The sandboxed shell helper is broken; every command required escalation.
- `apply_patch` mangles its patch argument in this harness. Files were written
  with `[IO.File]::WriteAllText` using `UTF8Encoding($false)` and LF endings.
- The emulator is **shared** with another project's app
  (`com.krishibandhu.krishibandhu_ai`), which repeatedly stole foreground focus
  during the on-device check. Evidence was captured immediately after launching.

---

## 2. Expo SDK + Skia compatibility result

- `npx expo config --type prebuild --json` → `sdkVersion: "57.0.0"` (exit 0).
- `expo@57.0.25`, `react-native@0.86.3`, `react@19.2.3`, `expo-router@57.0.23`.

**Skia (ADR §14 / AD-004 / D-DEF-010)**

| Evidence | Result |
|---|---|
| `expo/bundledNativeModules.json` pin for `@shopify/react-native-skia` (SDK 57) | `2.6.2` (exact) |
| Installed version | `2.6.2` |
| `npx expo install --check` | "Dependencies are up to date" |
| `npx expo-doctor` | 21/21 |
| SDK 57 Skia doc frontmatter | `inExpoGo: true` |
| Expo Go 57.0.9 APK native libs | `lib/x86_64/librnskia.so` present |

**Result: the installed Skia version is SDK 57-compatible.** AD-004's
compatibility condition is satisfied, so the `react-native-svg` fallback is
**not** triggered.

**ADR correction found:** ADR §14 states Skia "Requires development build (not
Expo Go)". The SDK 57 documentation and the shipped Expo Go APK both contradict
this — Skia **is** bundled in Expo Go for SDK 57. This makes Skia *easier* to
adopt than the ADR assumes; the Architecture Lead should update the ADR text.

**Still open:** ADR §14's test requirement (test stroke on device, 60fps at 8
simultaneous viewers, <200ms propagation) was **not** run. AD-004 therefore
remains CONDITIONAL / UNDER_REVIEW, not LOCKED.

---

## 3. Commands executed (with exits)

| Command | Exit | Result |
|---|---|---|
| `npx expo install <pkg>` (multiple) | 0 | SDK-57-pinned versions installed |
| `npx tsc --noEmit` | 0 | 0 errors (strict) |
| `npx expo lint` | 0 | 0 errors, 0 warnings |
| `npx prettier --check .` | 0 | all files formatted |
| `npx jest` | 0 | 2 suites, 12 tests passed |
| `npx expo install --check` | 0 | dependencies up to date |
| `npx expo-doctor` | 0 | 21/21 checks passed |
| `npx expo config --type prebuild --json` | 0 | SDK 57.0.0 config valid |
| `npx expo export --platform android --no-minify` | 0 | 1245 modules → 2.7 MB Hermes bytecode |
| `npx expo start --android` (device run) | 0 | app loaded in Expo Go on emulator |

`expo export` wrote to `%TEMP%` and was deleted afterwards; no export artifacts
exist in the repo.

---

## 4. Files created / changed

**Configuration**
- `package.json` — name `doodlebee`, dep/devDep split, scripts
  (`start/android/ios/web/lint/lint:fix/format/format:check/typecheck/test/test:watch/doctor`),
  `jest.preset = jest-expo`.
- `app.json` — added `scheme: "doodlebee"`; added `expo-splash-screen` config
  plugin; removed schema-invalid `newArchEnabled` and legacy top-level `splash`.
- `tsconfig.json` — `strict`, `types: ["jest","node"]`, `@/*` → `src/*`.
- `eslint.config.js` — new flat config (Expo SDK 53+ requirement); `.eslintrc.js`
  deleted.
- `.prettierrc.js`, `.gitignore`, `.env.example`.
- `.prettierignore` - new; excludes hand-authored markdown (`*.md`, covering the
  locked ADR and the agent-run logs) and local tooling state (`.refact/`) so that
  `npm run format:check` is green and meaningful for code.

**Foundation (`src/`)**
- `src/types/index.ts` — public contract surface only (no Zod, no `secretWord`).
- `src/types/drawer-private.ts` — **new**; the only module that may carry
  `secretWord`; never re-exported from the public barrel.
- `src/validation/schemas.ts`, `src/validation/index.ts` — Zod foundation.
- `src/stores/game.store.ts` — `GameBaseState` / `GameBaseActions` /
  `GameBaseStore` / `createGameBaseSlice` / `createGameBaseStore` (no `secretWord`).
- `src/stores/drawer.store.ts` — drawer state **with** `secretWord`; not exported
  from the barrel.
- `src/stores/guesser.store.ts` — guesser state with **no** `secretWord`; plus
  `assertNoSecretWord` runtime guard; not exported from the barrel.
- `src/stores/index.ts` — barrel for session/connection/room/game-base/ui only.
- `src/stores/room.store.ts`, `session.store.ts`, `connection.store.ts`,
  `ui.store.ts` — five Zustand domain boundaries total.
- `src/api/client.ts` — fetch wrapper (`ApiError`, 15s `AbortController` timeout,
  optional Zod response validation). No endpoints.
- `src/config/env.ts` — safe env accessors + `isApiConfigured` / `isSocketConfigured`.
- `src/hooks/useZodForm.ts` — React Hook Form ↔ `zodResolver` bridge.
- `src/drawing/config.ts`, `src/drawing/index.ts` — ADR drawing constants.
- `src/utils/logger.ts` — redacts `secretWord`/`password`/`token`, masks nicknames.
- `src/theme/index.ts`, `src/theme/tokens.ts` — minimal design tokens.
- `src/components/.gitkeep`, `src/features/.gitkeep`, `src/domain/.gitkeep`.

**Routing (`app/`)**
- `app/_layout.tsx` — Expo Router Stack for the 9 approved routes.
- `app/(index)/index.tsx`, `app/nickname/index.tsx`, `app/create-room/index.tsx`,
  `app/join-room/index.tsx`, `app/settings/index.tsx` — placeholders.
- `app/lobby/[roomId].tsx`, `app/game/[roomId].tsx`,
  `app/round-result/[roomId].tsx`, `app/final-result/[roomId].tsx` — placeholders
  using `useLocalSearchParams`, redirecting to valid routes on a missing param.

**Tests**
- `__tests__/unit/secretWord.test.ts` — ADR §9.5 coverage.
- `__tests__/unit/validation.test.ts` — Zod bounds + compile-time contract checks.

---

## 5. Repairs made to pre-existing work

The earlier agent's foundation compiled but had real defects. All were verified
by running the toolchain, not by inspection alone.

1. **`useZodForm` generic mismatch** — `UseFormProps<TInput>` was incompatible
   with `UseFormReturn<TInput, unknown, TOutput>` (TS2345). Constrained
   `TOutput extends FieldValues` and threaded it through `UseFormProps`.
2. **Role stores hid their base actions (real bug)** — `DrawerStore`/`GuesserStore`
   were `…State & …Actions`, omitting `GameBaseActions`. The base actions existed
   at runtime (object spread) but were **absent from the type**, so
   `useGuesserGameStore.getState().setMaskedWord(...)` failed to compile. Object
   literals built with spread are exempt from excess-property checks, which is
   why this passed silently. Fixed by adding `GameBaseActions` to both store types.
   *Surfaced by the new test, not by inspection.*
3. **Stack screen names did not match real routes** — the device logged four
   `[Layout children]: No route named "…"` warnings for `lobby`, `game`,
   `round-result`, `final-result`. Directory-only routes resolve to the directory
   name, dynamic routes keep their `[param]` segment, so the names are now
   `lobby/[roomId]`, `game/[roomId]`, `round-result/[roomId]`, `final-result/[roomId]`.
4. **Secret-word test asserted a side effect that should not exist** — it expected
   setting the drawer's secret word to populate the *guesser's* `maskedWord`
   across stores. Rewritten to feed each store its own half of the split
   `drawer:selected` payload, which is the actual boundary being tested.
5. **Missing deep-link `scheme`** — the device warned `Linking requires a
   build-time setting 'scheme' … your app may crash`. Added `scheme: "doodlebee"`.
6. **Unused `eslint-disable` directive** in `src/utils/logger.ts` — removed.
7. **Formatting** — 58 Prettier violations resolved with `prettier --write`.

---

## 6. Dependency versions (installed, resolved)

Runtime: `expo@57.0.25`, `react@19.2.3`, `react-dom@19.2.3`,
`react-native@0.86.3`, `expo-router@57.0.23`, `expo-constants@57.0.19`,
`expo-linking@57.0.11`, `expo-splash-screen@57.0.9`, `expo-status-bar@57.0.1`,
`zustand@5.0.15`, `zod@4.6.5`, `react-hook-form@7.89.0`,
`@hookform/resolvers@5.9.1`, `socket.io-client@4.8.4`,
`react-native-reanimated@4.5.1`, `react-native-worklets@0.10.1`,
`@shopify/react-native-skia@2.6.2`,
`@react-native-async-storage/async-storage@2.2.0`,
`react-native-safe-area-context@5.7.0`, `react-native-screens@4.26.2`.

Dev: `typescript@6.0.3`, `eslint@9.39.5`, `eslint-config-expo@57.0.2`,
`prettier@3.9.9`, `eslint-config-prettier@10.1.8`,
`eslint-plugin-prettier@5.5.6`, `jest@29.7.0`, `jest-expo@57.0.5`,
`@types/jest@29.5.14`, `@types/node@26.6.3`, `@types/react@19.2.18`.

---

## 7. Validation results

| Check | Result |
|---|---|
| `npm install` / dependency resolution | ✅ clean |
| TypeScript (`tsc --noEmit`, strict) | ✅ 0 errors |
| ESLint (`expo lint`, flat config) | ✅ 0 errors, 0 warnings |
| Prettier (`--check .`) | ✅ all files formatted |
| Jest | ✅ 2 suites / 12 tests passed |
| `expo install --check` | ✅ up to date |
| `expo-doctor` | ✅ 21/21 |
| `expo config` (prebuild schema) | ✅ exit 0 |
| Metro bundle (Android export) | ✅ 1245 modules, 2.7 MB Hermes bytecode |
| Android device run | ✅ see §8 |
| `git status` | ✅ only project files; no `node_modules`/`.expo`/`.env.local`/temp artifacts |

---

## 8. Android result

**Device-free:** `npx expo export --platform android --no-minify` → exit 0,
1245 modules bundled into Hermes bytecode. Proves Metro + Babel
(`babel-preset-expo`, incl. the worklets plugin) + Expo Router route collection
all succeed.

**On device (emulator-5554, Android 16 / API 36, x86_64):**
- Expo Go 57.0.9 installed and matching (`runtimeVersion: exposdk:57.0.0`).
- `npx expo start --android` launched the experience; Metro bundled 1408 modules.
- `adb logcat` → `ReactNativeJS: Running "main"` with **no exceptions, no redbox**.
- Metro logged **zero** warnings on the reload after the fixes. Before the fixes
  the same point in the flow logged the missing-`scheme` warning plus four
  `No route named` warnings.
- `uiautomator dump` showed the React Native root view hierarchy mounted
  full-screen (`ViewGroup`/`ScrollView` at `[0,0][1080,2400]`) and **zero text
  nodes** — correct, because every Stage 02 screen placeholder returns `null`
  (screens are explicitly out of scope).
- **Not run:** full native Gradle build (`expo run:android` / `eas build`). No
  `android/` directory was generated, per AGENTS.md CNG rules and to avoid
  unrelated artifacts in the repo.
- No Skia rendering code exists yet (out of scope), so Skia was not exercised at
  runtime. Its availability in Expo Go was verified from the APK itself.

---

## 9. Secret-word isolation (ADR §9)

Enforced three independent ways:

1. **Separate stores** — `guesser.store.ts` has no `secretWord` field; the shared
   `game.store.ts` base slice has none either.
2. **Type separation** — `DrawerSelectedPayload` (with `secretWord`) lives in
   `src/types/drawer-private.ts`, which is never re-exported from
   `src/types/index.ts`. The public `PublicDrawerSelectedPayload` has no such key.
3. **Runtime + tests** — `assertNoSecretWord` throws on any guesser state exposing
   the field; `__tests__/unit/secretWord.test.ts` asserts the guesser state has no
   `secretWord`, `@ts-expect-error`-checks the accessor, provides a drawer positive
   control, and verifies logger redaction.

---

## 10. Warnings / known issues

1. **14 moderate `npm audit` advisories**, all transitive build/dev toolchain:
   `@expo/cli`, `@expo/config`, `@expo/config-plugins` → `xcode` → `uuid`, and
   `expo-router` → `query-string` → `decode-uri-component`. npm's suggested
   "fixes" are SDK **downgrades** (`expo@46`, `expo-router@5.1.11`) that would
   break SDK 57 — **not applied**. Unresolved; needs a decision before release.
2. **`react-native-gesture-handler@3.3.0`** is installed as a transitive
   dependency of `react-native-drawer-layout@4.2.10` (pulled in by
   `expo-router@57.0.23`), while SDK 57's `bundledNativeModules.json` pins
   `~2.32.0`. It is not a direct dependency, so `expo install --check` does not
   flag it. Expo Go 57.0.9 does ship `libgesturehandler.so`. Resolve before using
   gesture-handler directly.
3. Expo CLI prints `Warning: The 'NO_COLOR' env is ignored due to the
   'FORCE_COLOR' env being set` — harness artifact, not a project issue.
4. `adb -s emulator-5554 reverse --remove-all` failed once with
   `protocol fault (couldn't read status): connection reset`; succeeded on retry.

---

## 11. Deviations from the ADR (need Architecture Lead review)

1. `package.json` name changed `doodlebee-temp` → `doodlebee` (scaffold
   placeholder; matches the slug).
2. **Route file layout:** ADR §5 documents flat paths such as `app/(index).tsx`;
   the repo uses the directory form `app/(index)/index.tsx`. URLs resolve
   identically, but expo-router **route names** differ — this is what caused the
   `Stack.Screen` mismatch, and why the Stack now uses `lobby/[roomId]` form.
3. **`.eslintrc.js` → `eslint.config.js`**: Expo SDK 53+ requires flat config;
   the legacy file is unsupported by default.
4. **`devDependencies`:** `jest`, `jest-expo`, `@types/jest` were mis-filed into
   `dependencies` by the Expo CLI on Windows; moved to `devDependencies` and the
   lockfile re-synced.
5. **`app.json` schema:** removed `newArchEnabled` (no longer in the SDK 57
   schema; the new architecture is always on) and the legacy top-level `splash`
   key (replaced by the `expo-splash-screen` config plugin).
6. **Added `scheme: "doodlebee"`** — required to avoid a broken production
   deep-link build. **No approved document specifies a scheme**; the value is the
   conventional app slug. Confirm or override.
7. **`tsconfig.json` `include`** was rewritten by the Expo CLI to
   `["**/*.ts", "**/*.tsx"]`, dropping `.expo/types/**/*.ts` and
   `expo-env.d.ts`. Accepted as Expo-managed; it closes off typed routes unless
   re-added (see §12).
8. **Added `.prettierignore`** — `prettier --check .` failed on 22 files, all of
   them hand-authored documentation (`docs/`, `ProjectDocs/`) or `.refact/`
   tooling state, and all of them already failing before this build; none were
   code files. Rather than reflow the locked ADR and agent-run logs, markdown and
   `.refact/` are excluded from Prettier.
9. **Route directory conflict (needs a decision).** Root `AGENTS.md` states
   "Routes live in `src/app/`", but the locked ADR §5 documents `app/` and the
   repository already had `app/`. `app/` was kept, because the ADR is the
   authoritative document for this stage and moving routes would be an
   unrequested structural change. **One of the two must be corrected:** either
   update `AGENTS.md`, or move the route tree to `src/app/` in a later stage.
   (Both layouts are supported by Expo Router.)

---

## 12. Unresolved items / recommendations

1. **AD-004 stays CONDITIONAL** — the on-device performance test (60 fps, 8
   viewers, <200 ms) has not been run.
2. **`Room.status` intentionally not modelled** — listed in `projectInfo.md` §6
   but no approved document defines its values; omitted per the "DO NOT GUESS"
   rule and noted in `src/types/index.ts`.
3. **Typed routes evaluated and deferred** — `experiments.typedRoutes` (beta)
   would have caught the `Stack.Screen` route-name mismatch at compile time. It
   was not enabled because it requires `.expo/types` to be generated before CI
   typechecks (the docs' CI workaround) and re-adds an include that the Expo CLI
   just removed. Recommended for the UI stage. No route-typing safety exists today.
4. **`react-native-svg`** is not installed. It is only needed if the ADR's Skia
   fallback is ever triggered — which the compatibility result says it is not.
5. **Not implemented by design:** no game logic, no Socket.IO client instance, no
   realtime event contracts, no REST endpoints, no API calls, no fake APIs, no
   screens/UI, no design components, no bottom navigation.

---

## 13. Status

**Stage 02 client foundation: COMPLETE and VERIFIED.**
All 16 approved implementation items are delivered; typecheck, lint, format,
tests, dependency alignment, Expo diagnostics, config validation, Metro bundling
and an on-device Android run are green. Stage 03 has **not** been started.