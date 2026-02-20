import { AnimationMixer, type AnimationClip, type AnimationAction, type Object3D } from 'three';

export class ActorAnimator {
    readonly mixer: AnimationMixer;
    private actions = new Map<string, AnimationAction>();
    private current: AnimationAction | null = null;

    constructor(model: Object3D, clips: AnimationClip[]) {
        this.mixer = new AnimationMixer(model);
        this.addClips(clips);
    }

    addClip(clip: AnimationClip, name?: string): void {
        const key = name ?? clip.name;
        this.actions.set(key, this.mixer.clipAction(clip));
    }

    addClips(clips: AnimationClip[]): void {
        for (const clip of clips) {
            this.addClip(clip);
        }
    }

    get clipNames(): string[] {
        return [...this.actions.keys()];
    }

    play(name: string): void {
        const action = this.actions.get(name);
        if (!action) return;

        if (this.current === action) return;

        this.current?.stop();
        action.reset().play();
        this.current = action;
    }

    crossFadeTo(name: string, duration = 0.4): void {
        const next = this.actions.get(name);
        if (!next || this.current === next) return;

        next.reset().play();
        if (this.current) {
            this.current.crossFadeTo(next, duration, true);
        }
        this.current = next;
    }

    stop(): void {
        this.current?.stop();
        this.current = null;
    }

    update(delta: number): void {
        this.mixer.update(delta);
    }

    dispose(): void {
        this.mixer.stopAllAction();
    }
}
