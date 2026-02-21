<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { Engine } from '@/theatre/Engine';
import { PointerManager } from '@/theatre/input/PointerManager';
import { UIManager } from '@/theatre/ui/UIManager';

const canvasRef = ref<HTMLCanvasElement>();

let engine: Engine;
let pointerManager: PointerManager;
let uiManager: UIManager;

onMounted(() => {
    if (!canvasRef.value) return;

    engine = new Engine();
    engine.mount(canvasRef.value);

    pointerManager = new PointerManager(engine);
    uiManager = new UIManager(engine);
});

onUnmounted(() => {
    uiManager?.dispose();
    pointerManager?.dispose();
    engine?.dispose();
});

defineExpose({
    get engine() {
        return engine;
    },
    get uiManager() {
        return uiManager;
    },
});
</script>

<template>
    <div class="h-full w-full">
        <canvas ref="canvasRef" />
    </div>
</template>
