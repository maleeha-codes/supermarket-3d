// store.js - 3D Supermarket Architecture, Lighting, Fixtures, and Collisions
import * as THREE from 'three';

export class SupermarketStore {
  constructor(scene) {
    this.scene = scene;
    this.colliders = []; // AABB bounding boxes for movement collision
    this.interactables = []; // Products and checkout counter
    this.checkoutZone = null;
    this.sectionPositions = {}; // Coordinates for product shelves
    this.lights = [];

    // Store Dimensions
    this.width = 28;  // X from -14 to +14
    this.length = 38; // Z from -20 to +18
    this.height = 5.0; // Y from 0 to 5.0
  }

  build() {
    this.createMaterials();
    this.buildRoom();
    this.buildLighting();
    this.buildEntranceAndFront();
    this.buildGondolaAisles();
    this.buildProduceSection();
    this.buildFridgeSection();
    this.buildCheckoutCounter();
    this.buildCeilingSigns();
    this.buildDecorations();
    return this;
  }

  // --- Procedural Canvas Textures for realistic visuals without external asset lag ---
  createMaterials() {
    // 1. Polished Supermarket Floor Tile (Off-white / light beige porcelain tile with subtle reflection)
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 512;
    floorCanvas.height = 512;
    const fctx = floorCanvas.getContext('2d');
    fctx.fillStyle = '#eae7e1';
    fctx.fillRect(0, 0, 512, 512);

    // Subtle tile speckles / terrazzo noise
    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const gray = Math.floor(210 + Math.random() * 35);
      fctx.fillStyle = `rgb(${gray}, ${gray - 5}, ${gray - 10})`;
      fctx.fillRect(x, y, 2, 2);
    }

    // Grout grid (4 tiles per canvas repeat)
    fctx.strokeStyle = '#c5c0b8';
    fctx.lineWidth = 4;
    fctx.strokeRect(2, 2, 508, 508);
    fctx.beginPath();
    fctx.moveTo(256, 0); fctx.lineTo(256, 512);
    fctx.moveTo(0, 256); fctx.lineTo(512, 256);
    fctx.stroke();

    const floorTexture = new THREE.CanvasTexture(floorCanvas);
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(16, 22);

    this.floorMat = new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: 0.25,
      metalness: 0.08
    });

    // 2. Ceiling Tile Texture
    const ceilCanvas = document.createElement('canvas');
    ceilCanvas.width = 256;
    ceilCanvas.height = 256;
    const cctx = ceilCanvas.getContext('2d');
    cctx.fillStyle = '#f0f0f2';
    cctx.fillRect(0, 0, 256, 256);
    cctx.strokeStyle = '#a0a2a8';
    cctx.lineWidth = 5;
    cctx.strokeRect(2, 2, 252, 252);
    // Acoustic pin-hole dots
    cctx.fillStyle = '#d5d6db';
    for (let i = 0; i < 200; i++) {
      cctx.fillRect(Math.random() * 250, Math.random() * 250, 1.5, 1.5);
    }
    const ceilTexture = new THREE.CanvasTexture(ceilCanvas);
    ceilTexture.wrapS = THREE.RepeatWrapping;
    ceilTexture.wrapT = THREE.RepeatWrapping;
    ceilTexture.repeat.set(14, 19);

    this.ceilingMat = new THREE.MeshStandardMaterial({
      map: ceilTexture,
      roughness: 0.9,
      metalness: 0.0
    });

    // 3. Wall Material (Modern clean supermarket walls with green accent stripe)
    this.wallMat = new THREE.MeshStandardMaterial({
      color: 0xf5f6f8,
      roughness: 0.6,
      metalness: 0.05
    });

    // Shelf metal materials
    this.shelfMetalMat = new THREE.MeshStandardMaterial({
      color: 0x3a3f47,
      roughness: 0.4,
      metalness: 0.3
    });

    this.shelfBackboardMat = new THREE.MeshStandardMaterial({
      color: 0xe5e7eb,
      roughness: 0.5,
      metalness: 0.1
    });

    this.shelfPriceRailMat = new THREE.MeshStandardMaterial({
      color: 0x2563eb,
      roughness: 0.3,
      metalness: 0.1
    });

    this.woodMat = new THREE.MeshStandardMaterial({
      color: 0x8b5a2b,
      roughness: 0.7,
      metalness: 0.05
    });

    this.metalChromeMat = new THREE.MeshStandardMaterial({
      color: 0xd0d5dd,
      roughness: 0.2,
      metalness: 0.8
    });

    this.glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.35,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.8,
      ior: 1.5
    });
  }

  // --- Main Store Structure: Floor, Ceiling, Walls ---
  buildRoom() {
    // Floor
    const floorGeo = new THREE.PlaneGeometry(this.width, this.length);
    const floor = new THREE.Mesh(floorGeo, this.floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -1);
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Ceiling
    const ceilGeo = new THREE.PlaneGeometry(this.width, this.length);
    const ceil = new THREE.Mesh(ceilGeo, this.ceilingMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, this.height, -1);
    this.scene.add(ceil);

    // Walls
    const wallThick = 0.5;

    // Back wall (Z = -20)
    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(this.width, this.height, wallThick),
      this.wallMat
    );
    backWall.position.set(0, this.height / 2, -20);
    backWall.receiveShadow = true;
    this.scene.add(backWall);
    this.addCollider(new THREE.Box3().setFromObject(backWall));

    // Left wall (X = -14)
    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThick, this.height, this.length),
      this.wallMat
    );
    leftWall.position.set(-14, this.height / 2, -1);
    leftWall.receiveShadow = true;
    this.scene.add(leftWall);
    this.addCollider(new THREE.Box3().setFromObject(leftWall));

    // Right wall (X = +14)
    const rightWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThick, this.height, this.length),
      this.wallMat
    );
    rightWall.position.set(14, this.height / 2, -1);
    rightWall.receiveShadow = true;
    this.scene.add(rightWall);
    this.addCollider(new THREE.Box3().setFromObject(rightWall));

    // Front wall (Z = +18) with glass automatic doors
    // Left front solid wall
    const frontWallLeft = new THREE.Mesh(
      new THREE.BoxGeometry(10, this.height, wallThick),
      this.wallMat
    );
    frontWallLeft.position.set(-9, this.height / 2, 18);
    this.scene.add(frontWallLeft);
    this.addCollider(new THREE.Box3().setFromObject(frontWallLeft));

    // Right front solid wall
    const frontWallRight = new THREE.Mesh(
      new THREE.BoxGeometry(10, this.height, wallThick),
      this.wallMat
    );
    frontWallRight.position.set(9, this.height / 2, 18);
    this.scene.add(frontWallRight);
    this.addCollider(new THREE.Box3().setFromObject(frontWallRight));

    // Glass entrance frame in center (X: -4 to +4)
    const glassEntrance = new THREE.Mesh(
      new THREE.BoxGeometry(8, 3.2, 0.1),
      this.glassMat
    );
    glassEntrance.position.set(0, 1.6, 18);
    this.scene.add(glassEntrance);
    this.addCollider(new THREE.Box3().setFromObject(glassEntrance));

    // Entrance Header Mural ("SUPERMART 3D")
    const bannerCanvas = document.createElement('canvas');
    bannerCanvas.width = 1024;
    bannerCanvas.height = 128;
    const bctx = bannerCanvas.getContext('2d');
    bctx.fillStyle = '#10b981';
    bctx.fillRect(0, 0, 1024, 128);
    bctx.fillStyle = '#ffffff';
    bctx.font = 'bold 52px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    bctx.textAlign = 'center';
    bctx.textBaseline = 'middle';
    bctx.fillText('🛒 SUPERMART 3D • FRESH & QUALITY EVERY DAY', 512, 64);

    const bannerTex = new THREE.CanvasTexture(bannerCanvas);
    const bannerMat = new THREE.MeshBasicMaterial({ map: bannerTex });
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.0), bannerMat);
    banner.position.set(0, 4.0, 17.7);
    banner.rotation.y = Math.PI;
    this.scene.add(banner);

    // Decorative Supermarket Accent Border running high along top of walls
    this.buildWallBorders();
  }

  buildWallBorders() {
    const borderMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    // Back border
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(this.width, 0.4, 0.05), borderMat);
    b1.position.set(0, 4.3, -19.7);
    this.scene.add(b1);

    // Left border
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, this.length), borderMat);
    b2.position.set(-13.7, 4.3, -1);
    this.scene.add(b2);

    // Right border
    const b3 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, this.length), borderMat);
    b3.position.set(13.7, 4.3, -1);
    this.scene.add(b3);
  }

  // --- Lighting: Ambient, Directional + Troffer Strip Lights along aisles ---
  buildLighting() {
    // Ambient soft fill light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambientLight);

    // Main directional sunlight / skylight with soft shadows
    const dirLight = new THREE.DirectionalLight(0xfffbf2, 1.1);
    dirLight.position.set(6, 12, 6);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 40;
    dirLight.shadow.camera.left = -16;
    dirLight.shadow.camera.right = 16;
    dirLight.shadow.camera.top = 20;
    dirLight.shadow.camera.bottom = -20;
    dirLight.shadow.bias = -0.0005;
    this.scene.add(dirLight);

    // Secondary fill light from opposite corner
    const fillLight = new THREE.DirectionalLight(0xe8f0fe, 0.45);
    fillLight.position.set(-10, 10, -10);
    this.scene.add(fillLight);

    // Linear Fluorescent Troffer light fixtures hanging from ceiling
    const fixtureGeo = new THREE.BoxGeometry(0.5, 0.08, 3.2);
    const fixtureMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const housingMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.5 });

    const fixturePositions = [
      // Along Aisle 1
      { x: -7.5, z: 4 }, { x: -7.5, z: -2 }, { x: -7.5, z: -8 },
      // Along Aisle 2
      { x: -3.5, z: 4 }, { x: -3.5, z: -2 }, { x: -3.5, z: -8 },
      // Along Aisle 3
      { x: 1.0, z: 4 }, { x: 1.0, z: -2 }, { x: 1.0, z: -8 },
      // Along Aisle 4
      { x: 5.5, z: 4 }, { x: 5.5, z: -2 }, { x: 5.5, z: -8 },
      // Produce & Checkout
      { x: -11.0, z: -3 }, { x: -11.0, z: 3 },
      { x: 0, z: 12 }, { x: -4, z: 12 }, { x: 4, z: 12 }
    ];

    fixturePositions.forEach(pos => {
      // Housing
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.12, 3.28), housingMat);
      housing.position.set(pos.x, this.height - 0.06, pos.z);
      this.scene.add(housing);

      // Luminous diffuser tube
      const lightMesh = new THREE.Mesh(fixtureGeo, fixtureMat);
      lightMesh.position.set(pos.x, this.height - 0.11, pos.z);
      this.scene.add(lightMesh);

      // Local point light for warmth and soft realistic illumination
      const pointLight = new THREE.PointLight(0xfff8ee, 0.45, 11, 2);
      pointLight.position.set(pos.x, this.height - 0.35, pos.z);
      this.scene.add(pointLight);
    });
  }

  // --- Central Gondola Shelving Aisles ---
  buildGondolaAisles() {
    // 4 major gondola shelving aisles
    // Aisle 1: X = -5.5 (Left side: Aisle 1A Bakery/Snacks; Right side: Aisle 1B Chips/Pretzels)
    // Aisle 2: X = -1.5 (Left side: Aisle 2A Pasta/Sauce; Right side: Aisle 2B Canned Goods)
    // Aisle 3: X = +3.2 (Left side: Aisle 3A Soda/Water; Right side: Aisle 3B Juices/Teas)
    // Aisle 4: X = +7.8 (Left side: Aisle 4A Detergent/Soap; Right side: Aisle 4B Sprays/Cleaning)

    const aisleXCoords = [
      { x: -5.5, idA: 'aisle_1_A', idB: 'aisle_1_B' },
      { x: -1.5, idA: 'aisle_2_A', idB: 'aisle_2_B' },
      { x: 3.2,  idA: 'aisle_3_A', idB: 'aisle_3_B' },
      { x: 7.8,  idA: 'aisle_4_A', idB: 'aisle_4_B' }
    ];

    const aisleLength = 14.0;
    const aisleZCenter = -2.0; // from Z = -9 to Z = +5
    const gondolaHeight = 2.2;
    const shelfWidth = 1.1; // total thickness

    aisleXCoords.forEach(aisle => {
      this.createGondolaUnit(aisle.x, aisleZCenter, aisleLength, gondolaHeight, shelfWidth, aisle.idA, aisle.idB);
    });
  }

  createGondolaUnit(x, z, length, height, width, sectionIdLeft, sectionIdRight) {
    const group = new THREE.Group();

    // 1. Central Backboard / Pegboard divider
    const backboardGeo = new THREE.BoxGeometry(0.08, height, length);
    const backboard = new THREE.Mesh(backboardGeo, this.shelfBackboardMat);
    backboard.position.set(0, height / 2, 0);
    backboard.castShadow = true;
    backboard.receiveShadow = true;
    group.add(backboard);

    // 2. Base platform (bottom kickplate)
    const baseGeo = new THREE.BoxGeometry(width, 0.25, length);
    const baseMesh = new THREE.Mesh(baseGeo, this.shelfMetalMat);
    baseMesh.position.set(0, 0.125, 0);
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    group.add(baseMesh);

    // 3. Shelves at 3 distinct heights
    const shelfTiers = [0.45, 0.95, 1.45, 1.95];
    const shelfDepth = (width - 0.08) / 2; // ~0.51m on each side

    shelfTiers.forEach((tierY, tierIdx) => {
      // Left side shelf (facing -X)
      const shelfLeft = new THREE.Mesh(
        new THREE.BoxGeometry(shelfDepth, 0.04, length),
        this.shelfMetalMat
      );
      shelfLeft.position.set(-shelfDepth / 2 - 0.04, tierY, 0);
      shelfLeft.castShadow = true;
      shelfLeft.receiveShadow = true;
      group.add(shelfLeft);

      // Blue price tag rail strip on front edge
      const railLeft = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, 0.05, length),
        this.shelfPriceRailMat
      );
      railLeft.position.set(-shelfDepth - 0.04, tierY, 0);
      group.add(railLeft);

      // Right side shelf (facing +X)
      const shelfRight = new THREE.Mesh(
        new THREE.BoxGeometry(shelfDepth, 0.04, length),
        this.shelfMetalMat
      );
      shelfRight.position.set(shelfDepth / 2 + 0.04, tierY, 0);
      shelfRight.castShadow = true;
      shelfRight.receiveShadow = true;
      group.add(shelfRight);

      const railRight = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, 0.05, length),
        this.shelfPriceRailMat
      );
      railRight.position.set(shelfDepth + 0.04, tierY, 0);
      group.add(railRight);
    });

    // 4. End-cap displays at both ends
    [-length / 2, length / 2].forEach(endZ => {
      const endPost = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.04, height + 0.1, 0.15),
        this.shelfMetalMat
      );
      endPost.position.set(0, height / 2, endZ);
      group.add(endPost);

      // End-cap sale promotional sign
      const endSignCanvas = document.createElement('canvas');
      endSignCanvas.width = 256;
      endSignCanvas.height = 128;
      const sctx = endSignCanvas.getContext('2d');
      sctx.fillStyle = '#e11d48';
      sctx.fillRect(0, 0, 256, 128);
      sctx.fillStyle = '#ffffff';
      sctx.font = 'bold 30px sans-serif';
      sctx.textAlign = 'center';
      sctx.fillText('SPECIAL', 128, 48);
      sctx.font = 'bold 24px sans-serif';
      sctx.fillText('DEALS', 128, 86);

      const signTex = new THREE.CanvasTexture(endSignCanvas);
      const signMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(width * 0.9, 0.6),
        new THREE.MeshBasicMaterial({ map: signTex })
      );
      signMesh.position.set(0, height - 0.25, endZ + (endZ > 0 ? 0.09 : -0.09));
      if (endZ < 0) signMesh.rotation.y = Math.PI;
      group.add(signMesh);
    });

    group.position.set(x, 0, z);
    this.scene.add(group);

    // Register shelf coordinates for product placements
    // Left side faces -X; slots along Z from -5 to +5
    this.sectionPositions[sectionIdLeft] = {
      x: x - shelfDepth * 0.55 - 0.04,
      zCenter: z,
      length: length,
      facing: -1,
      tiers: shelfTiers
    };

    // Right side faces +X
    this.sectionPositions[sectionIdRight] = {
      x: x + shelfDepth * 0.55 + 0.04,
      zCenter: z,
      length: length,
      facing: 1,
      tiers: shelfTiers
    };

    // Add solid collision box for whole gondola aisle
    const box = new THREE.Box3(
      new THREE.Vector3(x - width / 2 - 0.1, 0, z - length / 2 - 0.1),
      new THREE.Vector3(x + width / 2 + 0.1, height, z + length / 2 + 0.1)
    );
    this.addCollider(box);
  }

  // --- Produce Section: Wooden Rustic Tables on Left Wall ---
  buildProduceSection() {
    const tablePositions = [
      { x: -10.5, z: 2.0, id: 'produce_table_1' },
      { x: -10.5, z: -6.0, id: 'produce_table_2' }
    ];

    tablePositions.forEach((pos, idx) => {
      const tableGroup = new THREE.Group();
      const tWidth = 2.4;
      const tLength = 5.0;
      const tHeight = 0.95;

      // Wooden sloped produce table base
      const tableBase = new THREE.Mesh(
        new THREE.BoxGeometry(tWidth, 0.8, tLength),
        this.woodMat
      );
      tableBase.position.set(0, 0.4, 0);
      tableBase.castShadow = true;
      tableBase.receiveShadow = true;
      tableGroup.add(tableBase);

      // Sloped green display trays for fruit crates
      const trayMat = new THREE.MeshStandardMaterial({ color: 0x2d6a4f, roughness: 0.8 });
      const tray1 = new THREE.Mesh(new THREE.BoxGeometry(tWidth * 0.95, 0.12, tLength * 0.44), trayMat);
      tray1.position.set(0, 0.86, -1.2);
      tray1.rotation.x = 0.12;
      tableGroup.add(tray1);

      const tray2 = new THREE.Mesh(new THREE.BoxGeometry(tWidth * 0.95, 0.12, tLength * 0.44), trayMat);
      tray2.position.set(0, 0.86, 1.2);
      tray2.rotation.x = -0.12;
      tableGroup.add(tray2);

      // Wooden produce sign above table
      const pSignCanvas = document.createElement('canvas');
      pSignCanvas.width = 512;
      pSignCanvas.height = 128;
      const pctx = pSignCanvas.getContext('2d');
      pctx.fillStyle = '#22543d';
      pctx.fillRect(0, 0, 512, 128);
      pctx.fillStyle = '#fef08a';
      pctx.font = 'bold 38px serif';
      pctx.textAlign = 'center';
      pctx.fillText(idx === 0 ? '🌿 FRESH FRUITS & PRODUCE' : '🥔 FARM VEGETABLES & GREENS', 256, 75);

      const pSignTex = new THREE.CanvasTexture(pSignCanvas);
      const signMesh = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 0.5, 0.05),
        new THREE.MeshStandardMaterial({ map: pSignTex })
      );
      signMesh.position.set(0, 1.8, 0);
      tableGroup.add(signMesh);

      // Stand poles for sign
      [-0.9, 0.9].forEach(px => {
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.02, 1.0),
          this.shelfMetalMat
        );
        pole.position.set(px, 1.3, 0);
        tableGroup.add(pole);
      });

      tableGroup.position.set(pos.x, 0, pos.z);
      this.scene.add(tableGroup);

      // Register section coordinates for fruit & vegetable items
      this.sectionPositions[pos.id] = {
        x: pos.x,
        zCenter: pos.z,
        length: tLength,
        facing: 1,
        tiers: [0.98, 1.05]
      };

      // Add collider
      const box = new THREE.Box3(
        new THREE.Vector3(pos.x - tWidth / 2 - 0.1, 0, pos.z - tLength / 2 - 0.1),
        new THREE.Vector3(pos.x + tWidth / 2 + 0.1, 1.5, pos.z + tLength / 2 + 0.1)
      );
      this.addCollider(box);
    });
  }

  // --- Fridge & Chilled Section: Back Wall Coolers ---
  buildFridgeSection() {
    // 3 large commercial upright coolers along back wall (Z = -19.2)
    const fridgeBankGroup = new THREE.Group();
    const coolerWidth = 5.2;
    const coolerHeight = 2.8;
    const coolerDepth = 1.3;

    const fridgeConfigs = [
      { x: -6.0, id: 'fridge_1', title: 'FRESH MILK (TAAZA / GOLD)' },
      { x: 0.0,  id: 'fridge_2', title: 'CURD, PANEER & BUTTER' },
      { x: 6.0,  id: 'fridge_3', title: 'CHEESE & MALAI PANEER' }
    ];

    fridgeConfigs.forEach(cfg => {
      const cooler = new THREE.Group();

      // Outer housing (brushed steel / black modern case)
      const caseMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.4, metalness: 0.5 });
      const coolerCase = new THREE.Mesh(
        new THREE.BoxGeometry(coolerWidth, coolerHeight, coolerDepth),
        caseMat
      );
      coolerCase.position.set(0, coolerHeight / 2, 0);
      cooler.add(coolerCase);

      // Glowing interior cavity (hollow front)
      const interiorMat = new THREE.MeshStandardMaterial({
        color: 0xf0fdfa,
        roughness: 0.3,
        emissive: 0x0ea5e9,
        emissiveIntensity: 0.08
      });
      const interior = new THREE.Mesh(
        new THREE.BoxGeometry(coolerWidth - 0.3, coolerHeight - 0.4, coolerDepth - 0.2),
        interiorMat
      );
      interior.position.set(0, coolerHeight / 2, 0.08);
      cooler.add(interior);

      // Glass front doors (3 door panes per cooler)
      const doorWidth = (coolerWidth - 0.3) / 3;
      for (let d = 0; d < 3; d++) {
        const dx = -coolerWidth / 2 + 0.3 / 2 + doorWidth / 2 + d * doorWidth;
        const glassPane = new THREE.Mesh(
          new THREE.BoxGeometry(doorWidth - 0.05, coolerHeight - 0.5, 0.04),
          this.glassMat
        );
        glassPane.position.set(dx, coolerHeight / 2, coolerDepth / 2 + 0.02);
        cooler.add(glassPane);

        // Chrome door handle
        const handle = new THREE.Mesh(
          new THREE.CylinderGeometry(0.018, 0.018, 0.6),
          this.metalChromeMat
        );
        handle.position.set(dx + doorWidth / 2 - 0.08, coolerHeight / 2, coolerDepth / 2 + 0.06);
        cooler.add(handle);
      }

      // Interior Cooler Shelves (at 3 heights)
      const coolerShelfMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.8 });
      const coolerTiers = [0.65, 1.25, 1.85];
      coolerTiers.forEach(ty => {
        const cShelf = new THREE.Mesh(
          new THREE.BoxGeometry(coolerWidth - 0.4, 0.03, coolerDepth - 0.3),
          coolerShelfMat
        );
        cShelf.position.set(0, ty, 0.05);
        cooler.add(cShelf);
      });

      // Top glowing canopy header with cooler title
      const headerCanvas = document.createElement('canvas');
      headerCanvas.width = 512;
      headerCanvas.height = 96;
      const hctx = headerCanvas.getContext('2d');
      hctx.fillStyle = '#0369a1';
      hctx.fillRect(0, 0, 512, 96);
      hctx.fillStyle = '#e0f2fe';
      hctx.font = 'bold 28px sans-serif';
      hctx.textAlign = 'center';
      hctx.fillText(`❄️ ${cfg.title}`, 256, 56);

      const hTex = new THREE.CanvasTexture(headerCanvas);
      const hSign = new THREE.Mesh(
        new THREE.PlaneGeometry(coolerWidth - 0.2, 0.4),
        new THREE.MeshBasicMaterial({ map: hTex })
      );
      hSign.position.set(0, coolerHeight - 0.25, coolerDepth / 2 + 0.03);
      cooler.add(hSign);

      // Cool white internal tube light inside fridge
      const fridgeLight = new THREE.PointLight(0xbbf7d0, 0.5, 5);
      fridgeLight.position.set(0, coolerHeight - 0.4, 0.2);
      cooler.add(fridgeLight);

      cooler.position.set(cfg.x, 0, -19.2);
      this.scene.add(cooler);

      // Register section for dairy items
      this.sectionPositions[cfg.id] = {
        x: cfg.x,
        zCenter: -19.2 + coolerDepth / 2 - 0.35,
        length: coolerWidth - 0.6,
        facing: 1, // items face forward towards +Z
        tiers: coolerTiers
      };

      // Add collider
      const box = new THREE.Box3(
        new THREE.Vector3(cfg.x - coolerWidth / 2 - 0.1, 0, -19.8),
        new THREE.Vector3(cfg.x + coolerWidth / 2 + 0.1, coolerHeight, -19.2 + coolerDepth / 2)
      );
      this.addCollider(box);
    });
  }

  // --- Front Billing / Checkout Counter ---
  buildCheckoutCounter() {
    const counterGroup = new THREE.Group();
    const cWidth = 8.0;
    const cDepth = 1.6;
    const cHeight = 0.95;

    // Checkout Desk structure
    const counterDeskMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.1 });
    const counterDesk = new THREE.Mesh(
      new THREE.BoxGeometry(cWidth, cHeight, cDepth),
      counterDeskMat
    );
    counterDesk.position.set(0, cHeight / 2, 0);
    counterDesk.castShadow = true;
    counterDesk.receiveShadow = true;
    counterGroup.add(counterDesk);

    // Conveyor Belt in center
    const beltMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 });
    const belt = new THREE.Mesh(
      new THREE.BoxGeometry(cWidth * 0.7, 0.04, cDepth * 0.65),
      beltMat
    );
    belt.position.set(0, cHeight + 0.02, 0);
    counterGroup.add(belt);

    // Barcode Scanner Glass window
    const scannerGlass = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.02, 0.6),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    scannerGlass.position.set(0.5, cHeight + 0.04, 0);
    counterGroup.add(scannerGlass);

    // Cash Register POS Touch Screen Terminal
    const screenGroup = new THREE.Group();
    const screenStand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.35),
      this.shelfMetalMat
    );
    screenStand.position.set(0, 0.175, 0);
    screenGroup.add(screenStand);

    // Screen display
    const screenCanvas = document.createElement('canvas');
    screenCanvas.width = 256;
    screenCanvas.height = 192;
    const sctx = screenCanvas.getContext('2d');
    sctx.fillStyle = '#0f172a';
    sctx.fillRect(0, 0, 256, 192);
    sctx.fillStyle = '#22c55e';
    sctx.font = 'bold 22px monospace';
    sctx.fillText('POS REGISTER #01', 15, 35);
    sctx.fillStyle = '#94a3b8';
    sctx.font = '16px monospace';
    sctx.fillText('STATUS: READY', 15, 65);
    sctx.fillText('READY TO SCAN', 15, 95);
    sctx.fillStyle = '#38bdf8';
    sctx.font = 'bold 20px monospace';
    sctx.fillText('PRESS [E] / TAP', 15, 145);
    sctx.fillText('TO CHECKOUT', 15, 172);

    const screenTex = new THREE.CanvasTexture(screenCanvas);
    const screenDisplay = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.35, 0.05),
      new THREE.MeshBasicMaterial({ map: screenTex })
    );
    screenDisplay.position.set(0, 0.42, 0);
    screenDisplay.rotation.x = -0.25;
    screenGroup.add(screenDisplay);

    screenGroup.position.set(1.4, cHeight, 0.2);
    counterGroup.add(screenGroup);

    // Overhead Cashier Light & Sign Pole ("CHECKOUT 1 - OPEN")
    const signPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 2.4),
      this.metalChromeMat
    );
    signPole.position.set(-2.8, 1.2 + cHeight, 0);
    counterGroup.add(signPole);

    const laneSignCanvas = document.createElement('canvas');
    laneSignCanvas.width = 256;
    laneSignCanvas.height = 128;
    const lsctx = laneSignCanvas.getContext('2d');
    lsctx.fillStyle = '#15803d';
    lsctx.fillRect(0, 0, 256, 128);
    lsctx.fillStyle = '#ffffff';
    lsctx.font = 'bold 44px sans-serif';
    lsctx.textAlign = 'center';
    lsctx.fillText('LANE 1', 128, 55);
    lsctx.font = 'bold 24px sans-serif';
    lsctx.fillStyle = '#86efac';
    lsctx.fillText('● OPEN', 128, 95);

    const laneSignTex = new THREE.CanvasTexture(laneSignCanvas);
    const laneSign = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.5, 0.06),
      new THREE.MeshBasicMaterial({ map: laneSignTex })
    );
    laneSign.position.set(-2.8, cHeight + 2.3, 0);
    counterGroup.add(laneSign);

    // Glowing green beacon ring on floor marking checkout interaction spot
    const ringGeo = new THREE.RingGeometry(1.2, 1.45, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75
    });
    const beaconRing = new THREE.Mesh(ringGeo, ringMat);
    beaconRing.rotation.x = -Math.PI / 2;
    beaconRing.position.set(0, 0.02, 1.6);
    counterGroup.add(beaconRing);

    counterGroup.position.set(0, 0, 12.0);
    this.scene.add(counterGroup);

    // Register Checkout trigger zone
    this.checkoutZone = {
      position: new THREE.Vector3(0, 0.5, 13.5),
      radius: 2.8,
      deskMesh: counterDesk
    };

    // Add collider
    const box = new THREE.Box3(
      new THREE.Vector3(-cWidth / 2 - 0.1, 0, 12.0 - cDepth / 2 - 0.1),
      new THREE.Vector3(cWidth / 2 + 0.1, cHeight + 0.5, 12.0 + cDepth / 2 + 0.1)
    );
    this.addCollider(box);
  }

  // --- Overhead Hanging Aisle Signboards ---
  buildCeilingSigns() {
    const signs = [
      { text: 'Aisle 1 • Snacks & Biscuits',    x: -5.5, z: 2.0, color: '#ea580c' },
      { text: 'Aisle 2 • Staples & Grains',      x: -1.5, z: 2.0, color: '#ca8a04' },
      { text: 'Aisle 3 • Cold Drinks & Juices',  x: 3.2,  z: 2.0, color: '#0284c7' },
      { text: 'Aisle 4 • Household & Cleaning',  x: 7.8,  z: 2.0, color: '#16a34a' },
      { text: 'Produce • Fruits & Vegetables',   x: -10.5, z: -2.0, color: '#15803d' }
    ];

    signs.forEach(s => {
      const signCanvas = document.createElement('canvas');
      signCanvas.width = 512;
      signCanvas.height = 160;
      const sctx = signCanvas.getContext('2d');

      // Rounded banner background
      sctx.fillStyle = s.color;
      sctx.fillRect(0, 0, 512, 160);

      // Border
      sctx.strokeStyle = '#ffffff';
      sctx.lineWidth = 6;
      sctx.strokeRect(6, 6, 500, 148);

      // Title
      sctx.fillStyle = '#ffffff';
      sctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      sctx.textAlign = 'center';
      sctx.textBaseline = 'middle';
      sctx.fillText(s.text, 256, 80);

      const signTex = new THREE.CanvasTexture(signCanvas);
      const signMat = new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide });
      const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.75), signMat);
      signMesh.position.set(s.x, 3.6, s.z);
      this.scene.add(signMesh);

      // Suspension cables from ceiling (Y: 3.6 to 5.0)
      [-1.0, 1.0].forEach(cableX => {
        const cableGeo = new THREE.CylinderGeometry(0.008, 0.008, 1.4);
        const cable = new THREE.Mesh(cableGeo, this.metalChromeMat);
        cable.position.set(s.x + cableX, 4.3, s.z);
        this.scene.add(cable);
      });
    });
  }

  // --- Decorative Elements: Carts Corral, Plants, Floor Decals ---
  buildEntranceAndFront() {
    // Shopping Cart Corral at entrance (X: 6.5, Z: 15)
    const corralGroup = new THREE.Group();
    const railMat = this.metalChromeMat;

    // Guard rails
    const rail1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.9, 3.5), railMat);
    rail1.position.set(0, 0.45, 0);
    corralGroup.add(rail1);

    const rail2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.9, 3.5), railMat);
    rail2.position.set(1.4, 0.45, 0);
    corralGroup.add(rail2);

    // Chrome nested shopping carts in corral
    for (let i = 0; i < 4; i++) {
      const cart = this.createShoppingCartMesh();
      cart.position.set(0.7, 0, -1.2 + i * 0.75);
      corralGroup.add(cart);
    }

    corralGroup.position.set(6.5, 0, 15.0);
    this.scene.add(corralGroup);

    // Collider for cart corral
    const box = new THREE.Box3(
      new THREE.Vector3(6.5 - 0.2, 0, 15.0 - 1.8),
      new THREE.Vector3(6.5 + 1.6, 1.0, 15.0 + 1.8)
    );
    this.addCollider(box);

    // Entrance Floor Mat
    const matCanvas = document.createElement('canvas');
    matCanvas.width = 512;
    matCanvas.height = 256;
    const mctx = matCanvas.getContext('2d');
    mctx.fillStyle = '#1e293b';
    mctx.fillRect(0, 0, 512, 256);
    mctx.strokeStyle = '#f59e0b';
    mctx.lineWidth = 10;
    mctx.strokeRect(8, 8, 496, 240);
    mctx.fillStyle = '#ffffff';
    mctx.font = 'bold 36px sans-serif';
    mctx.textAlign = 'center';
    mctx.fillText('WELCOME TO SUPERMART', 256, 110);
    mctx.fillStyle = '#f59e0b';
    mctx.font = '22px sans-serif';
    mctx.fillText('ENJOY YOUR 3D SHOPPING EXPERIENCE', 256, 160);

    const matTex = new THREE.CanvasTexture(matCanvas);
    const floorMatMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(5.0, 2.5),
      new THREE.MeshStandardMaterial({ map: matTex, roughness: 0.9 })
    );
    floorMatMesh.rotation.x = -Math.PI / 2;
    floorMatMesh.position.set(0, 0.015, 16.2);
    this.scene.add(floorMatMesh);
  }

  // Helper: Chrome Shopping Cart 3D Model
  createShoppingCartMesh() {
    const cart = new THREE.Group();
    const basketMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.85,
      roughness: 0.2,
      wireframe: true
    });

    // Wire basket
    const basket = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.5, 0.85),
      basketMat
    );
    basket.position.set(0, 0.65, 0);
    cart.add(basket);

    // Red plastic handle
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 });
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.65),
      handleMat
    );
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0, 0.95, -0.42);
    cart.add(handle);

    // Frame legs
    const legMat = this.metalChromeMat;
    [-0.28, 0.28].forEach(lx => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.55, 0.75), legMat);
      leg.position.set(lx, 0.3, 0);
      cart.add(leg);
    });

    // 4 Wheels
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.9 });
    const wheelPositions = [
      [-0.28, 0.06, 0.35], [0.28, 0.06, 0.35],
      [-0.28, 0.06, -0.35], [0.28, 0.06, -0.35]
    ];
    wheelPositions.forEach(wp => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 12), wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wp[0], wp[1], wp[2]);
      cart.add(wheel);
    });

    return cart;
  }

  buildDecorations() {
    // Decorative potted indoor plants at corners
    const plantLocations = [
      { x: -12.5, z: 16.5 },
      { x: 12.5,  z: 16.5 },
      { x: -12.5, z: -18.5 },
      { x: 12.5,  z: -18.5 }
    ];

    const potMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.7 });

    plantLocations.forEach(loc => {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.25, 0.7, 16), potMat);
      pot.position.set(loc.x, 0.35, loc.z);
      this.scene.add(pot);

      for (let i = 0; i < 5; i++) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), leafMat);
        leaf.scale.set(1.2, 0.5, 0.6);
        leaf.position.set(
          loc.x + (Math.random() - 0.5) * 0.3,
          0.85 + i * 0.12,
          loc.z + (Math.random() - 0.5) * 0.3
        );
        this.scene.add(leaf);
      }

      this.addCollider(new THREE.Box3(
        new THREE.Vector3(loc.x - 0.4, 0, loc.z - 0.4),
        new THREE.Vector3(loc.x + 0.4, 1.2, loc.z + 0.4)
      ));
    });
  }

  // Helper to add collision box
  addCollider(box3) {
    this.colliders.push(box3);
  }
}
