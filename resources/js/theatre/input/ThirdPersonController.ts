import { Vector3 } from 'three';
import type { Engine } from '../Engine';
import type { Actor } from '../actors/Actor';

const PI_2 = Math.PI / 2;
const MAX_PITCH = PI_2 - 0.15;
const MIN_PITCH = -0.3;

function lerpAngle(a: number, b: number, t: number): number {
    let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * t;
}

function findClip(names: string[], ...keywords: string[]): string | undefined {
    const lower = names.map((n) => n.toLowerCase());
    for (const kw of keywords) {
        const exact = lower.indexOf(kw);
        if (exact !== -1) return names[exact];
    }
    for (const kw of keywords) {
        const partial = lower.findIndex((n) => n.includes(kw));
        if (partial !== -1) return names[partial];
    }
    return undefined;
}

export class ThirdPersonController {
    private engine: Engine;
    private actor: Actor;
    private keys = new Set<string>();
    private orbitYaw = Math.PI;
    private orbitPitch = 0.3;
    private locked = false;
    private _enabled = false;
    private gait: 'idle' | 'walk' | 'run' = 'idle';

    private idleClip: string | undefined;
    private walkClip: string | undefined;
    private runClip: string | undefined;

    private onKeyDown: (e: KeyboardEvent) => void;
    private onKeyUp: (e: KeyboardEvent) => void;
    private onMouseMove: (e: MouseEvent) => void;
    private onClick: () => void;
    private onLockChange: () => void;
    private unsubscribeFrame: () => void;
    private canvas: HTMLElement;

    moveSpeed = 3;
    runSpeed = 6;
    followDistance = 4;
    followHeight = 2;
    followLerp = 5;
    turnLerp = 10;
    mouseSensitivity = 0.003;

    constructor(engine: Engine, actor: Actor) {
        this.engine = engine;
        this.actor = actor;
        this.canvas = engine.renderer.domElement;

        this.resolveClips();

        this.onKeyDown = (e) => {
            if (!this._enabled) return;
            this.keys.add(e.code);
        };
        this.onKeyUp = (e) => this.keys.delete(e.code);

        this.onMouseMove = (e) => {
            if (!this._enabled || !this.locked) return;
            this.orbitYaw -= e.movementX * this.mouseSensitivity;
            this.orbitPitch += e.movementY * this.mouseSensitivity;
            this.orbitPitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, this.orbitPitch));
        };

        this.onClick = () => {
            if (!this._enabled) return;
            if (!this.locked) {
                this.canvas.requestPointerLock();
            }
        };

        this.onLockChange = () => {
            this.locked = document.pointerLockElement === this.canvas;
        };

        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('pointerlockchange', this.onLockChange);
        this.canvas.addEventListener('click', this.onClick);

        const forward = new Vector3();
        const right = new Vector3();
        const moveDir = new Vector3();
        const desiredCamPos = new Vector3();
        const cam = engine.camera;

        this.unsubscribeFrame = engine.onFrame((delta) => {
            if (!this._enabled) return;

            const actorPos = this.actor.object3D.position;

            forward.set(-Math.sin(this.orbitYaw), 0, -Math.cos(this.orbitYaw));
            right.crossVectors(forward, cam.up).normalize();

            moveDir.set(0, 0, 0);
            if (this.keys.has('KeyW')) moveDir.add(forward);
            if (this.keys.has('KeyS')) moveDir.sub(forward);
            if (this.keys.has('KeyA')) moveDir.sub(right);
            if (this.keys.has('KeyD')) moveDir.add(right);

            const isMoving = moveDir.lengthSq() > 0.001;
            const sprinting = isMoving && (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'));
            const nextGait: 'idle' | 'walk' | 'run' = !isMoving ? 'idle' : sprinting ? 'run' : 'walk';

            if (isMoving) {
                moveDir.normalize();
                const speed = sprinting ? this.runSpeed : this.moveSpeed;
                actorPos.addScaledVector(moveDir, speed * delta);

                const targetYaw = Math.atan2(moveDir.x, moveDir.z);
                const t = 1 - Math.exp(-this.turnLerp * delta);
                this.actor.object3D.rotation.y = lerpAngle(
                    this.actor.object3D.rotation.y,
                    targetYaw,
                    t,
                );
            }

            if (nextGait !== this.gait) {
                this.gait = nextGait;
                const clip = nextGait === 'run' ? this.runClip
                    : nextGait === 'walk' ? this.walkClip
                    : this.idleClip;
                if (clip) this.actor.crossFadeTo(clip);
            }

            const smoothT = 1 - Math.exp(-this.followLerp * delta);

            desiredCamPos.set(
                actorPos.x + Math.sin(this.orbitYaw) * Math.cos(this.orbitPitch) * this.followDistance,
                actorPos.y + this.followHeight + Math.sin(this.orbitPitch) * this.followDistance,
                actorPos.z + Math.cos(this.orbitYaw) * Math.cos(this.orbitPitch) * this.followDistance,
            );

            cam.position.lerp(desiredCamPos, smoothT);
            cam.lookAt(actorPos.x, actorPos.y + this.followHeight * 0.5, actorPos.z);
        });
    }

    get enabled(): boolean {
        return this._enabled;
    }

    setEnabled(value: boolean): void {
        this._enabled = value;
        if (value) {
            this.gait = 'idle';
            if (this.idleClip) this.actor.crossFadeTo(this.idleClip);
            return;
        }
        this.keys.clear();
        if (this.gait !== 'idle') {
            this.gait = 'idle';
            if (this.idleClip) this.actor.crossFadeTo(this.idleClip);
        }
        if (this.locked) document.exitPointerLock();
    }

    setActor(newActor: Actor): void {
        this.actor = newActor;
        this.resolveClips();
        this.gait = 'idle';
    }

    private resolveClips(): void {
        const names = this.actor.clipNames;
        this.idleClip = findClip(names, 'idle_loop', 'idle');
        this.walkClip = findClip(names, 'walk_loop', 'walking', 'walk');
        this.runClip = findClip(names, 'sprint_loop', 'run_loop', 'sprint', 'running', 'run');
    }

    dispose(): void {
        this.unsubscribeFrame();
        if (this.locked) document.exitPointerLock();
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('pointerlockchange', this.onLockChange);
        this.canvas.removeEventListener('click', this.onClick);
    }
}
