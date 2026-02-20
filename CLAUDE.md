# HistoryTheatreXR

WebXR project that teaches history through virtual theatre. Built up one component prototype at a time, with Claude generating the XR experiences.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Backend | Laravel 12 (Vue/Inertia starter kit via `laravel/vue-starter-kit`) |
| Frontend | Vue 3 + Inertia 2 + TypeScript |
| 3D engine | Three.js (vanilla, no React) |
| 3D UI | `@pmndrs/uikit` (vanilla core) |
| Pointer events | `@pmndrs/pointer-events` |
| Build | Vite 7 (Laravel integration) |
| Styling | Tailwind CSS 4 + shadcn-vue (reka-ui) |
| Target | Desktop/mobile first, WebXR later |

## Project Structure (custom code)

```
resources/js/
├── theatre/                    # Plain TypeScript engine (not Vue-specific)
│   ├── Engine.ts               # WebGLRenderer + EffectComposer + scene + camera + animation loop
│   ├── actors/
│   │   ├── Actor.ts            # Facade: load model, animate, position, load extra animations
│   │   ├── ActorAnimator.ts    # AnimationMixer wrapper: play, crossFadeTo, addClip(s)
│   │   ├── ActorLoader.ts      # GLTFLoader: loadActorModel() + loadAnimationClips()
│   │   ├── CelShadingMaterial.ts   # MeshToonMaterial with stepped gradient map
│   │   └── SilhouetteMaterial.ts   # Flat black MeshBasicMaterial (legacy, unused)
│   ├── effects/
│   │   └── SilhouetteOutlinePass.ts  # Post-processing: screen-space silhouette contour
│   ├── input/
│   │   ├── KeyboardCameraController.ts  # WASD move + arrow key look
│   │   └── PointerManager.ts           # @pmndrs/pointer-events bridge
│   └── ui/
│       └── UIManager.ts        # @pmndrs/uikit Container root
├── components/
│   └── TheatreCanvas.vue       # Mounts Engine into a <canvas>, wires up all subsystems
└── pages/
    └── Theatre/
        └── Index.vue           # Demo scene: loads actor, stage, lighting, animation UI

public/models/actors/           # GLB files (gitignored, downloaded via artisan command)
├── tall-adult.glb              # Three.js Soldier (humanoid, 4 clips: TPose/Idle/Walk/Run)
├── stocky-adult.glb            # Three.js RobotExpressive (robot, 12+ clips)
└── child.glb                   # Three.js Xbot (Mixamo rig)

app/Console/Commands/
└── DownloadModels.php          # `php artisan models:download` — fetches sample GLBs

routes/web.php                  # /theatre route renders Theatre/Index
```

## Architecture Decisions

- **Theatre engine is framework-agnostic.** Everything under `resources/js/theatre/` is plain TypeScript with zero Vue imports. Vue components mount it via `Engine.mount(canvas)`.
- **EffectComposer pipeline.** Engine renders through Three.js EffectComposer (RenderPass → custom passes → OutputPass). Use `engine.addPass()` to insert passes before output.
- **Actors own their animations.** `Actor.loadAnimations(url)` loads clips from separate GLB files (Mixamo workflow). `Actor.addClip(clip)` accepts programmatic AnimationClips.
- **Cel shading + silhouette outline.** Two independent systems: `CelShadingMaterial` applies MeshToonMaterial to meshes; `SilhouetteOutlinePass` does screen-space edge detection on a mask render for outer-contour-only outlines.
- **shallowRef for Three.js objects in Vue.** Never use `ref()` for Three.js objects — Vue's deep reactivity proxies break them. Always `shallowRef`.
- **Frame callback cleanup.** `engine.onFrame()` returns an unsubscribe function. All subsystems store and call it in their `dispose()`.

## Getting Started

```bash
composer install
npm install
php artisan models:download   # Downloads sample GLB actor models
cp .env.example .env
php artisan key:generate
touch database/database.sqlite
php artisan migrate
```

Run dev server:
```bash
# Terminal 1
php artisan serve
# Terminal 2
npm run dev
```

Visit `http://localhost:8000/theatre`

## Current Prototype Status

First prototype: loading and animating a humanoid actor with cel shading.

**Working:**
- Engine mounts, renders, resizes
- GLB actor loading with cel shading material
- Height normalization for different model scales
- Animation playback with crossfade transitions
- Screen-space silhouette outline post-processing
- WASD + arrow key camera controls
- Animation clip selector UI (vertical list panel)
- Loading additional animation clips from separate GLB files

**Next steps:**
- Swap to a model with more animations (Stacy GLB has 10, or bundle Mixamo animations)
- Programmatic animation creation (build clips in code)
- @pmndrs/uikit 3D UI panels (currently set up but not used in demo scene)
- Stage/environment design
- Multiple actors on stage
- WebXR session support

## Conventions

- DO NOT run `npm run build` for testing — use `npm run dev` (Vite HMR)
- GLB model files are gitignored; use `php artisan models:download` to fetch them
- The `@/*` path alias maps to `resources/js/*`
- Wayfinder auto-generates `resources/js/routes/` and `resources/js/actions/` (both gitignored)
