import './processPolyfill';
// Must run before App (and Atlaskit) so duplicate gapcursor JSON IDs don't break editor-core import.
import './lib/patchProseMirrorSelection';
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { registerServiceWorker } from './pwa/registerServiceWorker'

registerServiceWorker()
createRoot(document.getElementById("root")!).render(<App />);
