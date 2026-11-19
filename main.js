// main.js - Professional 3D Supermarket: Attached Trolley, Push-Out Collision, Drag Look, INR Flow & Mobile Controls
import * as THREE from 'three';
import { SupermarketStore } from './store.js';
import { ShoppingCart, UIManager, formatINR } from './ui.js';

class SupermarketApp {
  constructor() {
    this.container = document.body;
    this.products = [];
    this.productMeshes = [];
    this.pickupAnimations = [];

    // Collision & Movement Constants
    this.playerRadius = 0.45;
    this.playerHeight = 1.68; // Eye level in meters
    this.playerVelocity = new THREE.Vector3();
    this.moveSpeed = 3.6; // Realistic walking pace (m/s)
    this.sprintMultiplier = 1.35;
    this.friction = 7.5; // Smooth deceleration

    // Movement flags (Keyboard + Mobile Joystick)
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.isSprinting = false;

    this.dpadForward = false;
    this.dpadBackward = false;
    this.dpadLeft = false;
    this.dpadRight = false;

    this.mobileMoveVector = { x: 0, y: 0 };

    // Camera Rotation via Drag (NO Pointer Lock required)
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.isMouseDown = false;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.lastDragX = 0;
    this.lastDragY = 0;
    this.dragDist = 0;

    // Mouse coordinates for cursor raycasting
    this.mouseCoords = new THREE.Vector2(-100, -100);
    this.mouseScreenX = 0;
    this.mouseScreenY = 0;

    this.hoveredProduct = null;
    this.hoveredMeshGroup = null;
    this.headBobTimer = 0;

    // Raycaster
    this.raycaster = new THREE.Raycaster();

    // Cart & UI Manager
    this.cart = new ShoppingCart();
    this.ui = new UIManager(this.cart, (reset) => {
      if (reset) {
        this.resetStoreProducts();
        this.clearTrolleyItems();
      }
    });

    this.initThree();
    this.initStore();
    this.createViewmodelTrolley();
    this.initControls();
    this.loadProducts();
    this.animate();
  }

  initThree() {
    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e1726);
    this.scene.fog = new THREE.FogExp2(0x0e1726, 0.012);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    // Start player near entrance facing the supermarket aisles
    this.camera.position.set(0, this.playerHeight, 15.5);
    this.camera.rotation.y = Math.PI; // Face towards aisles (-Z)
    this.euler.set(0, Math.PI, 0, 'YXZ');

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.id = 'canvas3d';
    document.body.prepend(this.renderer.domElement);

    // Clock
    this.clock = new THREE.Clock();

    // Window Resize
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    });
  }

  initStore() {
    this.store = new SupermarketStore(this.scene).build();
  }

  // --- 3D First-Person Viewmodel Shopping Trolley (Attached in front of player) ---
  createViewmodelTrolley() {
    const group = new THREE.Group();
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xd4d4d8,
      metalness: 0.85,
      roughness: 0.2
    });
    const wireMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.85,
      roughness: 0.25,
      wireframe: true
    });
    const handleMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.35
    });

    // Wire Basket
    const basket = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.30, 0.58), wireMat);
    basket.position.set(0, 0, 0);
    group.add(basket);
    this.trolleyBasket = basket;

    // Basket Top Chrome Rim
    const rim = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.02, 0.60), chromeMat);
    rim.position.set(0, 0.15, 0);
    group.add(rim);

    // Red Push Handle Bar
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.46), handleMat);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0, 0.22, 0.30);
    group.add(handle);

    // Chrome handle support struts
    [-0.21, 0.21].forEach(hx => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.20), chromeMat);
      post.position.set(hx, 0.10, 0.26);
      post.rotation.x = -0.32;
      group.add(post);
    });

    // Bottom chassis tray & wheels
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.52), chromeMat);
    chassis.position.set(0, -0.25, 0);
    group.add(chassis);

    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.8 });
    [[-0.19, -0.30, 0.22], [0.19, -0.30, 0.22], [-0.19, -0.30, -0.22], [0.19, -0.30, -0.22]].forEach(wp => {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.02, 12), wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(wp[0], wp[1], wp[2]);
      group.add(w);
    });

    // Group for small 3D items visually stacked inside the basket
    this.trolleyItemsGroup = new THREE.Group();
    this.trolleyItemsGroup.position.set(0, -0.05, 0);
    group.add(this.trolleyItemsGroup);

    // Position in front-right of the player camera
    group.position.set(0.35, -0.35, -0.72);
    group.rotation.set(0.05, -0.12, 0);

    this.trolleyViewmodel = group;
    this.camera.add(group);
    this.scene.add(this.camera);
  }

  clearTrolleyItems() {
    if (this.trolleyItemsGroup) {
      while (this.trolleyItemsGroup.children.length > 0) {
        this.trolleyItemsGroup.remove(this.trolleyItemsGroup.children[0]);
      }
    }
  }

  // --- Stacking mini 3D items in the trolley basket (supports 36+ items) ---
  stackItemInTrolley(product) {
    if (!this.trolleyItemsGroup) return;

    const count = this.trolleyItemsGroup.children.length;
    if (count >= 36) return;

    // 3 x 3 slots per layer in the basket
    const slotX = (count % 3) - 1; // -1, 0, 1
    const slotZ = (Math.floor(count / 3) % 3) - 1; // -1, 0, 1
    const layer = Math.floor(count / 9);

    const posX = slotX * 0.11 + (Math.random() - 0.5) * 0.03;
    const posZ = slotZ * 0.14 + (Math.random() - 0.5) * 0.03;
    const posY = -0.10 + layer * 0.065 + Math.random() * 0.01;

    const mini = this.createMiniProductMesh(product);
    mini.position.set(posX, posY, posZ);
    mini.rotation.set(
      (Math.random() - 0.5) * 0.25,
      Math.random() * Math.PI * 2,
      (Math.random() - 0.5) * 0.25
    );

    this.trolleyItemsGroup.add(mini);
  }

  createMiniProductMesh(product) {
    const group = new THREE.Group();
    const color = new THREE.Color(product.color || '#3b82f6');
    const mat = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.35,
      metalness: 0.15
    });

    if (product.shape?.includes('fruit')) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 10), mat);
      group.add(s);
    } else if (product.shape === 'bottle') {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.07, 10), mat);
      group.add(b);
    } else {
      const bx = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.045, 0.055), mat);
      group.add(bx);
    }
    return group;
  }

  // --- Controls & Drag-To-Look Setup (No Pointer Lock) ---
  initControls() {
    // 1. Mobile Dual-Touch Controls (Virtual Joystick + Touch-Look Zone)
    this.ui.setupMobileControls({
      onMove: (vec) => {
        this.mobileMoveVector = vec;
      },
      onLook: (dx, dy) => {
        this.euler.y -= dx * 0.0036;
        this.euler.x -= dy * 0.0036;
        this.euler.x = Math.max(-Math.PI / 2.15, Math.min(Math.PI / 2.15, this.euler.x));
        this.camera.quaternion.setFromEuler(this.euler);
      },
      onPickTap: (clientX, clientY) => {
        this.tryPickUpAtScreen(clientX, clientY);
      }
    });

    // 2. Optional On-Screen D-Pad Buttons
    this.ui.setupDpadControls((dpad) => {
      this.dpadForward = dpad.forward;
      this.dpadBackward = dpad.backward;
      this.dpadLeft = dpad.left;
      this.dpadRight = dpad.right;
    });

    // 3. Mouse Drag Look & Free Cursor Raycasting
    const canvas = this.renderer.domElement;

    const isInteractiveUI = (target) => {
      return !!target.closest(
        '#cart-drawer, .modal-overlay, .cart-btn, .help-btn, #sound-btn, #mini-cart-container, #instructions-overlay, #joystick-boundary, #zone-prompt'
      );
    };

    window.addEventListener('pointerdown', (e) => {
      if (isInteractiveUI(e.target)) return;

      this.isMouseDown = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.lastDragX = e.clientX;
      this.lastDragY = e.clientY;
      this.dragDist = 0;
      this.isDragging = false;
    });

    window.addEventListener('pointermove', (e) => {
      this.mouseScreenX = e.clientX;
      this.mouseScreenY = e.clientY;
      this.mouseCoords.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouseCoords.y = -(e.clientY / window.innerHeight) * 2 + 1;

      if (this.isMouseDown) {
        const dx = e.clientX - this.lastDragX;
        const dy = e.clientY - this.lastDragY;
        this.dragDist += Math.abs(dx) + Math.abs(dy);

        // If dragged more than 8px, enter looking mode
        if (this.dragDist > 8) {
          this.isDragging = true;
          canvas.classList.add('dragging');

          this.euler.y -= dx * 0.0032;
          this.euler.x -= dy * 0.0032;

          // Clamp pitch (-85 to +85 degrees)
          this.euler.x = Math.max(-Math.PI / 2.15, Math.min(Math.PI / 2.15, this.euler.x));
          this.camera.quaternion.setFromEuler(this.euler);
        }

        this.lastDragX = e.clientX;
        this.lastDragY = e.clientY;
      }
    });

    const endPointer = (e) => {
      canvas.classList.remove('dragging');

      // If clicked without dragging, pick up hovered product
      if (this.isMouseDown && !this.isDragging && e) {
        if (!isInteractiveUI(e.target)) {
          this.tryPickUpHovered();
        }
      }

      this.isMouseDown = false;
      this.isDragging = false;
    };

    window.addEventListener('pointerup', endPointer);
    window.addEventListener('pointercancel', () => {
      canvas.classList.remove('dragging');
      this.isMouseDown = false;
      this.isDragging = false;
    });
    window.addEventListener('blur', () => {
      canvas.classList.remove('dragging');
      this.isMouseDown = false;
      this.isDragging = false;
    });

    // 4. Keyboard controls (WASD / Arrows)
    window.addEventListener('keydown', (e) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.moveForward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.moveBackward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.moveLeft = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.moveRight = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.isSprinting = true;
          break;
        case 'KeyC':
          this.ui.openCart();
          break;
        case 'KeyE':
          this.handleInteractionKey();
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.moveForward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.moveBackward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.moveLeft = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.moveRight = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.isSprinting = false;
          break;
      }
    });

    // Checkout Zone click handler
    const zonePrompt = document.getElementById('zone-prompt');
    if (zonePrompt) {
      zonePrompt.addEventListener('click', () => {
        this.handleInteractionKey();
      });
    }
  }

  handleInteractionKey() {
    if (this.isPlayerInCheckoutZone()) {
      this.ui.openCheckout();
    }
  }

  isPlayerInCheckoutZone() {
    if (!this.store.checkoutZone) return false;
    const pPos = new THREE.Vector2(this.camera.position.x, this.camera.position.z);
    const zPos = new THREE.Vector2(this.store.checkoutZone.position.x, this.store.checkoutZone.position.z);
    return pPos.distanceTo(zPos) <= this.store.checkoutZone.radius;
  }

  // --- Load Products and Populate 3D Shelves ---
  async loadProducts() {
    this.ui.setLoadingProgress(25, 'Building supermarket aisles...');
    await new Promise(r => setTimeout(r, 200));

    try {
      this.ui.setLoadingProgress(50, 'Loading Indian grocery catalog...');
      const res = await fetch('./products.json');
      if (!res.ok) throw new Error('Fetch failed');
      this.products = await res.json();
    } catch (e) {
      console.warn('Loading bundled catalog fallback.', e);
      this.products = this.getBundledProductsFallback();
    }

    this.ui.setLoadingProgress(75, 'Stocking shelves with products (INR)...');
    await new Promise(r => setTimeout(r, 200));
    this.spawnProductsOnShelves();

    this.ui.setLoadingProgress(95, 'Preparing supermarket lighting...');
    await new Promise(r => setTimeout(r, 200));

    this.ui.setLoadingProgress(100, 'Ready to shop!');
    await new Promise(r => setTimeout(r, 300));
    this.ui.hideLoadingScreen();
  }

  // --- Procedural 3D Mesh Generator for Indian Products ---
  createProductMesh(product) {
    const group = new THREE.Group();
    group.userData = { product: product, isProduct: true };

    const color = new THREE.Color(product.color || '#3b82f6');
    const accent = new THREE.Color(product.accentColor || '#ffffff');

    // Generate packaging label canvas with Indian Rupee price
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 256;
    labelCanvas.height = 256;
    const lctx = labelCanvas.getContext('2d');
    lctx.fillStyle = product.color || '#2563eb';
    lctx.fillRect(0, 0, 256, 256);

    // Brand ribbon
    lctx.fillStyle = product.accentColor || '#ffffff';
    lctx.fillRect(0, 25, 256, 55);

    // Brand Name
    lctx.fillStyle = '#0f172a';
    lctx.font = 'bold 26px -apple-system, sans-serif';
    lctx.textAlign = 'center';
    lctx.fillText(product.brand || 'SuperMart', 128, 62);

    // Product Title
    lctx.fillStyle = '#ffffff';
    lctx.font = 'bold 24px -apple-system, sans-serif';
    lctx.fillText(product.label || product.name, 128, 135);

    // Green Vegetarian Mark
    lctx.strokeStyle = '#16a34a';
    lctx.lineWidth = 3;
    lctx.strokeRect(20, 185, 30, 30);
    lctx.fillStyle = '#16a34a';
    lctx.beginPath();
    lctx.arc(35, 200, 7, 0, Math.PI * 2);
    lctx.fill();

    // Price badge in INR (₹)
    lctx.fillStyle = '#f59e0b';
    lctx.fillRect(65, 180, 175, 42);
    lctx.fillStyle = '#000000';
    lctx.font = 'bold 23px sans-serif';
    lctx.fillText(`₹${Math.round(product.price)}`, 152, 210);

    const labelTex = new THREE.CanvasTexture(labelCanvas);

    const boxMat = [
      new THREE.MeshStandardMaterial({ color, roughness: 0.4 }),
      new THREE.MeshStandardMaterial({ color, roughness: 0.4 }),
      new THREE.MeshStandardMaterial({ color: accent, roughness: 0.3 }),
      new THREE.MeshStandardMaterial({ color, roughness: 0.4 }),
      new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.3 }),
      new THREE.MeshStandardMaterial({ color, roughness: 0.4 })
    ];

    const shinyMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.25,
      metalness: 0.15
    });

    switch (product.shape) {
      case 'fruit_banana': {
        const bGroup = new THREE.Group();
        for (let i = 0; i < 3; i++) {
          const bananaGeo = new THREE.TorusGeometry(0.12, 0.038, 8, 16, Math.PI * 0.7);
          const banana = new THREE.Mesh(bananaGeo, new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35 }));
          banana.rotation.z = -Math.PI / 3 + (i - 1) * 0.25;
          banana.position.set((i - 1) * 0.05, 0.06, (i - 1) * 0.03);
          bGroup.add(banana);
        }
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.06), new THREE.MeshStandardMaterial({ color: 0x4a2810 }));
        stem.position.set(0, 0.14, 0);
        bGroup.add(stem);
        group.add(bGroup);
        break;
      }
      case 'fruit_apple': {
        const apple = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 16), new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.25 }));
        apple.scale.set(1.0, 0.92, 1.0);
        group.add(apple);
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.05), new THREE.MeshStandardMaterial({ color: 0x3d2008 }));
        stem.position.y = 0.11;
        group.add(stem);
        break;
      }
      case 'fruit_tomato': {
        const tomato = new THREE.Mesh(new THREE.SphereGeometry(0.10, 16, 16), new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 }));
        tomato.scale.set(1.1, 0.88, 1.1);
        group.add(tomato);
        const calyx = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.02, 5), new THREE.MeshStandardMaterial({ color: 0x16a34a }));
        calyx.position.y = 0.09;
        group.add(calyx);
        break;
      }
      case 'fruit_onion': {
        const onion = new THREE.Mesh(new THREE.SphereGeometry(0.10, 14, 14), new THREE.MeshStandardMaterial({ color: 0xc084fc, roughness: 0.6 }));
        onion.scale.set(1.0, 1.15, 1.0);
        group.add(onion);
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.04, 8), new THREE.MeshStandardMaterial({ color: 0x7e22ce }));
        tip.position.y = 0.12;
        group.add(tip);
        break;
      }
      case 'fruit_potato': {
        const potato = new THREE.Mesh(new THREE.SphereGeometry(0.10, 14, 14), new THREE.MeshStandardMaterial({ color: 0xca8a04, roughness: 0.85 }));
        potato.scale.set(1.25, 0.85, 0.95);
        potato.position.y = 0.05;
        group.add(potato);
        break;
      }
      case 'bag': {
        const bag = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.28, 0.08), boxMat);
        bag.position.y = 0.14;
        group.add(bag);
        break;
      }
      case 'biscuit': {
        const bis = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.10), boxMat);
        bis.position.y = 0.06;
        group.add(bis);
        break;
      }
      case 'chocolate_bar': {
        const choco = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.24, 0.03), boxMat);
        choco.position.y = 0.12;
        group.add(choco);
        break;
      }
      case 'sack': {
        const sack = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.42, 0.20), boxMat);
        sack.position.y = 0.21;
        sack.castShadow = true;
        group.add(sack);
        break;
      }
      case 'pouch': {
        const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.26, 0.09), boxMat);
        pouch.position.y = 0.13;
        group.add(pouch);
        break;
      }
      case 'tub': {
        const tub = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.08, 0.14, 16), shinyMat);
        tub.position.y = 0.07;
        group.add(tub);
        const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.02, 16), new THREE.MeshStandardMaterial({ color: accent }));
        lid.position.y = 0.14;
        group.add(lid);
        break;
      }
      case 'block': {
        const blk = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.11, 0.13), boxMat);
        blk.position.y = 0.055;
        group.add(blk);
        break;
      }
      case 'butter_box': {
        const btr = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.10, 0.11), boxMat);
        btr.position.y = 0.05;
        group.add(btr);
        break;
      }
      case 'bottle': {
        const bottleBody = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.28, 16), shinyMat);
        bottleBody.position.y = 0.14;
        group.add(bottleBody);
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.065, 0.08, 16), shinyMat);
        neck.position.y = 0.31;
        group.add(neck);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 16), new THREE.MeshStandardMaterial({ color: accent }));
        cap.position.y = 0.36;
        group.add(cap);
        break;
      }
      case 'carton': {
        const tetra = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.28, 0.11), boxMat);
        tetra.position.y = 0.14;
        group.add(tetra);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 12), new THREE.MeshStandardMaterial({ color: accent }));
        cap.position.set(0.03, 0.29, 0);
        group.add(cap);
        break;
      }
      case 'soap_bar': {
        const soap = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.10), boxMat);
        soap.position.y = 0.04;
        group.add(soap);
        break;
      }
      case 'toothpaste_box': {
        const paste = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.09, 0.07), boxMat);
        paste.position.y = 0.045;
        group.add(paste);
        break;
      }
      case 'box':
      default: {
        const bx = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.13), boxMat);
        bx.position.y = 0.16;
        bx.castShadow = true;
        group.add(bx);
        break;
      }
    }

    group.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    return group;
  }

  // --- Place products to fill every rack and shelf with 6-10 items per row ---
  spawnProductsOnShelves() {
    this.productMeshes = [];

    this.products.forEach(product => {
      const sec = this.store.sectionPositions[product.section];
      if (!sec) return;

      const tierY = sec.tiers[product.shelfTier || 0] || 0.8;
      const count = product.itemsPerRow || 8;

      // Produce tables
      if (product.section.includes('produce_table')) {
        const spanZ = 3.6;
        const spacingZ = spanZ / (count - 1);
        const posX = sec.x + (product.slot === 0 ? -0.45 : 0.45);

        for (let i = 0; i < count; i++) {
          const mesh = this.createProductMesh(product);
          const posZ = sec.zCenter - spanZ / 2 + i * spacingZ;
          mesh.position.set(posX, tierY, posZ);
          this.scene.add(mesh);
          this.productMeshes.push(mesh);
        }
        return;
      }

      // Fridge coolers
      if (product.section.includes('fridge')) {
        const spanX = sec.length * 0.85;
        const spacingX = spanX / (count - 1);

        for (let i = 0; i < count; i++) {
          const mesh = this.createProductMesh(product);
          const posX = sec.x - spanX / 2 + i * spacingX;
          const posZ = sec.zCenter;
          mesh.position.set(posX, tierY, posZ);
          mesh.rotation.y = 0;
          this.scene.add(mesh);
          this.productMeshes.push(mesh);
        }
        return;
      }

      // Gondola Aisle Shelves
      const spanZ = 10.0;
      const spacingZ = spanZ / (count - 1);
      const depthLayers = 2;

      for (let d = 0; d < depthLayers; d++) {
        const depthOffset = (d === 0 ? 0 : (sec.facing === 1 ? -0.16 : 0.16));

        for (let i = 0; i < count; i++) {
          const mesh = this.createProductMesh(product);
          const posZ = sec.zCenter - spanZ / 2 + i * spacingZ;
          const posX = sec.x + depthOffset;
          const posY = tierY + 0.02;

          mesh.position.set(posX, posY, posZ);

          if (sec.facing === 1) {
            mesh.rotation.y = Math.PI / 2;
          } else {
            mesh.rotation.y = -Math.PI / 2;
          }

          this.scene.add(mesh);
          this.productMeshes.push(mesh);
        }
      }
    });
  }

  resetStoreProducts() {
    this.productMeshes.forEach(mesh => this.scene.remove(mesh));
    this.spawnProductsOnShelves();
  }

  // --- Raycasting & Product Hover Interaction under Mouse Cursor ---
  updateRaycasting() {
    this.raycaster.setFromCamera(this.mouseCoords, this.camera);
    const intersects = this.raycaster.intersectObjects(this.productMeshes, true);

    let foundProduct = null;
    let foundMeshGroup = null;

    if (intersects.length > 0) {
      const hit = intersects[0];
      // Comfortable reach of up to 3.5 meters
      if (hit.distance <= 3.5) {
        let parent = hit.object;
        while (parent && !parent.userData?.isProduct) {
          parent = parent.parent;
        }
        if (parent && parent.userData?.product) {
          foundProduct = parent.userData.product;
          foundMeshGroup = parent;
        }
      }
    }

    if (foundProduct && foundMeshGroup) {
      if (this.hoveredProduct !== foundProduct || this.hoveredMeshGroup !== foundMeshGroup) {
        this.clearProductHighlight();
        this.hoveredProduct = foundProduct;
        this.hoveredMeshGroup = foundMeshGroup;
        this.highlightProductMesh(foundMeshGroup);
        this.ui.showProductHover(foundProduct, this.mouseScreenX, this.mouseScreenY);
      }
    } else {
      if (this.hoveredProduct) {
        this.clearProductHighlight();
        this.hoveredProduct = null;
        this.hoveredMeshGroup = null;
        this.ui.hideProductHover();
      }
    }

    // Proximity to checkout counter zone
    if (this.isPlayerInCheckoutZone()) {
      this.ui.showZonePrompt('Checkout Counter (Ready to Pay)', 'E');
    } else {
      this.ui.hideZonePrompt();
    }
  }

  highlightProductMesh(group) {
    group.traverse(child => {
      if (child.isMesh && child.material) {
        if (!child.userData.originalEmissive) {
          child.userData.originalEmissive = child.material.emissive ? child.material.emissive.clone() : new THREE.Color(0, 0, 0);
        }
        if (child.material.emissive) {
          child.material.emissive.setHex(0x22d3ee);
        }
      }
    });
  }

  clearProductHighlight() {
    if (!this.hoveredMeshGroup) return;
    this.hoveredMeshGroup.traverse(child => {
      if (child.isMesh && child.material && child.userData.originalEmissive) {
        child.material.emissive.copy(child.userData.originalEmissive);
      }
    });
  }

  // Pick up product clicked/tapped directly by screen coordinates (useful for mobile)
  tryPickUpAtScreen(clientX, clientY) {
    const coords = new THREE.Vector2(
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1
    );
    this.raycaster.setFromCamera(coords, this.camera);
    const intersects = this.raycaster.intersectObjects(this.productMeshes, true);

    if (intersects.length > 0) {
      const hit = intersects[0];
      if (hit.distance <= 3.5) {
        let parent = hit.object;
        while (parent && !parent.userData?.isProduct) {
          parent = parent.parent;
        }
        if (parent && parent.userData?.product) {
          this.executePickUp(parent.userData.product, parent);
        }
      }
    }
  }

  // Pick up product currently hovered by cursor
  tryPickUpHovered() {
    if (!this.hoveredProduct || !this.hoveredMeshGroup) return;
    this.executePickUp(this.hoveredProduct, this.hoveredMeshGroup);
  }

  // --- Pick Up Execution: Sound, Cart, Arc Drop Animation, and Basket Stacking ---
  executePickUp(product, meshGroup) {
    // 1. Add to Cart & UI
    this.cart.addItem(product);
    this.ui.renderCart();
    this.ui.playSound('pickup');
    this.ui.showToast(`+1 ${product.name} (${formatINR(product.price)})`, '🛒');

    // 2. Shelf product subtle bounce effect
    meshGroup.scale.set(1.25, 1.25, 1.25);
    setTimeout(() => {
      meshGroup.scale.set(1.0, 1.0, 1.0);
    }, 220);

    // 3. Parabolic arc flight clone into trolley basket
    const clone = meshGroup.clone();
    clone.position.copy(meshGroup.position);
    this.scene.add(clone);

    const startPos = clone.position.clone();
    const startTime = performance.now();
    const duration = 440; // ms

    this.pickupAnimations.push({
      mesh: clone,
      startPos: startPos,
      startTime: startTime,
      duration: duration,
      product: product
    });

    this.clearProductHighlight();
    this.hoveredProduct = null;
    this.hoveredMeshGroup = null;
    this.ui.hideProductHover();
  }

  updatePickupAnimations(now) {
    for (let i = this.pickupAnimations.length - 1; i >= 0; i--) {
      const anim = this.pickupAnimations[i];
      const elapsed = now - anim.startTime;
      const progress = Math.min(elapsed / anim.duration, 1.0);

      // Target: World position of the attached trolley basket
      const targetPos = new THREE.Vector3();
      if (this.trolleyBasket) {
        this.trolleyBasket.getWorldPosition(targetPos);
      } else {
        targetPos.set(0.35, -0.35, -0.72)
          .applyQuaternion(this.camera.quaternion)
          .add(this.camera.position);
      }

      // Parabolic arc flight curve
      const currentPos = new THREE.Vector3().lerpVectors(anim.startPos, targetPos, progress);
      const arcHeight = Math.sin(progress * Math.PI) * 0.45;
      currentPos.y += arcHeight;
      anim.mesh.position.copy(currentPos);

      // Spin & shrink into trolley
      anim.mesh.rotation.y += 0.16;
      const scale = 1.0 - progress * 0.65;
      anim.mesh.scale.set(scale, scale, scale);

      if (progress >= 1.0) {
        this.scene.remove(anim.mesh);
        // Stack mini item in the trolley viewmodel basket
        this.stackItemInTrolley(anim.product);
        this.pickupAnimations.splice(i, 1);
      }
    }
  }

  // --- Push-Out Collision Resolution with Surface Normal Sliding ---
  resolveCollisions(position) {
    const r = this.playerRadius;

    // Two iteration passes to resolve corner-pinching cleanly
    for (let pass = 0; pass < 2; pass++) {
      // 1. Boundary Wall Limits
      const minX = -13.2 + r;
      const maxX = 13.2 - r;
      const minZ = -19.2 + r;
      const maxZ = 17.2 - r;

      if (position.x < minX) {
        position.x = minX;
        if (this.playerVelocity.x < 0) this.playerVelocity.x = 0;
      } else if (position.x > maxX) {
        position.x = maxX;
        if (this.playerVelocity.x > 0) this.playerVelocity.x = 0;
      }

      if (position.z < minZ) {
        position.z = minZ;
        if (this.playerVelocity.z < 0) this.playerVelocity.z = 0;
      } else if (position.z > maxZ) {
        position.z = maxZ;
        if (this.playerVelocity.z > 0) this.playerVelocity.z = 0;
      }

      // 2. Obstacle Colliders (Aisle gondolas, produce crates, fridges, checkout desks)
      for (let i = 0; i < this.store.colliders.length; i++) {
        const box = this.store.colliders[i];
        const cx = Math.max(box.min.x, Math.min(position.x, box.max.x));
        const cz = Math.max(box.min.z, Math.min(position.z, box.max.z));

        const dx = position.x - cx;
        const dz = position.z - cz;
        const distSq = dx * dx + dz * dz;

        if (distSq < r * r) {
          const dist = Math.sqrt(distSq);
          if (dist > 0.0001) {
            // Surface normal from collider towards player
            const nx = dx / dist;
            const nz = dz / dist;
            const penetration = r - dist;

            // Push player out along normal
            position.x += nx * penetration;
            position.z += nz * penetration;

            // Slide velocity along the surface
            const vDotN = this.playerVelocity.x * nx + this.playerVelocity.z * nz;
            if (vDotN < 0) {
              this.playerVelocity.x -= vDotN * nx;
              this.playerVelocity.z -= vDotN * nz;
            }
          } else {
            // Player center inside box: find closest edge
            const distLeft = Math.abs(position.x - box.min.x);
            const distRight = Math.abs(box.max.x - position.x);
            const distBack = Math.abs(position.z - box.min.z);
            const distFront = Math.abs(box.max.z - position.z);

            const minD = Math.min(distLeft, distRight, distBack, distFront);
            if (minD === distLeft) {
              position.x = box.min.x - r;
              this.playerVelocity.x = Math.min(0, this.playerVelocity.x);
            } else if (minD === distRight) {
              position.x = box.max.x + r;
              this.playerVelocity.x = Math.max(0, this.playerVelocity.x);
            } else if (minD === distBack) {
              position.z = box.min.z - r;
              this.playerVelocity.z = Math.min(0, this.playerVelocity.z);
            } else {
              position.z = box.max.z + r;
              this.playerVelocity.z = Math.max(0, this.playerVelocity.z);
            }
          }
        }
      }
    }
  }

  // --- Smooth Movement Physics with Wall-Sliding ---
  updateMovement(delta) {
    // Keyboard inputs
    let inputX = (this.moveRight || this.dpadRight ? 1 : 0) - (this.moveLeft || this.dpadLeft ? 1 : 0);
    let inputZ = (this.moveBackward || this.dpadBackward ? 1 : 0) - (this.moveForward || this.dpadForward ? 1 : 0);

    // Merge mobile virtual joystick input if active
    if (Math.abs(this.mobileMoveVector.x) > 0.05 || Math.abs(this.mobileMoveVector.y) > 0.05) {
      inputX += this.mobileMoveVector.x;
      inputZ += this.mobileMoveVector.y;
    }

    const isMoving = Math.abs(inputX) > 0.05 || Math.abs(inputZ) > 0.05;

    // Movement direction relative to camera yaw
    const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, this.euler.y, 0));
    const right = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, this.euler.y, 0));

    const moveDirection = new THREE.Vector3();
    moveDirection.addScaledVector(forward, -inputZ);
    moveDirection.addScaledVector(right, inputX);
    if (moveDirection.lengthSq() > 1.0) {
      moveDirection.normalize();
    }

    const currentSpeed = this.moveSpeed * (this.isSprinting ? this.sprintMultiplier : 1.0);
    const targetVelocityX = moveDirection.x * currentSpeed;
    const targetVelocityZ = moveDirection.z * currentSpeed;

    // Smooth acceleration & friction
    this.playerVelocity.x += (targetVelocityX - this.playerVelocity.x) * Math.min(this.friction * delta, 1.0);
    this.playerVelocity.z += (targetVelocityZ - this.playerVelocity.z) * Math.min(this.friction * delta, 1.0);

    // Advance position by velocity * delta
    this.camera.position.x += this.playerVelocity.x * delta;
    this.camera.position.z += this.playerVelocity.z * delta;

    // Continuous Push-Out Collision Resolution (guarantees player never gets stuck)
    this.resolveCollisions(this.camera.position);

    // Gentle head bobbing and trolley natural sway
    if (isMoving) {
      this.headBobTimer += delta * 7.5;
      const bobOffset = Math.sin(this.headBobTimer) * 0.02;
      this.camera.position.y = this.playerHeight + bobOffset;

      // Trolley subtle push motion
      if (this.trolleyViewmodel) {
        const swayX = Math.sin(this.headBobTimer * 0.5) * 0.007;
        const swayY = Math.abs(Math.sin(this.headBobTimer)) * 0.007;
        this.trolleyViewmodel.position.set(0.35 + swayX, -0.35 - swayY, -0.72);
      }
    } else {
      this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, this.playerHeight, delta * 6);
      if (this.trolleyViewmodel) {
        this.trolleyViewmodel.position.set(0.35, -0.35, -0.72);
      }
    }
  }

  // --- Main Render Loop ---
  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = Math.min(this.clock.getDelta(), 0.1);
    const now = performance.now();

    this.updateMovement(delta);
    this.updateRaycasting();
    this.updatePickupAnimations(now);

    this.renderer.render(this.scene, this.camera);
  }

  // Fallback bundled Indian products catalog in case of strict file:// restrictions
  getBundledProductsFallback() {
    return [
      { id: "banana", name: "Banana (1 dozen)", category: "Fruits & Vegetables", price: 60.00, shape: "fruit_banana", color: "#facc15", brand: "FarmFresh", label: "Banana 1 Doz", section: "produce_table_1", shelfTier: 1, slot: 0, itemsPerRow: 8 },
      { id: "apple", name: "Apple (1 kg)", category: "Fruits & Vegetables", price: 180.00, shape: "fruit_apple", color: "#dc2626", brand: "ShimlaOrchard", label: "Shimla Apple", section: "produce_table_1", shelfTier: 0, slot: 1, itemsPerRow: 10 },
      { id: "tomato", name: "Tomato (1 kg)", category: "Fruits & Vegetables", price: 40.00, shape: "fruit_tomato", color: "#ef4444", brand: "FarmFresh", label: "Red Tomato", section: "produce_table_2", shelfTier: 0, slot: 0, itemsPerRow: 10 },
      { id: "onion", name: "Onion (1 kg)", category: "Fruits & Vegetables", price: 35.00, shape: "fruit_onion", color: "#c084fc", brand: "NasikRed", label: "Nasik Onion", section: "produce_table_2", shelfTier: 0, slot: 1, itemsPerRow: 10 },
      { id: "potato", name: "Potato (1 kg)", category: "Fruits & Vegetables", price: 30.00, shape: "fruit_potato", color: "#ca8a04", brand: "FarmFresh", label: "Agra Potato", section: "produce_table_2", shelfTier: 1, slot: 0, itemsPerRow: 10 },

      { id: "milk", name: "Milk 500 ml", category: "Dairy", price: 30.00, shape: "pouch", color: "#2563eb", brand: "Amul", label: "Taaza Milk", section: "fridge_1", shelfTier: 1, slot: 0, itemsPerRow: 8 },
      { id: "milk-top", name: "Milk 500 ml", category: "Dairy", price: 30.00, shape: "pouch", color: "#2563eb", brand: "Amul", label: "Taaza Milk", section: "fridge_1", shelfTier: 2, slot: 0, itemsPerRow: 8 },
      { id: "milk-bottom", name: "Milk 500 ml", category: "Dairy", price: 30.00, shape: "pouch", color: "#2563eb", brand: "Amul", label: "Gold Milk", section: "fridge_1", shelfTier: 0, slot: 0, itemsPerRow: 8 },
      { id: "curd", name: "Curd 400 g", category: "Dairy", price: 40.00, shape: "tub", color: "#ffffff", brand: "Amul", label: "Masti Dahi", section: "fridge_2", shelfTier: 2, slot: 0, itemsPerRow: 8 },
      { id: "paneer", name: "Paneer 200 g", category: "Dairy", price: 90.00, shape: "block", color: "#f8fafc", brand: "Amul", label: "Malai Paneer", section: "fridge_2", shelfTier: 1, slot: 0, itemsPerRow: 8 },
      { id: "butter", name: "Butter 100 g", category: "Dairy", price: 58.00, shape: "butter_box", color: "#fef08a", brand: "Amul", label: "Amul Butter", section: "fridge_2", shelfTier: 0, slot: 0, itemsPerRow: 8 },
      { id: "cheese", name: "Cheese 200 g", category: "Dairy", price: 130.00, shape: "block", color: "#f59e0b", brand: "Amul", label: "Cheese Block", section: "fridge_3", shelfTier: 2, slot: 0, itemsPerRow: 8 },
      { id: "paneer-3", name: "Paneer 200 g", category: "Dairy", price: 90.00, shape: "block", color: "#f8fafc", brand: "Amul", label: "Malai Paneer", section: "fridge_3", shelfTier: 1, slot: 0, itemsPerRow: 8 },
      { id: "butter-3", name: "Butter 100 g", category: "Dairy", price: 58.00, shape: "butter_box", color: "#fef08a", brand: "Amul", label: "Amul Butter", section: "fridge_3", shelfTier: 0, slot: 0, itemsPerRow: 8 },

      { id: "lays", name: "Lays Chips", category: "Snacks", price: 20.00, shape: "bag", color: "#3b82f6", brand: "Lay's", label: "Magic Masala", section: "aisle_1_A", shelfTier: 0, slot: 0, itemsPerRow: 8 },
      { id: "dairy-milk", name: "Dairy Milk Chocolate", category: "Snacks", price: 50.00, shape: "chocolate_bar", color: "#581c87", brand: "Cadbury", label: "Dairy Milk", section: "aisle_1_A", shelfTier: 1, slot: 0, itemsPerRow: 8 },
      { id: "good-day", name: "Good Day Biscuits", category: "Snacks", price: 30.00, shape: "biscuit", color: "#eab308", brand: "Britannia", label: "Good Day", section: "aisle_1_A", shelfTier: 2, slot: 0, itemsPerRow: 8 },
      { id: "parle-g", name: "Parle-G Biscuits", category: "Snacks", price: 10.00, shape: "biscuit", color: "#facc15", brand: "Parle", label: "Parle-G", section: "aisle_1_A", shelfTier: 3, slot: 0, itemsPerRow: 8 },
      { id: "kurkure", name: "Kurkure", category: "Snacks", price: 20.00, shape: "bag", color: "#ea580c", brand: "Kurkure", label: "Masala Munch", section: "aisle_1_B", shelfTier: 3, slot: 0, itemsPerRow: 8 },
      { id: "lays-classic", name: "Lays Chips", category: "Snacks", price: 20.00, shape: "bag", color: "#eab308", brand: "Lay's", label: "Classic Salt", section: "aisle_1_B", shelfTier: 2, slot: 0, itemsPerRow: 8 },
      { id: "good-day-b", name: "Good Day Biscuits", category: "Snacks", price: 30.00, shape: "biscuit", color: "#eab308", brand: "Britannia", label: "Good Day", section: "aisle_1_B", shelfTier: 1, slot: 0, itemsPerRow: 8 },
      { id: "dairy-milk-b", name: "Dairy Milk Chocolate", category: "Snacks", price: 50.00, shape: "chocolate_bar", color: "#581c87", brand: "Cadbury", label: "Dairy Milk", section: "aisle_1_B", shelfTier: 0, slot: 0, itemsPerRow: 8 },

      { id: "rice", name: "Rice 5 kg", category: "Staples", price: 350.00, shape: "sack", color: "#15803d", brand: "IndiaGate", label: "Basmati Rice 5kg", section: "aisle_2_A", shelfTier: 0, slot: 0, itemsPerRow: 7 },
      { id: "toor-dal", name: "Toor Dal 1 kg", category: "Staples", price: 160.00, shape: "pouch", color: "#eab308", brand: "TataSampann", label: "Toor Dal 1kg", section: "aisle_2_A", shelfTier: 1, slot: 0, itemsPerRow: 8 },
      { id: "sugar", name: "Sugar 1 kg", category: "Staples", price: 45.00, shape: "pouch", color: "#38bdf8", brand: "Madhur", label: "Pure Sugar 1kg", section: "aisle_2_A", shelfTier: 2, slot: 0, itemsPerRow: 8 },
      { id: "salt", name: "Salt 1 kg", category: "Staples", price: 25.00, shape: "pouch", color: "#0284c7", brand: "TataSalt", label: "Tata Salt 1kg", section: "aisle_2_A", shelfTier: 3, slot: 0, itemsPerRow: 8 },
      { id: "atta", name: "Atta 5 kg", category: "Staples", price: 260.00, shape: "sack", color: "#ea580c", brand: "Aashirvaad", label: "Sharbati Atta 5kg", section: "aisle_2_B", shelfTier: 0, slot: 0, itemsPerRow: 7 },
      { id: "rice-b", name: "Rice 5 kg", category: "Staples", price: 350.00, shape: "sack", color: "#15803d", brand: "IndiaGate", label: "Basmati Rice 5kg", section: "aisle_2_B", shelfTier: 1, slot: 0, itemsPerRow: 7 },
      { id: "sunflower-oil", name: "Sunflower Oil 1 L", category: "Staples", price: 140.00, shape: "bottle", color: "#ca8a04", brand: "Fortune", label: "Sunflower 1L", section: "aisle_2_B", shelfTier: 2, slot: 0, itemsPerRow: 8 },
      { id: "toor-dal-b", name: "Toor Dal 1 kg", category: "Staples", price: 160.00, shape: "pouch", color: "#eab308", brand: "TataSampann", label: "Toor Dal 1kg", section: "aisle_2_B", shelfTier: 3, slot: 0, itemsPerRow: 8 },

      { id: "bisleri", name: "Bisleri Water 1 L", category: "Drinks", price: 20.00, shape: "bottle", color: "#0d9488", brand: "Bisleri", label: "Bisleri 1L", section: "aisle_3_A", shelfTier: 0, slot: 0, itemsPerRow: 8 },
      { id: "pepsi", name: "Pepsi 750 ml", category: "Drinks", price: 40.00, shape: "bottle", color: "#1d4ed8", brand: "Pepsi", label: "Pepsi 750ml", section: "aisle_3_A", shelfTier: 1, slot: 0, itemsPerRow: 8 },
      { id: "coca-cola", name: "Coca-Cola 750 ml", category: "Drinks", price: 40.00, shape: "bottle", color: "#b91c1c", brand: "Coca-Cola", label: "Coke 750ml", section: "aisle_3_A", shelfTier: 2, slot: 0, itemsPerRow: 8 },
      { id: "frooti", name: "Frooti", category: "Drinks", price: 20.00, shape: "carton", color: "#facc15", brand: "ParleAgro", label: "Frooti Mango", section: "aisle_3_A", shelfTier: 3, slot: 0, itemsPerRow: 8 },
      { id: "bisleri-b", name: "Bisleri Water 1 L", category: "Drinks", price: 20.00, shape: "bottle", color: "#0d9488", brand: "Bisleri", label: "Bisleri 1L", section: "aisle_3_B", shelfTier: 0, slot: 0, itemsPerRow: 8 },
      { id: "coca-cola-b", name: "Coca-Cola 750 ml", category: "Drinks", price: 40.00, shape: "bottle", color: "#b91c1c", brand: "Coca-Cola", label: "Coke 750ml", section: "aisle_3_B", shelfTier: 1, slot: 0, itemsPerRow: 8 },
      { id: "frooti-b", name: "Frooti", category: "Drinks", price: 20.00, shape: "carton", color: "#facc15", brand: "ParleAgro", label: "Frooti Mango", section: "aisle_3_B", shelfTier: 2, slot: 0, itemsPerRow: 8 },
      { id: "real-juice", name: "Real Juice 1 L", category: "Drinks", price: 110.00, shape: "carton", color: "#ea580c", brand: "Real", label: "Real Mixed 1L", section: "aisle_3_B", shelfTier: 3, slot: 0, itemsPerRow: 8 },

      { id: "surf-excel", name: "Surf Excel 1 kg", category: "Household", price: 130.00, shape: "box", color: "#1d4ed8", brand: "SurfExcel", label: "Surf Excel 1kg", section: "aisle_4_A", shelfTier: 0, slot: 0, itemsPerRow: 8 },
      { id: "vim", name: "Vim Dishwash", category: "Household", price: 45.00, shape: "bottle", color: "#65a30d", brand: "Vim", label: "Vim Gel Lime", section: "aisle_4_A", shelfTier: 1, slot: 0, itemsPerRow: 8 },
      { id: "lifebuoy", name: "Lifebuoy Soap", category: "Household", price: 35.00, shape: "soap_bar", color: "#dc2626", brand: "Lifebuoy", label: "Lifebuoy Total", section: "aisle_4_A", shelfTier: 2, slot: 0, itemsPerRow: 8 },
      { id: "colgate", name: "Colgate Toothpaste", category: "Household", price: 60.00, shape: "toothpaste_box", color: "#dc2626", brand: "Colgate", label: "Colgate Dental", section: "aisle_4_A", shelfTier: 3, slot: 0, itemsPerRow: 8 },
      { id: "surf-excel-b", name: "Surf Excel 1 kg", category: "Household", price: 130.00, shape: "box", color: "#1d4ed8", brand: "SurfExcel", label: "Surf Excel 1kg", section: "aisle_4_B", shelfTier: 0, slot: 0, itemsPerRow: 8 },
      { id: "vim-b", name: "Vim Dishwash", category: "Household", price: 45.00, shape: "bottle", color: "#65a30d", brand: "Vim", label: "Vim Gel Lime", section: "aisle_4_B", shelfTier: 1, slot: 0, itemsPerRow: 8 },
      { id: "lifebuoy-b", name: "Lifebuoy Soap", category: "Household", price: 35.00, shape: "soap_bar", color: "#dc2626", brand: "Lifebuoy", label: "Lifebuoy Total", section: "aisle_4_B", shelfTier: 2, slot: 0, itemsPerRow: 8 },
      { id: "colgate-b", name: "Colgate Toothpaste", category: "Household", price: 60.00, shape: "toothpaste_box", color: "#dc2626", brand: "Colgate", label: "Colgate Dental", section: "aisle_4_B", shelfTier: 3, slot: 0, itemsPerRow: 8 }
    ];
  }
}

// Start application once DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  new SupermarketApp();
});
