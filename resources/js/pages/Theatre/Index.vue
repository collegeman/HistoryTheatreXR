<script setup lang="ts">
import { ref, shallowRef, onMounted, onUnmounted } from 'vue';
import { Head } from '@inertiajs/vue3';
import TheatreCanvas from '@/components/TheatreCanvas.vue';
import { Actor } from '@/theatre/actors/Actor';
import { UAL_TO_MIXAMO, type BoneMap } from '@/theatre/actors/AnimationRetargeter';
import { SilhouetteOutlinePass } from '@/theatre/effects/SilhouetteOutlinePass';
import { KeyboardCameraController } from '@/theatre/input/KeyboardCameraController';
import { ThirdPersonController } from '@/theatre/input/ThirdPersonController';
import type { Engine } from '@/theatre/Engine';
import {
    PlaneGeometry,
    MeshStandardMaterial,
    Mesh,
    DirectionalLight,
    AmbientLight,
    Color,
} from 'three';

interface ModelOption {
    label: string;
    url: string;
    boneMap?: BoneMap;
}

const models: ModelOption[] = [
    { label: 'Xbot', url: '/models/actors/child.glb', boneMap: UAL_TO_MIXAMO },
    { label: 'Michelle', url: '/models/actors/tall-adult.glb', boneMap: UAL_TO_MIXAMO },
    { label: 'Mannequin', url: '/models/actors/humanoid.glb' },
];

type LocomotionMode = 'camera' | 'character';

const theatreRef = ref<InstanceType<typeof TheatreCanvas>>();
const actor = shallowRef<Actor | null>(null);
const actorClips = ref<string[]>([]);
const activeClip = ref('');
const activeModel = ref('');
const loadingModel = ref(false);
const locomotionMode = ref<LocomotionMode>('camera');

let engine: Engine;
let outlinePass: SilhouetteOutlinePass;
let cameraController: KeyboardCameraController;
let thirdPersonController: ThirdPersonController;

function setLocomotionMode(mode: LocomotionMode) {
    if (mode === locomotionMode.value) return;
    if (!cameraController || !thirdPersonController) return;
    locomotionMode.value = mode;

    if (mode === 'camera') {
        thirdPersonController.setEnabled(false);
        cameraController.syncFromCamera();
        cameraController.setEnabled(true);
    } else {
        cameraController.setEnabled(false);
        thirdPersonController.setEnabled(true);
    }
}

async function setupScene() {
    engine = theatreRef.value!.engine;
    const { scene } = engine;

    scene.background = new Color(0x1a1a2e);

    const ambient = new AmbientLight(0xffffff, 0.3);
    scene.add(ambient);

    const directional = new DirectionalLight(0xffffff, 1.2);
    directional.position.set(5, 10, 5);
    scene.add(directional);

    const floor = new Mesh(
        new PlaneGeometry(20, 20),
        new MeshStandardMaterial({ color: 0x2a2a3e }),
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const { clientWidth: w, clientHeight: h } = engine.renderer.domElement;
    outlinePass = new SilhouetteOutlinePass(scene, engine.camera, w, h);
    outlinePass.lineWidth = 2.0;
    engine.addPass(outlinePass);

    engine.onFrame((delta) => {
        actor.value?.update(delta);
    });

    await switchModel(models[0]);

    // Create controllers after first actor is loaded
    cameraController = new KeyboardCameraController(engine);
    thirdPersonController = new ThirdPersonController(engine, actor.value!);
    // Third person starts disabled; free camera is the default
}

async function switchModel(model: ModelOption) {
    if (loadingModel.value) return;
    loadingModel.value = true;

    try {
        const prev = actor.value;
        if (prev) {
            outlinePass.removeTarget(prev.object3D);
            prev.dispose();
        }

        const next = await Actor.load(model.url);
        if (model.boneMap) {
            await next.loadAnimations('/models/actors/humanoid.glb', model.boneMap);
        }
        next.normalizeHeight(1.6);
        next.addToScene(engine.scene);
        next.setPosition(0, 0, 0);
        outlinePass.addTarget(next.object3D);

        actor.value = next;
        activeModel.value = model.label;
        actorClips.value = next.clipNames.sort();

        const clipToPlay =
            actorClips.value.find((n) => n === activeClip.value) ??
            actorClips.value.find((n) => n.toLowerCase().includes('idle')) ??
            actorClips.value[0];

        if (clipToPlay) {
            activeClip.value = clipToPlay;
            next.crossFadeTo(clipToPlay);
        }

        thirdPersonController?.setActor(next);
    } finally {
        loadingModel.value = false;
    }
}

function playClip(clipName: string) {
    activeClip.value = clipName;
    actor.value?.crossFadeTo(clipName);
}

onMounted(() => {
    setupScene();
});

onUnmounted(() => {
    thirdPersonController?.dispose();
    cameraController?.dispose();
});
</script>

<template>
    <Head title="Theatre" />

    <div class="relative h-screen w-screen overflow-hidden">
        <TheatreCanvas ref="theatreRef" />

        <!-- Model selector (upper left) -->
        <div
            class="absolute left-4 top-4 flex flex-col gap-1 rounded-lg bg-black/60 p-2 backdrop-blur-sm"
        >
            <span class="px-2 pb-1 text-xs font-semibold uppercase tracking-wider text-white/50">
                Model
            </span>
            <button
                v-for="model in models"
                :key="model.label"
                :disabled="loadingModel"
                class="rounded px-3 py-1.5 text-left text-sm font-medium text-white transition-colors disabled:opacity-40"
                :class="
                    activeModel === model.label
                        ? 'bg-indigo-600'
                        : 'hover:bg-white/20'
                "
                @click="switchModel(model)"
            >
                {{ model.label }}
            </button>
        </div>

        <!-- Camera mode toggle (lower left) -->
        <div
            class="absolute bottom-4 left-4 flex flex-col gap-1 rounded-lg bg-black/60 p-2 backdrop-blur-sm"
        >
            <span class="px-2 pb-1 text-xs font-semibold uppercase tracking-wider text-white/50">
                Camera
            </span>
            <button
                class="rounded px-3 py-1.5 text-left text-sm font-medium text-white transition-colors"
                :class="
                    locomotionMode === 'camera'
                        ? 'bg-indigo-600'
                        : 'hover:bg-white/20'
                "
                @click="setLocomotionMode('camera')"
            >
                Free Camera
            </button>
            <button
                class="rounded px-3 py-1.5 text-left text-sm font-medium text-white transition-colors"
                :class="
                    locomotionMode === 'character'
                        ? 'bg-indigo-600'
                        : 'hover:bg-white/20'
                "
                @click="setLocomotionMode('character')"
            >
                Third Person
            </button>
        </div>

        <!-- Animation selector (right) -->
        <div
            v-if="actorClips.length > 0"
            class="absolute right-4 top-4 flex max-h-[calc(100vh-2rem)] flex-col overflow-y-auto rounded-lg bg-black/60 p-2 backdrop-blur-sm"
        >
            <button
                v-for="clip in actorClips"
                :key="clip"
                class="rounded px-3 py-1.5 text-left text-sm font-medium text-white transition-colors"
                :class="
                    activeClip === clip
                        ? 'bg-indigo-600'
                        : 'hover:bg-white/20'
                "
                @click="playClip(clip)"
            >
                {{ clip }}
            </button>
        </div>
    </div>
</template>
