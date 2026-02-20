import {
    WebGLRenderer,
    PerspectiveCamera,
    Scene,
    Clock,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { Pass } from 'three/addons/postprocessing/Pass.js';

export type FrameCallback = (delta: number, elapsed: number) => void;

export class Engine {
    readonly renderer: WebGLRenderer;
    readonly camera: PerspectiveCamera;
    readonly scene: Scene;
    readonly composer: EffectComposer;

    private outputPass: OutputPass;
    private clock = new Clock();
    private frameCallbacks: Set<FrameCallback> = new Set();
    private resizeObserver: ResizeObserver | null = null;

    constructor() {
        this.scene = new Scene();

        this.camera = new PerspectiveCamera(60, 1, 0.1, 1000);
        this.camera.position.set(0, 1.5, 5);

        this.renderer = new WebGLRenderer({ antialias: true });
        this.renderer.localClippingEnabled = true;
        this.renderer.setPixelRatio(window.devicePixelRatio);

        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));

        this.outputPass = new OutputPass();
        this.composer.addPass(this.outputPass);
    }

    addPass(pass: Pass): void {
        this.composer.insertPass(pass, this.composer.passes.length - 1);
    }

    mount(canvas: HTMLCanvasElement): void {
        const parent = canvas.parentElement;
        if (!parent) return;

        parent.replaceChild(this.renderer.domElement, canvas);

        this.resize();

        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(parent);

        this.clock.start();
        this.renderer.setAnimationLoop(() => this.tick());
    }

    dispose(): void {
        this.renderer.setAnimationLoop(null);
        this.resizeObserver?.disconnect();
        this.composer.dispose();
        this.renderer.dispose();
        this.frameCallbacks.clear();
    }

    onFrame(callback: FrameCallback): () => void {
        this.frameCallbacks.add(callback);
        return () => this.frameCallbacks.delete(callback);
    }

    private tick(): void {
        const delta = this.clock.getDelta();
        const elapsed = this.clock.getElapsedTime();

        for (const cb of this.frameCallbacks) {
            cb(delta, elapsed);
        }

        this.composer.render(delta);
    }

    private resize(): void {
        const parent = this.renderer.domElement.parentElement;
        if (!parent) return;

        const { clientWidth: w, clientHeight: h } = parent;
        this.renderer.setSize(w, h);
        this.composer.setSize(w, h);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
    }
}
