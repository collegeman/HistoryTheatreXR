import {
    MeshToonMaterial,
    DataTexture,
    NearestFilter,
    type Object3D,
    type Mesh,
} from 'three';

const TOON_COLOR = 0x8888aa;
const TONE_STEPS = 3;

function createGradientMap(steps: number): DataTexture {
    const size = steps;
    const data = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
        data[i] = Math.round((255 * (i + 1)) / size);
    }
    const texture = new DataTexture(data, size, 1);
    texture.minFilter = NearestFilter;
    texture.magFilter = NearestFilter;
    texture.needsUpdate = true;
    return texture;
}

const gradientMap = createGradientMap(TONE_STEPS);

const toonMaterial = new MeshToonMaterial({
    color: TOON_COLOR,
    gradientMap,
});

export function applyCelShading(root: Object3D): void {
    root.traverse((child) => {
        if ((child as Mesh).isMesh) {
            (child as Mesh).material = toonMaterial;
        }
    });
}
