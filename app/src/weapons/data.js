/* Words and numbers for the four weapons.
   `ex` is how far each part slides (sword units: along the blade, across it) when the weapon comes apart.
   `side` is which side of the part its callout sits on. `focus` (optional) is a window [x, y, w] in sword space to zoom to instead of the whole part. */
export const WEAPONS = [
  {
    id: 'voracity', wid: 'vor', name: 'VORACITY', font: "'Eater', 'Impact', sans-serif", fontScale: 1, sin: 'GLUTTONY', sinLine: 'It cuts to feed.',
    kicker: 'I / IV · Purple hellfire', tagline: 'It was never made to harvest. It was made to feed.',
    env: 0, ac: '#ff6ef0', glow: '#ff6ef0', glow2: '#c24bff', hero: { land: -132, port: -104 }, over: { land: 0, port: -90 },
    lore: {
      found: 'The Ash Refectory, a drowned monastery under the Cinder Marsh. It stood upright in a table laid for forty.',
      owner: 'Mother Ysolde Karn, abbess of Karn’s Mercy and warden of its famine stores.',
      fate: 'She fed it a harvest a night until there was no one left to feed. The scythe walked out of the refectory alone.'
    },
    parts: [
      { id: 'foot', name: 'Foot Talon', title: 'Butt spike', ex: [-250, 20], side: 'up',
        role: 'An almond frame that ends in a single spike. Planted in the ground, it holds the scythe upright. The hollow is not decoration: it is the mouth the first blood ran into.',
        material: 'Black iron, grown rather than forged. Violet glass in the grain.', spec: [['Shape', 'Almond frame, one spike'], ['Hollow', 'Open, lit from inside'], ['Use', 'Planted between swings']] },
      { id: 'lowbind', name: 'Lower Binding', title: 'Twin-strand wrap', ex: [-90, -170], side: 'up',
        role: 'Two strands of living vine wind round the shaft and cross every half turn. They fix the grip and take what the hand gives.',
        material: 'Thorn vine over iron, beaded with ember glass.', spec: [['Weave', 'Double helix, two turns'], ['Beads', 'One at each crossing'], ['Grip', 'Rough, never slips']] },
      { id: 'shaft', name: 'Haft', title: 'Vine-wound shaft', ex: [0, 0], side: 'down', focus: [330, 0, 560],
        role: 'A long, slightly bowed shaft sheathed in thorned vine. The bow is deliberate: it lets the blade swing a wider arc than the arm alone.',
        material: 'Ironwood heart, vine sheath, thorns left on.', spec: [['Length', 'About two metres'], ['Bow', 'A hand’s width over its length'], ['Thorns', 'Fourteen, pointing both ways']] },
      { id: 'upbind', name: 'Upper Binding', title: 'Throat wrap', ex: [80, 170], side: 'down',
        role: 'Where the haft meets the head, the strands thicken and pull the crown down onto the shaft like a throat swallowing.',
        material: 'Thorn vine, ember glass at every crossing.', spec: [['Weave', 'Double helix, two turns'], ['Load', 'Holds the whole head on'], ['Glow', 'Brightens with use']] },
      { id: 'ring', name: 'Maw Ring', title: 'Hunger ring', ex: [150, -210], side: 'up',
        role: 'A ring at the throat of the head. Three eyelets burn pink where the hunger shows through. It is the weapon’s mouth and it is never closed.',
        material: 'Dark alloy, rimmed with lit glass.', spec: [['Eyelets', 'Three, always burning'], ['Opening', 'A hand wide'], ['Voice', 'Hums when it is near food']] },
      { id: 'mantle', name: 'Mantle', title: 'Spined crown', ex: [60, -130], side: 'up',
        role: 'Layered plates armour the root of the blade, and long thorns rake backward from the ring. They hook what the blade opens and keep it.',
        material: 'Overlapping black plates, violet rim light.', spec: [['Plates', 'Three, shingled'], ['Thorns', 'Eight, the longest a forearm'], ['Weight', 'Balances the blade']] },
      { id: 'blade', name: 'Crescent Blade', title: 'Hooked blade', ex: [260, 40], side: 'down',
        role: 'A hooked blade whose outer edge is dark and spined and whose inner edge burns. It cuts on the inside curve, and that glow is the edge feeding.',
        material: 'Dark iron with a core of molten violet glass.', spec: [['Reach', 'One long sweep'], ['Edge', 'Inner curve, lit'], ['Eyelets', 'Six, one per feeding']] }
    ]
  },
  {
    id: 'halcyon', wid: 'hal', name: 'HALCYON', font: "'Cinzel Decorative', 'Cinzel', serif", fontScale: 0.82, sin: 'PRIDE', sinLine: 'It will not bow.',
    kicker: 'II / IV · Snow blizzard', tagline: 'Calm as a frozen lake. Cold as what lies beneath it.',
    env: 1, ac: '#f2fbff', glow: '#9fdcff', glow2: '#b9a8ff', hero: { land: -58, port: -80 }, over: { land: 0, port: -90 },
    lore: {
      found: 'The Mirror Cavern under Mount Vael, frozen into the ceiling point down above a lake that has never moved.',
      owner: 'Sovereign Aurelian Vael, the Unbowed, who refused to kneel even to a winter.',
      fate: 'He was found standing, in full regalia, rimed solid. The sword in his hand had not a flake of frost on it.'
    },
    parts: [
      { id: 'pommel', name: 'Crown Crystal', title: 'Pommel', ex: [-260, 0], side: 'up',
        role: 'A single cut crystal that counterweights the blade and sits in the palm. Struck, it rings one clear note that carries across a frozen lake.',
        material: 'Clear lilac quartz, hand faceted.', spec: [['Cut', 'Elongated brilliant'], ['Note', 'A pure high tone'], ['Weight', 'Balances at the guard']] },
      { id: 'grip', name: 'Grip', title: 'Lattice grip', ex: [-120, 140], side: 'down',
        role: 'A slender grip lacquered white over bone glass, scored in a diamond lattice so a gloved hand never slips. Two collars lock it at either end.',
        material: 'Bone glass, white lacquer, silver collars.', spec: [['Lattice', 'Diamond, fine'], ['Collars', 'One each end'], ['Hand', 'Fits a gauntlet']] },
      { id: 'core', name: 'Heart Gem', title: 'Core crystal', ex: [-30, -150], side: 'up',
        role: 'A blue faceted gem set at the heart of the guard. It pulses slowly, a pulse of the cold itself, and the whole sword brightens with it.',
        material: 'Deep sapphire crystal with a cyan core.', spec: [['Facets', 'Twenty-four'], ['Pulse', 'About one in four seconds'], ['Colour', 'Sapphire to cyan']] },
      { id: 'wings', name: 'Wing Guard', title: 'Feathered guard', ex: [30, 0], side: 'down',
        role: 'A swept guard of layered feathers, white at the root and lilac at the tips. It turns an edge aside the way a wing turns a gust.',
        material: 'Layered white crystal, lilac glaze.', spec: [['Feathers', 'Three layers per side'], ['Sweep', 'Forward and up'], ['Use', 'Catches and turns a blow']] },
      { id: 'shardsU', name: 'Upper Shards', title: 'Floating crystals', ex: [40, -230], side: 'up',
        role: 'Violet shards that hang above the guard without touching it. They are the sword’s pride, held just out of reach of everything.',
        material: 'Violet crystal, never attached.', spec: [['Count', 'Six'], ['Hold', 'Float without contact'], ['Tone', 'Violet to white']] },
      { id: 'shardsL', name: 'Lower Shards', title: 'Hanging crystals', ex: [70, 230], side: 'down',
        role: 'A smaller cluster that hangs below the guard and turns slowly. They chime when the blade is drawn, like a court announcing a king.',
        material: 'Violet crystal, never attached.', spec: [['Count', 'Five'], ['Sound', 'A thin chime'], ['Motion', 'A slow turn']] },
      { id: 'blade', name: 'Crystal Blade', title: 'Faceted blade', ex: [300, 0], side: 'up', focus: [700, 0, 620],
        role: 'A long blade of faceted ice-crystal with a white ridge down its centre and a few dark cracks at the root. It has never been dulled, and it has never been wiped.',
        material: 'Cold-grown crystal, cyan and blue twin tones.', spec: [['Tip', 'Slanted, like a chisel'], ['Ridge', 'Centre, white'], ['Cracks', 'Three, root only']] }
    ]
  },
  {
    id: 'eclipse', wid: 'ecl', name: 'ECLIPSE', font: "'Pirata One', 'Impact', serif", fontScale: 1.1, sin: 'ENVY', sinLine: 'It wants what you hold.',
    kicker: 'III / IV · The black void', tagline: 'It wants what the light has.',
    env: 2, ac: '#ff2a2a', glow: '#ff2a2a', glow2: '#ff8a4a', hero: { land: -52, port: -78 }, over: { land: 0, port: -90 },
    lore: {
      found: 'Beneath the Obsidian Orrery in the Court of Ash, the one place the sun has never reached.',
      owner: 'Thessaly Voss, second-born and unpraised, who took her sister’s crown, her name, and finally the sword.',
      fate: 'She wore the crown for one night. By morning the gem burned brighter, and her sister’s name was gone from every wall.'
    },
    parts: [
      { id: 'pommel', name: 'Spear Pommel', title: 'Barbed pommel', ex: [-250, 0], side: 'up',
        role: 'A pommel made as a spear: arrowhead, two barbs, a knob below. Reversed, the sword can be thrown or planted and still do harm.',
        material: 'Blackened steel, matte, edges polished.', spec: [['Head', 'Arrow, two barbs'], ['Knob', 'Round, weighted'], ['Use', 'Thrust or throw, reversed']] },
      { id: 'grip', name: 'Banded Grip', title: 'Handle', ex: [-110, 150], side: 'down',
        role: 'A narrow grip in thin bands, steel and leather in turn, so a wet hand can find its place by feel.',
        material: 'Steel bands, black leather.', spec: [['Bands', 'Nine'], ['Neck', 'Narrow, for the thumb'], ['Wear', 'Polished by hands']] },
      { id: 'guard', name: 'Horned Crossguard', title: 'Crest', ex: [0, -170], side: 'up',
        role: 'Two horns sweep out and up from a crest, wide enough to catch a blade and hold it. The crest wraps the gem like a hand around a coin.',
        material: 'Blackened steel, inlaid red edge.', spec: [['Span', 'Wide, horns up'], ['Crest', 'Frames the gem'], ['Edge', 'Thin red inlay']] },
      { id: 'gem', name: 'Blood Gem', title: 'Eye of the crest', ex: [20, -300], side: 'up',
        role: 'A single red teardrop. It beats once, slowly, when something near the wielder is worth wanting.',
        material: 'Garnet-red crystal, teardrop cut.', spec: [['Cut', 'Teardrop'], ['Glow', 'Slow pulse'], ['Wakes', 'When something is wanted']] },
      { id: 'fangsU', name: 'Upper Fangs', title: 'Crest fangs', ex: [100, -90], side: 'up',
        role: 'A pair of curved fangs above the blade’s root, each bending in toward it. They snag a blade sliding down the steel.',
        material: 'Blackened steel.', spec: [['Count', 'Two'], ['Curve', 'Inward, hooked'], ['Use', 'Catch a sliding edge']] },
      { id: 'fangsL', name: 'Lower Fangs', title: 'Root fangs', ex: [120, 160], side: 'down',
        role: 'Longer fangs that curve out from below the root and flank the blade. They guard the hand and bite whatever reaches round it.',
        material: 'Blackened steel.', spec: [['Count', 'Two'], ['Curve', 'Outward and down'], ['Use', 'Guard the hand']] },
      { id: 'blade', name: 'Leaf Blade', title: 'Blade', ex: [300, 20], side: 'down', focus: [900, 0, 760],
        role: 'A long leaf-shaped blade, widest a quarter of the way down and tapering to a needle. A fuller runs its length and a thin red glow traces the edge.',
        material: 'Dark steel, flecked like cracked stone.', spec: [['Fuller', 'Full length'], ['Waist', 'Widest near the guard'], ['Edge', 'Red rim glow']] }
    ]
  },
  {
    id: 'avarice', wid: 'ava', name: 'AVARICE', font: "'Syncopate', 'Arial Black', sans-serif", fontScale: 0.74, sin: 'GREED', sinLine: 'It takes more than it needs.',
    kicker: 'IV / IV · Violet thunderstorm', tagline: 'Everything within reach, and then a little further.',
    env: 3, ac: '#d9b8ff', glow: '#b07bff', glow2: '#e8d0ff', hero: { land: -48, port: -76 }, over: { land: 0, port: -90 },
    lore: {
      found: 'Cracked out of a vein of black glass in the Gilded Ravine, still humming, in the roots of a lightning-struck tree.',
      owner: 'Corvane the Tallyman, lord of ledgers, who counted every coin and every coin he did not yet own.',
      fate: 'He bought the sword with a kingdom’s debt. Lightning found him the same night. The tally book beside him was still open.'
    },
    parts: [
      { id: 'pommel', name: 'Claw Pommel', title: 'Clutching pommel', ex: [-260, 20], side: 'up',
        role: 'A pommel shaped like a closed claw. It anchors the hand and, held in front of the chest, looks like it is gripping something that is not there.',
        material: 'Violet-black alloy.', spec: [['Form', 'Claw, three talons'], ['Role', 'Anchors the heel of the hand'], ['Mood', 'Never lets go']] },
      { id: 'grip', name: 'Cord Grip', title: 'Wrapped handle', ex: [-110, 150], side: 'down',
        role: 'A long grip bound in grey cord, wrapped tight over a steel core. It takes a two-handed hold and still leaves room to want more.',
        material: 'Waxed cord over steel.', spec: [['Wrap', 'Cord, in a spiral'], ['Hold', 'Two hands'], ['Core', 'Steel tang']] },
      { id: 'guard', name: 'Spiked Guard', title: 'Thorn mass', ex: [0, -140], side: 'up',
        role: 'A dense mass of spikes crowds the guard. The longer ones lock a blade; the shorter ones are there to take, and keep, whatever an enemy lets go of.',
        material: 'Violet-black alloy, veined.', spec: [['Spikes', 'Fourteen'], ['Mass', 'Dense, angular'], ['Veins', 'Lit from within']] },
      { id: 'eye', name: 'Core Eye', title: 'Heart of the guard', ex: [20, -280], side: 'up',
        role: 'A pale eye at the centre of the guard. It never closes. Every vein of the blade runs back to it.',
        material: 'Violet crystal over a lightning core.', spec: [['Glow', 'Pale violet'], ['Blink', 'Never'], ['Links', 'Every vein']] },
      { id: 'finsU', name: 'Dorsal Fins', title: 'Spine', ex: [90, -200], side: 'up',
        role: 'A cluster of tall fins up the spine of the blade. They shed charge in a storm and gather it again, a little more each time.',
        material: 'Violet alloy, hard edge.', spec: [['Fins', 'Five, graded'], ['Charge', 'Shed and regained'], ['Edge', 'Sharp']] },
      { id: 'finsL', name: 'Lower Fins', title: 'Belly fins', ex: [110, 190], side: 'down',
        role: 'Smaller fins along the edge of the blade, tucked back. They keep the edge from sliding off what it has cut.',
        material: 'Violet alloy.', spec: [['Fins', 'Four'], ['Sweep', 'Backward'], ['Job', 'Hold the cut']] },
      { id: 'blade', name: 'Storm Blade', title: 'Curved blade', ex: [300, 20], side: 'down', focus: [920, -50, 700],
        role: 'A long, slightly curved blade whose tip bends upward. Veins of white lightning run through the dark steel and branch near the edge.',
        material: 'Dark violet steel, lightning veins.', spec: [['Curve', 'Gentle, tip up'], ['Veins', 'Branching, glowing'], ['Reach', 'A long arm and more']] }
    ]
  }
];
