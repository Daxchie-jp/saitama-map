(() => {
  const CATALOG = {
    works: {
      sayama: { items: [] },
      soka: { items: [] }
    },
    categoryCityAliases: {
      kawagoke: "kawagoe",
      nanno: "hanno",
      koshigawa: "koshigaya",
      kuamgaya: "kumagaya"
    },
    categoryDefs: {
      1: ["kawagoe", "sayama"],
      2: ["hidaka", "hanno", "tokorozawa"],
      3: ["iruma", "tsurugashima", "chichibu"],
      4: ["asaka", "koshigaya", "miyoshi"],
      5: ["niiza", "warabi"],
      6: ["kumagaya", "soka"]
    },
    categoryImages: {
      1: "images/cd_1.jpg",
      2: "images/cd_2.jpg",
      3: "images/cd_3.jpg",
      4: "images/cd_4.jpg",
      5: "images/cd_5.jpg",
      6: "images/cd_6.jpg"
    },
    categoryTracks: {
      1: [
        "Track.01 Crossing a River - kawagoe",
        "Track.02 Narrow Mountain - Sayama -"
      ],
      2: [
        "Track.01 Rice Ability  - Hanno -",
        "Track.02 Sun High - Hidaka -",
        "Track.03 Place with a Swamp - Tokorozawa -"
      ],
      3: [
        "Track.01 Entry Space  - Iruma -",
        "Track.02 Carane Island - Tsurugashima -",
        "Track.03 Order and Father - Chichibu -"
      ],
      4: [
        "Track.01 Morning Haze - Asaka -",
        "Track.02 Crossing The Valley - Koshigaya -",
        "Track.03 Three Fragrances - Miyoshi -"
      ],
      5: [
        "Track.01 New Place - Niiza -",
        "Track.02 Bracken - Warabi -",
        "Track.03 Gun Man Rock Full Heavy"
      ],
      6: [
        "Track.01  Bear Village - Kumagaya -",
        "Track.02 Grass Addition  - Soka -",
        "Track.03 Narrow Mountain Tea  - Sayama-Cha -"
      ]
    }
  };

  window.CATALOG = CATALOG;
})();
