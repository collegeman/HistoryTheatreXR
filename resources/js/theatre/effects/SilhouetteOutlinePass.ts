import {
    WebGLRenderTarget,
    ShaderMaterial,
    MeshBasicMaterial,
    Color,
    type Object3D,
    type Scene,
    type Camera,
    type WebGLRenderer,
} from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const maskMaterial = new MeshBasicMaterial({ color: 0xffffff });
const maskBackground = new Color(0x000000);

export class SilhouetteOutlinePass extends Pass {
    private maskTarget: WebGLRenderTarget;
    private edgeQuad: FullScreenQuad;
    private scene: Scene;
    private camera: Camera;
    private outlineTargets: Object3D[] = [];

    lineColor = new Color(0x000000);
    lineWidth = 1.5;

    constructor(
        scene: Scene,
        camera: Camera,
        width: number,
        height: number,
    ) {
        super();
        this.scene = scene;
        this.camera = camera;

        this.maskTarget = new WebGLRenderTarget(width, height);

        this.edgeQuad = new FullScreenQuad(
            new ShaderMaterial({
                uniforms: {
                    tDiffuse: { value: null },
                    tMask: { value: this.maskTarget.texture },
                    resolution: { value: [width, height] },
                    lineColor: { value: this.lineColor },
                    lineWidth: { value: this.lineWidth },
                },
                vertexShader: /* glsl */ `
                    varying vec2 vUv;
                    void main() {
                        vUv = uv;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }
                `,
                fragmentShader: /* glsl */ `
                    uniform sampler2D tDiffuse;
                    uniform sampler2D tMask;
                    uniform vec2 resolution;
                    uniform vec3 lineColor;
                    uniform float lineWidth;

                    varying vec2 vUv;

                    void main() {
                        vec4 sceneColor = texture2D(tDiffuse, vUv);
                        vec2 texel = lineWidth / resolution;

                        // Sample the mask in a cross pattern for edge detection
                        float center = texture2D(tMask, vUv).r;
                        float top    = texture2D(tMask, vUv + vec2(0.0,  texel.y)).r;
                        float bottom = texture2D(tMask, vUv + vec2(0.0, -texel.y)).r;
                        float left   = texture2D(tMask, vUv + vec2(-texel.x, 0.0)).r;
                        float right  = texture2D(tMask, vUv + vec2( texel.x, 0.0)).r;

                        float edge = abs(top - bottom) + abs(left - right);
                        edge = clamp(edge, 0.0, 1.0);

                        gl_FragColor = mix(sceneColor, vec4(lineColor, 1.0), edge);
                    }
                `,
            }),
        );
    }

    addTarget(object: Object3D): void {
        this.outlineTargets.push(object);
    }

    removeTarget(object: Object3D): void {
        const idx = this.outlineTargets.indexOf(object);
        if (idx !== -1) this.outlineTargets.splice(idx, 1);
    }

    setSize(width: number, height: number): void {
        this.maskTarget.setSize(width, height);
        const material = this.edgeQuad.material as ShaderMaterial;
        material.uniforms.resolution.value = [width, height];
    }

    render(
        renderer: WebGLRenderer,
        writeBuffer: WebGLRenderTarget,
        readBuffer: WebGLRenderTarget,
    ): void {
        const material = this.edgeQuad.material as ShaderMaterial;
        material.uniforms.lineWidth.value = this.lineWidth;

        // Render mask: outlined objects as white on black
        const savedBackground = this.scene.background;
        const savedOverride = this.scene.overrideMaterial;
        const visibility = new Map<Object3D, boolean>();

        this.scene.traverse((obj) => {
            visibility.set(obj, obj.visible);
            obj.visible = false;
        });

        // Show only outline targets and their descendants
        for (const target of this.outlineTargets) {
            target.traverse((obj) => {
                obj.visible = visibility.get(obj) ?? true;
            });
        }

        this.scene.visible = true;
        this.scene.background = maskBackground;
        this.scene.overrideMaterial = maskMaterial;

        renderer.setRenderTarget(this.maskTarget);
        renderer.render(this.scene, this.camera);

        // Restore visibility
        for (const [obj, vis] of visibility) {
            obj.visible = vis;
        }
        this.scene.background = savedBackground;
        this.scene.overrideMaterial = savedOverride;

        // Edge detection + composite
        material.uniforms.tDiffuse.value = readBuffer.texture;
        material.uniforms.tMask.value = this.maskTarget.texture;

        if (this.renderToScreen) {
            renderer.setRenderTarget(null);
        } else {
            renderer.setRenderTarget(writeBuffer);
        }

        this.edgeQuad.render(renderer);
    }

    dispose(): void {
        this.maskTarget.dispose();
        (this.edgeQuad.material as ShaderMaterial).dispose();
        this.edgeQuad.dispose();
    }
}
