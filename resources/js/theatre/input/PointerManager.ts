import { forwardHtmlEvents } from '@pmndrs/pointer-events';
import type { Engine } from '../Engine';

export class PointerManager {
    private cleanup: { update: () => void; destroy: () => void };
    private unsubscribeFrame: () => void;

    constructor(engine: Engine) {
        this.cleanup = forwardHtmlEvents(
            engine.renderer.domElement,
            () => engine.camera,
            engine.scene,
        );

        this.unsubscribeFrame = engine.onFrame(() => this.cleanup.update());
    }

    dispose(): void {
        this.unsubscribeFrame();
        this.cleanup.destroy();
    }
}
