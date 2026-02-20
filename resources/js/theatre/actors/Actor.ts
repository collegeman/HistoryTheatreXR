import { Box3, Vector3, type AnimationClip, type Scene, type Object3D } from 'three';
import { loadActorModel, loadAnimationSource, type BodyProfile } from './ActorLoader';
import { ActorAnimator } from './ActorAnimator';
import { retargetClips, type BoneMap } from './AnimationRetargeter';

export class Actor {
    private animator!: ActorAnimator;
    private model!: Object3D;

    private constructor() {}

    static async load(modelUrl: string, profile?: BodyProfile): Promise<Actor> {
        const actor = new Actor();
        const { model, clips } = await loadActorModel(modelUrl, profile);
        actor.model = model;
        actor.animator = new ActorAnimator(model, clips);
        return actor;
    }

    get clipNames(): string[] {
        return this.animator.clipNames;
    }

    get object3D(): Object3D {
        return this.model;
    }

    addToScene(scene: Scene): void {
        scene.add(this.model);
    }

    removeFromScene(): void {
        this.model.parent?.remove(this.model);
    }

    async loadAnimations(url: string, boneMap?: BoneMap): Promise<string[]> {
        const { model: sourceModel, clips: sourceClips } = await loadAnimationSource(url);
        let clips = sourceClips;
        if (boneMap) {
            clips = retargetClips(clips, boneMap, sourceModel, this.model);
        }
        this.animator.addClips(clips);
        return clips.map((c) => c.name);
    }

    addClip(clip: AnimationClip, name?: string): void {
        this.animator.addClip(clip, name);
    }

    play(name: string): void {
        this.animator.play(name);
    }

    crossFadeTo(name: string, duration?: number): void {
        this.animator.crossFadeTo(name, duration);
    }

    stop(): void {
        this.animator.stop();
    }

    normalizeHeight(targetHeight: number): void {
        const box = new Box3().setFromObject(this.model);
        const size = new Vector3();
        box.getSize(size);

        if (size.y > 0) {
            const scale = targetHeight / size.y;
            this.model.scale.multiplyScalar(scale);
        }
    }

    setPosition(x: number, y: number, z: number): void {
        this.model.position.set(x, y, z);
    }

    setRotation(y: number): void {
        this.model.rotation.y = y;
    }

    update(delta: number): void {
        this.animator.update(delta);
    }

    dispose(): void {
        this.animator.dispose();
        this.removeFromScene();
    }
}
