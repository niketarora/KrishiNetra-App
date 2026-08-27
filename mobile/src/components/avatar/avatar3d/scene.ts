/**
 * The three.js scene, as an HTML document for the WebView.
 *
 * It is a string rather than a file so the whole scene ships in the JS bundle
 * with no asset-resolution or file-URI permissions to get wrong on Android.
 *
 * Division of labour, matching `animation/animationController.ts`:
 *
 *   React Native  decides what the avatar should be doing, and posts a
 *                 directive when — and only when — that changes.
 *   This scene    executes it, and owns everything per-frame: breathing,
 *                 blinking, head drift, jaw movement, clip cross-fades.
 *
 * Nothing crosses the bridge per frame.
 *
 * The mouth movement here is a cadence oscillation, NOT lip sync. There is no
 * audio in this phase, so there is no viseme timing to sync to (§6). When TTS
 * lands, `lipsync/lipSyncController` drives `mouthActivity` from real viseme
 * frames and this file does not change.
 */

export type SceneDirectiveMessage = {
  type: 'directive';
  clip: string;
  gesture: string;
  expression: string;
  mouthActivity: number;
  headMotion: number;
  blinkRate: number;
};

export type SceneEvent =
  | { type: 'ready'; hasModel: boolean }
  | { type: 'error'; reason: string };

/**
 * Builds the document.
 *
 * `threeUrl` and `modelUrl` are local asset URIs resolved by the host. Either
 * may be null — a missing three.js or a missing model posts an `error` and the
 * host falls back to the photograph rather than showing an empty black box.
 */
export function buildSceneHtml(threeUrl: string | null, modelUrl: string | null): string {
  const bootstrap = `
    const send = (payload) => {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    };

    const THREE_URL = ${JSON.stringify(threeUrl)};
    const MODEL_URL = ${JSON.stringify(modelUrl)};

    if (!THREE_URL || !MODEL_URL) {
      send({ type: 'error', reason: !THREE_URL ? 'three.js asset missing' : 'model asset missing' });
    } else {
      boot().catch((error) => send({ type: 'error', reason: String(error && error.message || error) }));
    }

    async function boot() {
      const THREE = await import(THREE_URL);
      const { GLTFLoader } = await import(THREE_URL.replace(/three[^/]*\\.js$/, 'GLTFLoader.js'));

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(window.innerWidth, window.innerHeight);
      document.body.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(28, window.innerWidth / window.innerHeight, 0.1, 100);
      camera.position.set(0, 1.5, 1.5);

      scene.add(new THREE.HemisphereLight(0xffffff, 0x8d6e4f, 2.2));
      const key = new THREE.DirectionalLight(0xffffff, 1.6);
      key.position.set(1, 2, 2);
      scene.add(key);

      const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
      const avatar = gltf.scene;
      scene.add(avatar);

      // Frame the head and shoulders: this is a conversation, not a full-body shot.
      const box = new THREE.Box3().setFromObject(avatar);
      const height = box.max.y - box.min.y;
      avatar.position.y = -box.min.y;
      camera.position.set(0, height * 0.88, height * 0.62);
      camera.lookAt(0, height * 0.88, 0);

      const mixer = new THREE.AnimationMixer(avatar);
      const clips = {};
      for (const clip of gltf.animations) clips[clip.name.toLowerCase()] = mixer.clipAction(clip);

      // Morph targets, if the model is rigged with them. A model without
      // blendshapes still animates — it just does not blink or move its mouth.
      const morphs = [];
      avatar.traverse((node) => {
        if (node.isMesh && node.morphTargetDictionary) morphs.push(node);
      });

      const setMorph = (names, value) => {
        for (const mesh of morphs) {
          for (const name of names) {
            const index = mesh.morphTargetDictionary[name];
            if (index !== undefined) mesh.morphTargetInfluences[index] = value;
          }
        }
      };

      let current = {
        clip: 'idle', gesture: 'idle', expression: 'neutral',
        mouthActivity: 0, headMotion: 0.15, blinkRate: 17,
      };
      let active = null;

      const playClip = (name) => {
        const next = clips[name] || clips.idle;
        if (!next || next === active) return;
        next.reset().fadeIn(0.35).play();
        if (active) active.fadeOut(0.35);
        active = next;
      };
      playClip('idle');

      const head = avatar.getObjectByName('Head') || avatar.getObjectByName('head');
      const baseRotation = head ? { x: head.rotation.x, y: head.rotation.y } : null;

      let nextBlinkAt = 0;
      let blinkUntil = 0;
      const clock = new THREE.Clock();

      renderer.setAnimationLoop(() => {
        const delta = clock.getDelta();
        const time = clock.getElapsedTime();
        mixer.update(delta);

        // Breathing: always present, because a body that is perfectly still
        // reads as a photograph rather than a person.
        avatar.position.y += Math.sin(time * 1.1) * 0.0004;

        if (head && baseRotation) {
          const amount = current.headMotion;
          head.rotation.y = baseRotation.y + Math.sin(time * 0.42) * 0.09 * amount;
          head.rotation.x = baseRotation.x + Math.sin(time * 0.31) * 0.05 * amount;
        }

        if (current.blinkRate > 0) {
          if (time > nextBlinkAt) {
            blinkUntil = time + 0.12;
            // Jittered so blinks do not land on a metronome.
            nextBlinkAt = time + (60 / current.blinkRate) * (0.7 + Math.random() * 0.6);
          }
          setMorph(['eyeBlinkLeft', 'eyeBlinkRight', 'blink'], time < blinkUntil ? 1 : 0);
        } else {
          setMorph(['eyeBlinkLeft', 'eyeBlinkRight', 'blink'], 0);
        }

        // Cadence, not visemes. Two overlapping rates keep it from looking
        // like a metronome, but it is not synchronised to anything.
        const mouth = current.mouthActivity > 0
          ? Math.max(0, Math.sin(time * 11) * 0.5 + Math.sin(time * 6.5) * 0.3) * current.mouthActivity
          : 0;
        setMorph(['jawOpen', 'mouthOpen', 'viseme_aa'], mouth);

        renderer.render(scene, camera);
      });

      window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      });

      const apply = (directive) => {
        current = directive;
        playClip(directive.clip);
      };

      // Android delivers host messages on document; iOS on window.
      const onMessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload && payload.type === 'directive') apply(payload);
        } catch (error) {
          // A malformed message must never kill the render loop.
        }
      };
      document.addEventListener('message', onMessage);
      window.addEventListener('message', onMessage);

      send({ type: 'ready', hasModel: true });
    }
  `;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <style>
      html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; background: transparent; }
      canvas { display: block; touch-action: none; }
    </style>
  </head>
  <body>
    <script type="module">${bootstrap}</script>
  </body>
</html>`;
}
