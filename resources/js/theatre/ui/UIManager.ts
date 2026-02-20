import { Container, reversePainterSortStable } from '@pmndrs/uikit';
import type { Engine } from '../Engine';

export class UIManager {
    readonly root: Container;
    private unsubscribeFrame: () => void;

    constructor(engine: Engine) {
        engine.renderer.setTransparentSort(reversePainterSortStable);

        this.root = new Container({
            flexDirection: 'column',
            alignItems: 'flex-start',
            padding: 16,
            gap: 8,
        });

        engine.scene.add(this.root);

        this.unsubscribeFrame = engine.onFrame((delta) => this.root.update(delta));
    }

    dispose(): void {
        this.unsubscribeFrame();
        this.root.parent?.remove(this.root);
    }
}
