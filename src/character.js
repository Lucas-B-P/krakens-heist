/**
 * Como o polvo é desenhado. Troque `type` para usar outra arte:
 *
 *  - 'image'  PNG único (assets/kraken.png) animado por código.
 *  - 'sheet'  Sprite sheet quadro a quadro (PNG/WebP + JSON).
 *             Gere com `npm run sheet` a partir de art/kraken_frames/<animação>/*.png.
 *  - 'spine'  Esqueleto Spine exportado (.json ou .skel + .atlas + .png).
 *
 * As animações procuradas são as de `animations`; as que não existirem são ignoradas
 * e o polvo continua só com o movimento por código. Se os arquivos não carregarem,
 * o jogo volta automaticamente para 'image'.
 */
export const CHARACTER = {
  type: 'sheet',

  sheet: {
    src: 'assets/kraken/kraken_sheet.json',
    fps: 12, // usado só se o JSON não trouxer meta.fps
  },

  spine: {
    skeleton: 'assets/kraken/kraken.json',
    atlas: 'assets/kraken/kraken.atlas',
    scale: 1,
  },

  animations: {
    idle: 'idle',
    win: 'win',
    anticipation: 'anticipation',
  },
};
