// Eight owner-requested generated Nick likeness references; custom poster IDs, not catalogue coverage.
export const BODYWEIGHT_POSTER_ART = {
  "tv-poster-v1-squat": {
    "url": "https://static.wixstatic.com/media/856ae2_a33f3d5b14df4ed3bd28efa4752fa324~mv2.webp",
    "width": 1200,
    "height": 800,
    "top": 0,
    "cropHeight": 800,
    "style": "Nick Style 3",
    "name": "Bodyweight squat",
    "description": "Stand tall; feet shoulder-width; Controlled squat; heels grounded",
    "sideNote": "",
    "bytes": 144016,
    "sha256": "2297b95db92cc9b066fc4023561873550ac7fa56ba6818b379190e426a5f96e2"
  },
  "tv-poster-v1-bridge": {
    "url": "https://static.wixstatic.com/media/856ae2_4c5614b7fc744a44a4670d2010dd839a~mv2.webp",
    "width": 1200,
    "height": 800,
    "top": 0,
    "cropHeight": 800,
    "style": "Nick Style 3",
    "name": "Glute bridge",
    "description": "Back supported; knees bent; Lift hips; keep ribs controlled",
    "sideNote": "",
    "bytes": 143762,
    "sha256": "1ff605b48ad315e178172aec52d32ba1338dac47b4c8106f7631847cd6057f0a"
  },
  "tv-poster-v1-calf": {
    "url": "https://static.wixstatic.com/media/856ae2_19e13ab73f9b4c8c899fc6daa7410ea6~mv2.webp",
    "width": 1200,
    "height": 800,
    "top": 0,
    "cropHeight": 800,
    "style": "Nick Style 3",
    "name": "Supported calf raise",
    "description": "Both heels down; light support; Rise onto balls of feet",
    "sideNote": "",
    "bytes": 144108,
    "sha256": "38cc5a2d25cca78e044dd7f4f38e6dd690681a561079b467b0af854b55c7b67c"
  },
  "tv-poster-v1-plank": {
    "url": "https://static.wixstatic.com/media/856ae2_ad513ad89c2b4be38fcc37c1ce933217~mv2.webp",
    "width": 1200,
    "height": 800,
    "top": 0,
    "cropHeight": 800,
    "style": "Nick Style 3",
    "name": "Forearm plank",
    "description": "KNEES-DOWN OPTION; FULL HOLD",
    "sideNote": "Knees-down and full-hold options are shown.",
    "bytes": 133582,
    "sha256": "5849017e33937070f08fd89aa034fea1593c6e88c3bf19bd2344ac8c584ef9d2"
  },
  "tv-poster-v1-side-left": {
    "url": "https://static.wixstatic.com/media/856ae2_a111f8651c4645e69396636e4ddcc89c~mv2.webp",
    "width": 1200,
    "height": 800,
    "top": 0,
    "cropHeight": 800,
    "style": "Nick Style 3",
    "name": "Kneeling side plank \u2014 left",
    "description": "LEFT elbow under shoulder; Lift hips; knees supported",
    "sideNote": "",
    "bytes": 137838,
    "sha256": "268b4bc7414da19ea4dd889143fa7c59cc3d1155419d1759531760877e2ae10d"
  },
  "tv-poster-v1-side-right": {
    "url": "https://static.wixstatic.com/media/856ae2_59a881f2b57949bfa7b777fa09ecea05~mv2.webp",
    "width": 1200,
    "height": 800,
    "top": 0,
    "cropHeight": 800,
    "style": "Nick Style 3",
    "name": "Kneeling side plank \u2014 right",
    "description": "RIGHT elbow under shoulder; Lift hips; knees supported",
    "sideNote": "",
    "bytes": 137966,
    "sha256": "086d08714c07363a6115f90989fa38b9333e5a3d824dfc6601b9b2dea404b2c9"
  },
  "tv-poster-v1-wall-push": {
    "url": "https://static.wixstatic.com/media/856ae2_df53657bda164fa8b53fa5ce5033ef4c~mv2.webp",
    "width": 1200,
    "height": 800,
    "top": 0,
    "cropHeight": 800,
    "style": "Nick Style 3",
    "name": "Wall push-up",
    "description": "Hands on fixed wall; Bend elbows toward wall",
    "sideNote": "",
    "bytes": 134792,
    "sha256": "92b1a26de28616a0a30482db924943250e2c895b7047d05f88bfb07403476afe"
  },
  "tv-poster-v1-march": {
    "url": "https://static.wixstatic.com/media/856ae2_9aa16a24b8ac43f897605fde246ebadd~mv2.webp",
    "width": 1200,
    "height": 800,
    "top": 0,
    "cropHeight": 800,
    "style": "Nick Style 3",
    "name": "Easy march in place",
    "description": "One controlled step; Then the other",
    "sideNote": "",
    "bytes": 133372,
    "sha256": "62b2f9e06af531625a2f340f71d906dcd3516d5c957f34fd54edc9223ce76aec"
  }
}

export function bodyweightArtFor(ex, canonical) {
  if (!canonical || ex?.id !== canonical.id || ex.tvPosterVersion !== 1 ||
      ex.n !== canonical.n || ex.eq !== canonical.eq || ex.pose !== canonical.pose ||
      JSON.stringify(ex.st) !== JSON.stringify(canonical.st)) return null
  return BODYWEIGHT_POSTER_ART[canonical.id] || null
}
