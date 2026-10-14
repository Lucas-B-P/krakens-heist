import { Assets } from 'pixi.js';
import { CHARACTER } from '../character.js';
import { WobbleMesh } from '../util/WobbleMesh.js';

/*
 * Cada visual expõe a mesma interface para o Kraken:
 *   view            objeto de exibição com a origem nos "pés" (centro inferior)
 *   width, height   tamanho natural, usado para escalar
 *   play(state)     'idle' | 'win' | 'anticipation'
 *   update(dt)
 */

/** Malha com os tentáculos (parte de baixo da imagem) balançando mais que o corpo. */
function tentacleMesh(texture) {
  const mesh = new WobbleMesh({
    texture,
    verticesX: 16,
    verticesY: 22,
    amplitude: 10,
    frequency: 5,
    speed: 2.2,
    weight: (u, v) => (v < 0.6 ? 0.06 : 0.06 + Math.pow((v - 0.6) / 0.4, 1.4)),
  });
  mesh.pivot.set(texture.width / 2, texture.height);
  return mesh;
}

function imageVisual(texture) {
  const mesh = tentacleMesh(texture);
  return {
    type: 'image',
    view: mesh,
    width: texture.width,
    height: texture.height,
    play() {},
    update: (dt) => mesh.update(dt),
  };
}

async function sheetVisual(renderer) {
  const { animations: names } = CHARACTER;
  const sheet = await Assets.load(CHARACTER.sheet.src);
  const pages = [sheet, ...(sheet.linkedSheets ?? [])];

  // Uma animação pode ocupar várias páginas (em ordem); cada página traz o fps dela.
  const clips = {};
  const clipFps = {};
  for (const page of pages) {
    for (const [name, textures] of Object.entries(page.animations)) {
      clips[name] = (clips[name] ?? []).concat(textures);
      clipFps[name] = page.data?.meta?.fps ?? CHARACTER.sheet.fps;
    }
    // Envia a imagem para a GPU já no carregamento; senão a primeira vez que uma
    // animação toca trava alguns quadros enquanto a textura grande é enviada.
    renderer.texture.initSource(page.textureSource);
  }

  const idle = clips[names.idle] ?? Object.values(clips)[0];
  if (!idle?.length) throw new Error(`Sprite sheet sem animações: ${CHARACTER.sheet.src}`);

  // Os quadros tocam sobre a mesma malha ondulante do PNG, então os tentáculos
  // continuam balançando por cima da animação do vídeo.
  const mesh = tentacleMesh(idle[0]);

  let current = 'idle';
  let frames = idle;
  let fps = clipFps[names.idle] ?? CHARACTER.sheet.fps;
  let time = 0;
  const play = (state) => {
    const clip = clips[names[state]];
    if (!clip || state === current) return;
    current = state;
    frames = clip;
    fps = clipFps[names[state]];
    time = 0;
  };

  return {
    type: 'sheet',
    view: mesh,
    width: idle[0].width,
    height: idle[0].height,
    play,
    update(dt) {
      time += dt;
      let index = Math.floor(time * fps);
      if (index >= frames.length) {
        if (current === 'win') {
          play('idle');
          index = 0;
        } else {
          index %= frames.length;
        }
      }
      if (mesh.texture !== frames[index]) mesh.texture = frames[index];
      mesh.update(dt);
    },
  };
}

async function spineVisual() {
  const { Spine } = await import('@esotericsoftware/spine-pixi-v8');
  const { skeleton, atlas, scale } = CHARACTER.spine;
  await Assets.load([
    { alias: 'krakenSkeleton', src: skeleton },
    { alias: 'krakenAtlas', src: atlas },
  ]);

  const spine = Spine.from({ skeleton: 'krakenSkeleton', atlas: 'krakenAtlas', scale });
  const { animations: names } = CHARACTER;
  const has = (state) => !!spine.skeleton.data.findAnimation(names[state]);

  let current = null;
  const play = (state) => {
    if (!has(state) || state === current) return;
    current = state;
    if (state === 'win') {
      spine.state.setAnimation(0, names.win, false);
      if (has('idle')) spine.state.addAnimation(0, names.idle, true, 0);
      current = 'idle';
    } else {
      spine.state.setAnimation(0, names[state], true);
    }
  };
  play('idle');
  spine.update(0);

  const bounds = spine.getLocalBounds();
  return {
    type: 'spine',
    view: spine,
    width: bounds.width,
    height: bounds.height,
    play,
    update() {},
  };
}

/** Carrega o visual configurado em `CHARACTER`, voltando para o PNG se falhar. */
export async function loadCharacterVisual(textures, renderer) {
  try {
    if (CHARACTER.type === 'sheet') return await sheetVisual(renderer);
    if (CHARACTER.type === 'spine') return await spineVisual();
  } catch (err) {
    console.warn(`[kraken] Não foi possível carregar o visual "${CHARACTER.type}", usando o PNG.`, err);
  }
  return imageVisual(textures.kraken);
}
