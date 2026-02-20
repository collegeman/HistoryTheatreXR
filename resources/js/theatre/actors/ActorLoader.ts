import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import type { AnimationClip, Object3D } from 'three';
import { applyCelShading } from './CelShadingMaterial';

export interface BodyProfile {
    name: string;
    scale: number;
}

export interface LoadedActor {
    model: Object3D;
    clips: AnimationClip[];
}

const loader = new GLTFLoader();

export async function loadActorModel(
    url: string,
    profile?: BodyProfile,
): Promise<LoadedActor> {
    const gltf: GLTF = await loader.loadAsync(url);
    const model = gltf.scene;

    applyCelShading(model);

    if (profile) {
        const s = profile.scale;
        model.scale.set(s, s, s);
    }

    return { model, clips: gltf.animations };
}

export async function loadAnimationClips(url: string): Promise<AnimationClip[]> {
    const gltf: GLTF = await loader.loadAsync(url);
    return gltf.animations;
}
