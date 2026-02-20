import { MeshBasicMaterial, type Object3D, type Mesh } from 'three';

const silhouetteMaterial = new MeshBasicMaterial({ color: 0x000000 });

export function applySilhouette(root: Object3D): void {
    root.traverse((child) => {
        if ((child as Mesh).isMesh) {
            (child as Mesh).material = silhouetteMaterial;
        }
    });
}
