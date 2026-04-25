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
        "Track.01 Crossing a River - 川越 -",
        "Track.02 Narrow Mountain - 狭山 -"
      ],
      2: [
        "Track.01 Rice Ability  - 飯能 -",
        "Track.02 Sun High - 日高 -",
        "Track.03 Place with a Swamp - 所沢 -"
      ],
      3: [
        "Track.01 Entry Space  - 入間 -",
        "Track.02 Carane Island - 鶴ヶ島 -",
        "Track.03 Order and Father - 秩父 -"
      ],
      4: [
        "Track.01 Morning Haze - 朝霞 -",
        "Track.02 Crossing The Valley - 越谷 -",
        "Track.03 Three Fragrances - 三芳 -"
      ],
      5: [
        "Track.01 New Place - 新座 -",
        "Track.02 Bracken - 蕨 -",
        "Track.03 Gun Man Rock Full Heavy"
      ],
      6: [
        "Track.01  Bear Village - 熊谷 -",
        "Track.02 Grass Addition  - 草加 -",
        "Track.03 Narrow Mountain Tea  - 狭山茶 -"
      ]
    }
  };

  window.CATALOG = CATALOG;
})();
