import voracityGlb from '../assets/voracity.glb?url';
import halcyonGlb from '../assets/halcyon.glb?url';
import eclipseGlb from '../assets/eclipse.glb?url';
import avariceGlb from '../assets/avarice.glb?url';

/* How each weapon's 3D model is dressed and lit in the browser, matched to the world behind it (the WebGL background and the aura):
   the look of every Blender material (by name; its procedural scratches and glow do not travel in a .glb), the little studio the metal reflects,
   and the lights. `heroRoll` is how far the weapon leans in its opening pose. */
const metalLook = (color, metalness, roughness, clearcoat = 0.3, cc = 0.15) => ({ color, metalness, roughness, clearcoat, clearcoatRoughness: cc });
const glowLook = (emissive, glow, color = 0x14080c) => ({ color, metalness: 0, roughness: 0.25, emissive, glow });

export const THEMES = {
  /* VORACITY: purple hellfire. Magenta and violet strips, a soft violet panel for the flat faces to catch */
  voracity: {
    glb: voracityGlb, heroRoll: -0.38, exposure: 0.85, envIntensity: 1.0,
    env: { bg: 0x05030a, panels: [[1.2, 7, 0xff3ad8, [-5, 1, 2], 14], [1.2, 7, 0x6a5cff, [5, 1, -1], 11], [6, 3, 0xe9ddff, [-2, 6, 4], 8], [8, 1.4, 0xb04cff, [0, -4, 3], 4], [10, 10, 0x2a1458, [0, 3, -8], 2.5], [7, 5, 0x9a7cff, [0, 1, 7], 0.9]] },
    key: [0xf2e6ff, 2.6], rim1: [0xff3ad8, 140, [3.2, 2.4, -2.5]], rim2: [0x5a4cff, 90, [-3.2, 1.2, -2.8]], cursor: [0xffd6ff, 18],
    look: {
      Voracity_ForgedMetal: metalLook(0x66509a, 0.7, 0.34, 0.25),
      Voracity_Plate: metalLook(0x40306a, 0.55, 0.36, 0.45, 0.12),
      Voracity_BlackIron: metalLook(0x2c2052, 0.6, 0.4, 0.3, 0.2),
      Voracity_Vine: metalLook(0x30204e, 0.4, 0.48, 0.35, 0.3),
      Voracity_Blade: metalLook(0x2c1c4c, 0.6, 0.32, 0.55, 0.08),
      Voracity_Eyelet: glowLook(0xff4de6, 2.6, 0x200a1c),
      Voracity_RingGlow: glowLook(0xff4ae0, 1.15, 0x200a1c),
      Voracity_VioletGlass: glowLook(0x8a2bff, 0.8, 0x14082a)
    }
  },
  /* HALCYON: an ice-crystal sword in a snow blizzard. Cold white and cyan light, lilac rim, glassy surfaces */
  halcyon: {
    glb: halcyonGlb, heroRoll: -0.3, exposure: 0.95, envIntensity: 1.3,
    env: { bg: 0x06101f, panels: [[1.2, 7, 0x6fd8ff, [-5, 1, 2], 12], [1.2, 7, 0xa890ff, [5, 1, -1], 9], [6, 3, 0xf2fbff, [-2, 6, 4], 9], [8, 1.4, 0x8cc8ff, [0, -4, 3], 3.5], [10, 10, 0x143a78, [0, 3, -8], 2.5], [7, 5, 0xcfeaff, [0, 1, 7], 1.2]] },
    key: [0xe6f4ff, 3.0], rim1: [0x58c8ff, 150, [3.2, 2.4, -2.5]], rim2: [0xa08cff, 90, [-3.2, 1.2, -2.8]], cursor: [0xd6f4ff, 18],
    look: {
      Halcyon_Base: metalLook(0x7fb0ee, 0.1, 0.16, 0.9, 0.05),
      Halcyon_Low: metalLook(0x9cc6f6, 0.1, 0.14, 0.9, 0.05),
      Halcyon_Mid: metalLook(0xc2defc, 0.08, 0.12, 0.9, 0.04),
      Halcyon_High: metalLook(0xf0f9ff, 0.05, 0.1, 1.0, 0.03),
      Halcyon_Glow: glowLook(0x4ac8ff, 1.7, 0x0a2a4a),
      Halcyon_Eye: glowLook(0x9a80ff, 1.2, 0x120a3a)
    }
  },
  /* ECLIPSE: black steel under a red eclipse. Almost no fill, a hard red rim and a crimson edge light */
  eclipse: {
    glb: eclipseGlb, heroRoll: -0.3, exposure: 0.95, envIntensity: 1.2,
    env: { bg: 0x040102, panels: [[1.2, 7, 0xff2a2a, [-5, 1, 2], 14], [1.2, 7, 0xc01030, [5, 1, -1], 11], [6, 3, 0xe8e8ff, [-2, 6, 4], 5], [8, 1.4, 0xff3a2a, [0, -4, 3], 4], [10, 10, 0x2a0508, [0, 3, -8], 2.5], [7, 5, 0xc8c8e0, [0, 1, 7], 1.1]] },
    key: [0xf4f4ff, 2.8], rim1: [0xff2a2a, 260, [3.2, 2.4, -2.5]], rim2: [0xe01838, 170, [-3.2, 1.2, -2.8]], cursor: [0xffb4a8, 22],
    look: {
      Eclipse_Base: metalLook(0x24242e, 0.85, 0.3, 0.35),
      Eclipse_Low: metalLook(0x30303c, 0.85, 0.3, 0.35),
      Eclipse_Mid: metalLook(0x505064, 0.8, 0.28, 0.4),
      Eclipse_High: metalLook(0x8888a0, 0.75, 0.26, 0.45),
      Eclipse_Glow: glowLook(0xff2a1a, 3.2, 0x2a0508),
      Eclipse_Eye: glowLook(0xff7a5a, 1.6, 0x2a0a08)
    }
  },
  /* AVARICE: a violet greatsword in a thunderstorm over lava: violet strips from above, hot orange light from below */
  avarice: {
    glb: avariceGlb, heroRoll: -0.3, exposure: 0.9, envIntensity: 1.2,
    env: { bg: 0x05020c, panels: [[1.2, 7, 0xb07bff, [-5, 1, 2], 13], [1.2, 7, 0x6a3cff, [5, 1, -1], 10], [6, 3, 0xe8d8ff, [-2, 6, 4], 7], [8, 1.6, 0xff8a2a, [0, -4, 3], 7], [10, 10, 0x240a58, [0, 3, -8], 2.5], [7, 5, 0xa07cff, [0, 1, 7], 0.9]] },
    key: [0xeadcff, 2.6], rim1: [0xa070ff, 150, [3.2, 2.4, -2.5]], rim2: [0xff8a2a, 120, [-3.2, -2.4, -1.5]], cursor: [0xe8d0ff, 18],
    look: {
      Avarice_Base: metalLook(0x2a1466, 0.6, 0.34, 0.5, 0.1),
      Avarice_Low: metalLook(0x3c1e8a, 0.6, 0.32, 0.5, 0.1),
      Avarice_Mid: metalLook(0x5a34b8, 0.55, 0.3, 0.5, 0.1),
      Avarice_High: metalLook(0x9a70ee, 0.5, 0.28, 0.5, 0.1),
      Avarice_Glow: glowLook(0xb07bff, 1.9, 0x180a3a),
      Avarice_Eye: glowLook(0xe8d0ff, 1.7, 0x201040)
    }
  }
};
