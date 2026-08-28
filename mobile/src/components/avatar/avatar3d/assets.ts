import { Asset } from 'expo-asset';

/**
 * Resolves the local URIs of the 3D avatar's assets.
 *
 * Both are optional. The app ships and runs without them — `Avatar3D` reports
 * itself unavailable and `AvatarStage` shows the farmer photograph, which is
 * what Phase 1 shipped and is a perfectly good avatar. That fallback is the
 * reason this returns nulls instead of throwing.
 *
 * To enable the 3D avatar, drop two files into `mobile/assets/avatar3d/`:
 *
 *   three.module.min.js   the three.js browser build (r160+)
 *   GLTFLoader.js         from the same three.js release, `examples/jsm/loaders/`
 *   farmer.glb            a rigged humanoid with ARKit-style blendshapes
 *
 * A Ready Player Me half-body export satisfies the model requirement: it is
 * free, rigged to a Mixamo-compatible skeleton, and carries the `eyeBlinkLeft`
 * / `jawOpen` morph targets the scene looks for. Half-body keeps the download
 * small, which matters on a rural connection.
 *
 * Then uncomment the requires below. They are commented rather than wrapped in
 * try/catch because Metro resolves `require` at build time: a require of a
 * missing file is a bundler error, not a runtime one, and would break the whole
 * app rather than just the avatar.
 */

export type AvatarAssets = {
  threeUrl: string | null;
  modelUrl: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const THREE_MODULE: number | null = null; // require('../../../../assets/avatar3d/three.module.min.js');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MODEL: number | null = null; // require('../../../../assets/avatar3d/farmer.glb');

async function localUri(moduleId: number | null): Promise<string | null> {
  if (moduleId === null) return null;

  try {
    const asset = Asset.fromModule(moduleId);
    await asset.downloadAsync();
    return asset.localUri ?? asset.uri ?? null;
  } catch {
    return null;
  }
}

export async function loadAvatarAssets(): Promise<AvatarAssets> {
  const [threeUrl, modelUrl] = await Promise.all([localUri(THREE_MODULE), localUri(MODEL)]);
  return { threeUrl, modelUrl };
}

/** True when the 3D avatar has everything it needs to render. */
export function hasAvatarAssets(assets: AvatarAssets): boolean {
  return assets.threeUrl !== null && assets.modelUrl !== null;
}
