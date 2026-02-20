import { Euler, Vector3 } from 'three';
import type { Engine } from '../Engine';

const PI_2 = Math.PI / 2;
const MAX_PITCH = PI_2 - 0.01;

export class KeyboardCameraController {
    private keys = new Set<string>();
    private yaw = 0;
    private pitch = 0;
    private locked = false;

    private onKeyDown: (e: KeyboardEvent) => void;
    private onKeyUp: (e: KeyboardEvent) => void;
    private onMouseMove: (e: MouseEvent) => void;
    private onClick: () => void;
    private onLockChange: () => void;
    private unsubscribeFrame: () => void;
    private canvas: HTMLElement;

    moveSpeed = 5;
    mouseSensitivity = 0.002;

    constructor(engine: Engine) {
        this.canvas = engine.renderer.domElement;

        const cam = engine.camera;
        const euler = new Euler().setFromQuaternion(cam.quaternion, 'YXZ');
        this.yaw = euler.y;
        this.pitch = euler.x;

        this.onKeyDown = (e) => this.keys.add(e.code);
        this.onKeyUp = (e) => this.keys.delete(e.code);

        this.onMouseMove = (e) => {
            if (!this.locked) return;
            this.yaw -= e.movementX * this.mouseSensitivity;
            this.pitch -= e.movementY * this.mouseSensitivity;
            this.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch));
        };

        this.onClick = () => {
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

        this.unsubscribeFrame = engine.onFrame((delta) => {
            cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');

            cam.getWorldDirection(forward);
            forward.y = 0;
            forward.normalize();

            right.crossVectors(forward, cam.up).normalize();

            const speed = this.moveSpeed * delta;

            if (this.keys.has('KeyW')) cam.position.addScaledVector(forward, speed);
            if (this.keys.has('KeyS')) cam.position.addScaledVector(forward, -speed);
            if (this.keys.has('KeyA')) cam.position.addScaledVector(right, -speed);
            if (this.keys.has('KeyD')) cam.position.addScaledVector(right, speed);
        });
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
