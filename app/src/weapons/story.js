/* The chronicle read on the landing page. Each beat that names a relic points at a weapon in data.js (by index). */
export const FOLIO = {
  kicker: 'Chronicle of the Ash Roads · Folio the First',
  title: ['The Four', 'Relics'],
  sub: 'Before the ledgers and the crowns, there were four hungers. Each one found a blade to live in.',
  cue: 'Read on. Hold the glass to the page.'
};

export const BEATS = [
  {
    id: 'prologue', num: 'Prologue', name: 'The Reckoning of Edges', place: 'The Ash Roads, in the keepers’ own hand', tint: [0.1, 0.5, 0.45],
    text: 'The old keepers of the Ash Roads kept a ledger of every blade that ever drew blood without a hand to guide it. Their count stopped at four. They did not write why. They wrote only where each was found and who last carried it, so that the next fool would know exactly what he was choosing.'
  },
  {
    id: 'i', w: 0, num: 'I', place: 'Found in the Ash Refectory, under the Cinder Marsh', tint: [0.62, 0.12, 0.62],
    text: 'A monastery drowned with its tables still laid. The scythe stood upright at the head of a feast for forty, its blade lit from within like a mouth that had not yet decided to close. Mother Ysolde Karn had fed it her famine stores, one harvest a night, until there was no one left to feed. The scythe walked out of the refectory on its own. The diggers who found the empty hall say every plate was clean.'
  },
  {
    id: 'ii', w: 1, num: 'II', place: 'Found in the Mirror Cavern, under Mount Vael', tint: [0.2, 0.55, 0.75],
    text: 'The roof of the cavern is a single sheet of ice, and out of it, point down above a lake that has never moved, hung a sword without one flake of frost upon it. Sovereign Aurelian Vael, the Unbowed, had refused to kneel to a winter, and the winter in turn refused to touch his blade. They found him standing, rimed solid, in full regalia. The sword was in his hand. It was warm.'
  },
  {
    id: 'iii', w: 2, num: 'III', place: 'Found beneath the Obsidian Orrery, in the Court of Ash', tint: [0.7, 0.08, 0.08],
    text: 'In the one chamber the sun has never touched, a black blade lay in a bed of its own cooled shadow with a single red stone in its guard. Thessaly Voss, second-born and never praised, took her sister’s crown, then her sister’s name, then at last the sword. She wore the crown for one night. By morning the stone burned brighter, and every wall in the palace had been scrubbed of her sister.'
  },
  {
    id: 'iv', w: 3, num: 'IV', place: 'Found in the Gilded Ravine, in the roots of a struck tree', tint: [0.45, 0.28, 0.8],
    text: 'Lightning had struck the same tree for a thousand years, and among its roots a vein of black glass cracked open around a humming blade. Corvane the Tallyman, lord of ledgers, bought it with the debt of a kingdom. The storm found him the same night. The tally book beside him was still open, in a hand that had begun to run past the margins.'
  },
  {
    id: 'epilogue', num: 'Epilogue', name: 'Four Sins, One Table', place: 'Where the keepers stopped writing', tint: [0.1, 0.5, 0.45],
    text: 'Gluttony, pride, envy, greed. Four edges, four owners, four endings. Come closer and see how each is made. Take them apart piece by piece, learn what each one wants, and keep your hand open.',
    cta: 'Descend into the gallery'
  }
];
