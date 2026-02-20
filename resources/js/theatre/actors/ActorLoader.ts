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

export interface AnimationSource {
    model: Object3D;
    clips: AnimationClip[];
}

export async function loadAnimationSource(url: string): Promise<AnimationSource> {
    const gltf: GLTF = await loader.loadAsync(url);
    return { model: gltf.scene, clips: gltf.animations };
}
