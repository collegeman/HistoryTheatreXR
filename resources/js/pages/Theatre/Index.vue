<script setup lang="ts">
import { ref, shallowRef, onMounted } from 'vue';
import { Head } from '@inertiajs/vue3';
import TheatreCanvas from '@/components/TheatreCanvas.vue';
import { Actor } from '@/theatre/actors/Actor';
import { SilhouetteOutlinePass } from '@/theatre/effects/SilhouetteOutlinePass';
import {
    PlaneGeometry,
    MeshStandardMaterial,
    Mesh,
    DirectionalLight,
    AmbientLight,
    Color,
} from 'three';

const theatreRef = ref<InstanceType<typeof TheatreCanvas>>();
const actors = shallowRef<Actor[]>([]);
const actorClips = ref<string[]>([]);
const activeClip = ref('');

async function setupScene() {
    const { engine } = theatreRef.value!;
    const { scene } = engine;

    scene.background = new Color(0x1a1a2e);

    // Lighting
    const ambient = new AmbientLight(0xffffff, 0.3);
    scene.add(ambient);

    const directional = new DirectionalLight(0xffffff, 1.2);
    directional.position.set(5, 10, 5);
    scene.add(directional);

    // Stage floor
    const floor = new Mesh(
        new PlaneGeometry(20, 20),
        new MeshStandardMaterial({ color: 0x2a2a3e }),
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const actor = await Actor.load('/models/actors/tall-adult.glb');
    actor.normalizeHeight(1.6);
    actor.addToScene(scene);
    actor.setPosition(0, 0, 0);
    actors.value = [actor];

    const { clientWidth: w, clientHeight: h } = engine.renderer.domElement;
    const outlinePass = new SilhouetteOutlinePass(scene, engine.camera, w, h);
    outlinePass.lineWidth = 2.0;
    outlinePass.addTarget(actor.object3D);
    engine.addPass(outlinePass);

    engine.onFrame((delta) => {
        for (const actor of actors.value) {
            actor.update(delta);
        }
    });

    actorClips.value = actor.clipNames.sort();

    const idleClip = actorClips.value.find(
        (n) => n.toLowerCase().includes('idle'),
    );
    if (idleClip) {
        playAll(idleClip);
    }
}

function playAll(clipName: string) {
    activeClip.value = clipName;
    for (const actor of actors.value) {
        actor.crossFadeTo(clipName);
    }
}

onMounted(() => {
    setupScene();
});
</script>

<template>
    <Head title="Theatre" />

    <div class="relative h-screen w-screen overflow-hidden">
        <TheatreCanvas ref="theatreRef" />

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
                @click="playAll(clip)"
            >
                {{ clip }}
            </button>
        </div>
    </div>
</template>
