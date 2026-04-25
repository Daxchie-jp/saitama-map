(() => {
  const catalog = window.CATALOG || {};
  const works = catalog.works || {
    sayama: { items: [] },
    soka: { items: [] }
  };

  const MAP_ROOT_ID = "saitama-full";
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 8;
  const ZOOM_STEP_FACTOR = 0.85;
  const WHEEL_SENSITIVITY = 0.0012;
  const DRAG_THRESHOLD = 4;
  const CLICK_GUARD_MS = 220;
  const CITY_ID_ALIASES = {
    misato1: "misato",
    saitama2: "saitama"
  };
  const NON_CITY_RAW_IDS = new Set(["saitama", "saitama1", "saitama-full"]);
  const CATEGORY_CITY_ALIASES = catalog.categoryCityAliases || {};
  const CATEGORY_DEFS = catalog.categoryDefs || {};
  const CATEGORY_IMAGES = catalog.categoryImages || {};
  const CATEGORY_TRACKS = catalog.categoryTracks || {};
  const CATEGORY_BY_CITY = buildCategoryMap(CATEGORY_DEFS);
  const CITY_LABELS_JA = {
    asaka: "朝霞",
    chichibu: "秩父",
    hanno: "飯能",
    hidaka: "日高",
    iruma: "入間",
    kawagoe: "川越",
    koshigaya: "越谷",
    kumagaya: "熊谷",
    miyoshi: "三芳",
    niiza: "新座",
    sayama: "狭山",
    soka: "草加",
    tokorozawa: "所沢",
    tsurugashima: "鶴ヶ島",
    warabi: "蕨"
  };

  let mapRoot;
  let mapStage;
  let mapShell;
  let mapSvg;
  let indicator;
  let activeCityLayer = null;
  let activeCategoryLayers = [];
  let modal;
  let modalTitle;
  let modalCity;
  let modalImage;
  let modalTracks;

  let baseViewBox;
  let currentViewBox;
  let viewAspect = 1;

  let isPanning = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartViewBox = null;
  let hasDragged = false;

  let pinchStartDistance = 0;
  let pinchStartWidth = 0;
  let pinchAnchorWorld = null;

  let lastGestureAt = 0;
  let ignoreClickUntil = 0;
  let tapStartTarget = null;
  let categoryModalTimer = null;
  const cityLayerById = new Map();
  const pulseTimers = new WeakMap();
  const activePointers = new Map();

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    mapRoot = document.getElementById(MAP_ROOT_ID);
    mapStage = document.querySelector(".map-stage");
    mapShell = document.querySelector(".map-shell");
    mapSvg = document.querySelector(".saitama-map");
    indicator = document.getElementById("city-indicator");

    if (!mapRoot || !mapShell || !mapSvg || !mapStage) {
      updateIndicator("Map root not found");
      return;
    }

    if (!initializeViewBoxState()) {
      updateIndicator("SVG viewBox not found");
      return;
    }

    const cityLayers = detectCityLayers(mapRoot);

    if (cityLayers.length === 0) {
      updateIndicator("No city ids found");
      console.warn(
        "City layers were not detected. Export SVG with municipality ids on each group/layer."
      );
      return;
    }

    setupCityLayers(cityLayers);
    setupCategoryRail();
    setupMapEvents();
    setupZoomControls();
    setupGestureEvents();
    applyViewBox(baseViewBox);
    updateIndicator("City: none");
  }

  function initializeViewBoxState() {
    const vb = mapSvg.viewBox?.baseVal;
    if (!vb || !vb.width || !vb.height) {
      return false;
    }

    baseViewBox = {
      x: vb.x,
      y: vb.y,
      width: vb.width,
      height: vb.height
    };
    currentViewBox = { ...baseViewBox };
    viewAspect = baseViewBox.height / baseViewBox.width;
    return true;
  }

  function detectCityLayers(root) {
    return Array.from(root.children)
      .filter((node) => node instanceof SVGGElement)
      .map((layer) => {
        const rawId = layer.id;
        if (!rawId || NON_CITY_RAW_IDS.has(rawId)) {
          return null;
        }

        const cityId = normalizeCityId(rawId);
        if (!cityId) {
          return null;
        }

        layer.dataset.cityId = cityId;
        return layer;
      })
      .filter(Boolean);
  }

  function normalizeCityId(rawId) {
    if (!rawId) {
      return "";
    }
    return CITY_ID_ALIASES[rawId] || rawId;
  }

  function setupCityLayers(cityLayers) {
    cityLayerById.clear();

    cityLayers.forEach((layer) => {
      const cityId = layer.dataset.cityId;
      const hasCategory = Boolean(getCategoryIdByCity(cityId));

      layer.classList.add("city-layer");
      if (!hasCategory) {
        layer.classList.add("no-modal");
      }
      layer.setAttribute("tabindex", "0");
      layer.setAttribute("role", "button");
      layer.setAttribute("aria-label", layer.dataset.cityId);
      layer.addEventListener("click", onCityLayerClick);
      cityLayerById.set(cityId, layer);
    });
  }

  function setupCategoryRail() {
    const rail = document.createElement("aside");
    rail.className = "jacket-rail";
    rail.setAttribute("aria-label", "カテゴリジャケット");
    rail.innerHTML = `
      <h2 class="jacket-rail__title">JACKET SELECT</h2>
      <div class="jacket-rail__list"></div>
    `;

    const list = rail.querySelector(".jacket-rail__list");
    Object.keys(CATEGORY_DEFS)
      .map(Number)
      .sort((a, b) => a - b)
      .forEach((categoryId) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "jacket-card";
        button.dataset.categoryId = String(categoryId);
        button.innerHTML = `
          <img class="jacket-card__image" src="${CATEGORY_IMAGES[categoryId]}" alt="FORTUNE SPHERE Vol.${categoryId}" />
          <p class="jacket-card__label">FORTUNE SPHERE Vol.${categoryId}</p>
        `;
        button.addEventListener("click", () => {
          handleCategoryClick(categoryId);
        });
        list.appendChild(button);
      });

    mapStage.appendChild(rail);
  }

  function setupMapEvents() {
    mapRoot.addEventListener("keydown", onMapKeyDown);
    document.addEventListener("keydown", onDocumentKeyDown);
  }

  function setupZoomControls() {
    const controls = document.createElement("div");
    controls.className = "map-zoom-controls";
    controls.innerHTML = `
      <button type="button" data-zoom-in aria-label="Zoom in">+</button>
      <button type="button" data-zoom-out aria-label="Zoom out">-</button>
      <button type="button" data-zoom-reset aria-label="Reset zoom">1:1</button>
    `;

    controls.addEventListener("click", (event) => {
      const target = event.target.closest("button");
      if (!target) {
        return;
      }

      if (target.hasAttribute("data-zoom-in")) {
        zoomByFactor(ZOOM_STEP_FACTOR);
      } else if (target.hasAttribute("data-zoom-out")) {
        zoomByFactor(1 / ZOOM_STEP_FACTOR);
      } else {
        applyViewBox(baseViewBox);
      }

      lastGestureAt = Date.now();
    });

    mapShell.appendChild(controls);
  }

  function setupGestureEvents() {
    mapShell.addEventListener("wheel", onMapWheel, { passive: false });
    mapShell.addEventListener("pointerdown", onPointerDown);
    mapShell.addEventListener("pointermove", onPointerMove);
    mapShell.addEventListener("pointerup", onPointerUp);
    mapShell.addEventListener("pointercancel", onPointerUp);
    mapShell.addEventListener("pointerleave", onPointerUp);
  }

  function onMapWheel(event) {
    event.preventDefault();

    const anchor = getAnchorInfo(event.clientX, event.clientY);
    const factor = Math.exp(event.deltaY * WHEEL_SENSITIVITY);
    zoomAtAnchor(anchor, factor);
    lastGestureAt = Date.now();
  }

  function onPointerDown(event) {
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (activePointers.size === 1) {
      tapStartTarget = event.target;
    }

    if (activePointers.size === 1) {
      startPan(event.clientX, event.clientY);
    } else if (activePointers.size === 2) {
      startPinch();
    }
  }

  function onPointerMove(event) {
    if (!activePointers.has(event.pointerId)) {
      return;
    }

    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (activePointers.size >= 2) {
      updatePinch();
      return;
    }

    if (isPanning && activePointers.size === 1) {
      event.preventDefault();
      updatePan(event.clientX, event.clientY);
    }
  }

  function onPointerUp(event) {
    if (!activePointers.has(event.pointerId)) {
      return;
    }

    activePointers.delete(event.pointerId);
    if (activePointers.size === 0) {
      if (!hasDragged) {
        handleTapSelection(event.target);
      }
      endPan();
      if (hasDragged) {
        lastGestureAt = Date.now();
      }
      return;
    }

    if (activePointers.size === 1) {
      const remaining = activePointers.values().next().value;
      startPan(remaining.x, remaining.y);
    }
  }

  function handleTapSelection(target) {
    const tapTarget = tapStartTarget || target;
    tapStartTarget = null;

    if (tapTarget instanceof Element && tapTarget.closest(".map-zoom-controls")) {
      return;
    }

    const cityLayer = findCityLayer(tapTarget);
    if (!cityLayer) {
      return;
    }

    const cityId = cityLayer.dataset.cityId;
    handleCityClick(cityId, cityLayer);
    ignoreClickUntil = Date.now() + 300;
  }

  function startPan(clientX, clientY) {
    isPanning = true;
    dragStartX = clientX;
    dragStartY = clientY;
    dragStartViewBox = { ...currentViewBox };
    hasDragged = false;
    mapShell.classList.add("is-panning");
  }

  function updatePan(clientX, clientY) {
    const rect = mapSvg.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }

    const dx = clientX - dragStartX;
    const dy = clientY - dragStartY;

    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      hasDragged = true;
    }

    const moveX = (dx / rect.width) * dragStartViewBox.width;
    const moveY = (dy / rect.height) * dragStartViewBox.height;

    applyViewBox({
      x: dragStartViewBox.x - moveX,
      y: dragStartViewBox.y - moveY,
      width: dragStartViewBox.width,
      height: dragStartViewBox.height
    });
  }

  function endPan() {
    isPanning = false;
    mapShell.classList.remove("is-panning");
  }

  function startPinch() {
    isPanning = false;
    mapShell.classList.remove("is-panning");

    const points = Array.from(activePointers.values());
    if (points.length < 2) {
      return;
    }

    pinchStartDistance = getDistance(points[0], points[1]);
    pinchStartWidth = currentViewBox.width;

    const midpoint = getMidpoint(points[0], points[1]);
    const anchor = getAnchorInfo(midpoint.x, midpoint.y);
    pinchAnchorWorld = {
      worldX: anchor.worldX,
      worldY: anchor.worldY
    };
  }

  function updatePinch() {
    const points = Array.from(activePointers.values());
    if (points.length < 2 || !pinchStartDistance) {
      return;
    }

    const ratio = getDistance(points[0], points[1]) / pinchStartDistance;
    const midpoint = getMidpoint(points[0], points[1]);
    const anchor = getAnchorInfo(midpoint.x, midpoint.y);

    const nextWidth = clampWidth(pinchStartWidth / ratio);
    const nextHeight = nextWidth * viewAspect;

    applyViewBox({
      x: pinchAnchorWorld.worldX - anchor.u * nextWidth,
      y: pinchAnchorWorld.worldY - anchor.v * nextHeight,
      width: nextWidth,
      height: nextHeight
    });

    hasDragged = true;
    lastGestureAt = Date.now();
  }

  function zoomByFactor(factor) {
    const rect = mapSvg.getBoundingClientRect();
    const anchor = getAnchorInfo(rect.left + rect.width / 2, rect.top + rect.height / 2);
    zoomAtAnchor(anchor, factor);
  }

  function zoomAtAnchor(anchor, factor) {
    const nextWidth = clampWidth(currentViewBox.width * factor);
    const nextHeight = nextWidth * viewAspect;

    applyViewBox({
      x: anchor.worldX - anchor.u * nextWidth,
      y: anchor.worldY - anchor.v * nextHeight,
      width: nextWidth,
      height: nextHeight
    });
  }

  function getAnchorInfo(clientX, clientY) {
    const rect = mapSvg.getBoundingClientRect();
    const u = clamp((clientX - rect.left) / rect.width, 0, 1);
    const v = clamp((clientY - rect.top) / rect.height, 0, 1);

    return {
      u,
      v,
      worldX: currentViewBox.x + currentViewBox.width * u,
      worldY: currentViewBox.y + currentViewBox.height * v
    };
  }

  function clampWidth(width) {
    const minWidth = baseViewBox.width / MAX_ZOOM;
    const maxWidth = baseViewBox.width / MIN_ZOOM;
    return clamp(width, minWidth, maxWidth);
  }

  function applyViewBox(nextViewBox) {
    const nextWidth = clampWidth(nextViewBox.width);
    const nextHeight = nextWidth * viewAspect;

    const minX = baseViewBox.x;
    const minY = baseViewBox.y;
    const maxX = baseViewBox.x + baseViewBox.width - nextWidth;
    const maxY = baseViewBox.y + baseViewBox.height - nextHeight;

    const x = clamp(nextViewBox.x, minX, maxX);
    const y = clamp(nextViewBox.y, minY, maxY);

    currentViewBox = {
      x,
      y,
      width: nextWidth,
      height: nextHeight
    };

    mapSvg.setAttribute(
      "viewBox",
      `${currentViewBox.x} ${currentViewBox.y} ${currentViewBox.width} ${currentViewBox.height}`
    );
  }

  function getMidpoint(pointA, pointB) {
    return {
      x: (pointA.x + pointB.x) / 2,
      y: (pointA.y + pointB.y) / 2
    };
  }

  function getDistance(pointA, pointB) {
    const dx = pointA.x - pointB.x;
    const dy = pointA.y - pointB.y;
    return Math.hypot(dx, dy);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function onMapClick(event) {
    if (Date.now() < ignoreClickUntil) {
      return;
    }

    if (Date.now() - lastGestureAt < CLICK_GUARD_MS || hasDragged) {
      hasDragged = false;
      return;
    }

    const cityLayer = findCityLayer(event.target);
    if (!cityLayer) {
      return;
    }

    const cityId = cityLayer.dataset.cityId;
    handleCityClick(cityId, cityLayer);
  }

  function onCityLayerClick(event) {
    if (Date.now() < ignoreClickUntil) {
      return;
    }

    if (Date.now() - lastGestureAt < CLICK_GUARD_MS || hasDragged) {
      hasDragged = false;
      return;
    }

    const cityLayer = event.currentTarget;
    if (!(cityLayer instanceof Element)) {
      return;
    }

    const cityId = cityLayer.dataset.cityId;
    if (!cityId) {
      return;
    }
    handleCityClick(cityId, cityLayer);
  }

  function onMapKeyDown(event) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    const cityLayer = findCityLayer(event.target);
    if (!cityLayer) {
      return;
    }

    event.preventDefault();
    const cityId = cityLayer.dataset.cityId;
    handleCityClick(cityId, cityLayer);
  }

  function findCityLayer(target) {
    const cityLayer = target.closest("[data-city-id]");
    if (!cityLayer || !mapRoot.contains(cityLayer)) {
      return null;
    }
    return cityLayer;
  }

  function handleCityClick(cityId, cityLayer) {
    clearCategoryModalTimer();
    clearCategoryActiveLayers();
    setActiveCityLayer(cityLayer);
    updateIndicator(`City: ${cityId}`);
    console.log("cityId:", cityId);
    openCityModal(cityId);
  }

  function handleCategoryClick(categoryId) {
    clearCategoryModalTimer();

    const cityIds = CATEGORY_DEFS[categoryId] || [];
    if (cityIds.length === 0) {
      return;
    }

    const representativeCityId = cityIds[0];

    clearCityActiveLayer();
    setCategoryActiveLayers(cityIds);
    pulseCategoryCities(categoryId);
    closeCityModal();
    updateIndicator(`Category: ${categoryId} (${cityIds.join(", ")})`);

    categoryModalTimer = setTimeout(() => {
      openCityModal(representativeCityId);
      categoryModalTimer = null;
    }, 1200);
  }

  function clearCategoryModalTimer() {
    if (!categoryModalTimer) {
      return;
    }
    clearTimeout(categoryModalTimer);
    categoryModalTimer = null;
  }

  function clearCityActiveLayer() {
    if (!activeCityLayer) {
      return;
    }
    activeCityLayer.classList.remove("is-active");
    activeCityLayer = null;
  }

  function clearCategoryActiveLayers() {
    activeCategoryLayers.forEach((layer) => {
      layer.classList.remove("is-category-active");
    });
    activeCategoryLayers = [];
  }

  function setCategoryActiveLayers(cityIds) {
    clearCategoryActiveLayers();
    cityIds.forEach((cityId) => {
      const layer = cityLayerById.get(cityId);
      if (!layer) {
        return;
      }
      layer.classList.add("is-category-active");
      activeCategoryLayers.push(layer);
    });
  }

  function pulseCategoryCities(categoryId) {
    const cityIds = CATEGORY_DEFS[categoryId] || [];
    cityIds.forEach((cityId) => {
      const layer = cityLayerById.get(cityId);
      if (!layer) {
        return;
      }

      layer.classList.remove("is-pulse");
      void layer.getBoundingClientRect();
      layer.classList.add("is-pulse");

      const previousTimer = pulseTimers.get(layer);
      if (previousTimer) {
        clearTimeout(previousTimer);
      }

      const timer = setTimeout(() => {
        layer.classList.remove("is-pulse");
        pulseTimers.delete(layer);
      }, 1200);
      pulseTimers.set(layer, timer);
    });
  }

  function setActiveCityLayer(nextLayer) {
    if (activeCityLayer) {
      activeCityLayer.classList.remove("is-active");
    }
    activeCityLayer = nextLayer;
    activeCityLayer.classList.add("is-active");
  }

  function hasWorks(cityId) {
    const entry = works[cityId];
    return Boolean(entry && Array.isArray(entry.items) && entry.items.length > 0);
  }

  function openCityModal(cityId) {
    const categoryId = getCategoryIdByCity(cityId);
    if (!categoryId) {
      console.info(`No modal category for: ${cityId}`);
      return;
    }

    ensureModal();

    const cities = CATEGORY_DEFS[categoryId];
    modalTitle.textContent = `FORTUNE SPHERE Vol.${categoryId}`;
    modal.dataset.category = String(categoryId);
    const tracks = CATEGORY_TRACKS[categoryId] || [];
    if (tracks.length > 0) {
      modalCity.hidden = true;
      modalCity.textContent = "";
    } else {
      modalCity.hidden = false;
      const cityLabels = cities.map((city) => toJapaneseCityName(city));
      modalCity.textContent = `対象: ${cityLabels.join(" / ")}（クリック: ${toJapaneseCityName(cityId)}）`;
    }

    const imagePath = CATEGORY_IMAGES[categoryId];
    if (imagePath) {
      modalImage.src = imagePath;
      modalImage.alt = `FORTUNE SPHERE Vol.${categoryId} ジャケット`;
      modalImage.hidden = false;
    } else {
      modalImage.hidden = true;
      modalImage.removeAttribute("src");
      modalImage.alt = "";
    }

    if (tracks.length > 0) {
      modalTracks.innerHTML = tracks.map((track) => `<li>${track}</li>`).join("");
      modalTracks.hidden = false;
    } else {
      modalTracks.innerHTML = "";
      modalTracks.hidden = true;
    }

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
  }

  function updateIndicator(message) {
    if (!indicator) {
      return;
    }
    indicator.textContent = message;
  }

  function buildCategoryMap(defs) {
    const map = {};
    Object.entries(defs).forEach(([categoryId, cities]) => {
      cities.forEach((city) => {
        map[city] = Number(categoryId);
      });
    });
    return map;
  }

  function getCategoryIdByCity(cityId) {
    const normalized = CATEGORY_CITY_ALIASES[cityId] || cityId;
    return CATEGORY_BY_CITY[normalized] || null;
  }

  function toJapaneseCityName(cityId) {
    const normalized = CATEGORY_CITY_ALIASES[cityId] || cityId;
    return CITY_LABELS_JA[normalized] || normalized;
  }

  function ensureModal() {
    if (modal) {
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "city-modal";
    wrapper.setAttribute("aria-hidden", "true");
    wrapper.innerHTML = `
      <div class="city-modal__backdrop" data-close-modal></div>
      <div class="city-modal__panel" role="dialog" aria-modal="true" aria-label="カテゴリモーダル">
        <button type="button" class="city-modal__close" data-close-modal aria-label="閉じる">✕</button>
        <h2 class="city-modal__title">カテゴリ</h2>
        <p class="city-modal__city"></p>
        <div class="city-modal__content">
          <img class="city-modal__image" hidden />
          <ul class="city-modal__tracks" hidden></ul>
        </div>
      </div>
    `;

    wrapper.addEventListener("click", (event) => {
      if (event.target.closest("[data-close-modal]")) {
        closeCityModal();
      }
    });

    document.body.appendChild(wrapper);
    modal = wrapper;
    modalTitle = wrapper.querySelector(".city-modal__title");
    modalCity = wrapper.querySelector(".city-modal__city");
    modalImage = wrapper.querySelector(".city-modal__image");
    modalTracks = wrapper.querySelector(".city-modal__tracks");
  }

  function closeCityModal() {
    if (!modal) {
      return;
    }
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  }

  function onDocumentKeyDown(event) {
    if (event.key === "Escape") {
      closeCityModal();
    }
  }
})();
