// ui.js - Professional Supermarket UI, Audio Synthesizer, Cart Drawer, GST Billing, and Mobile Dual-Touch
export function formatINR(amount) {
  const num = Number(amount) || 0;
  return '₹' + num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export class ShoppingCart {
  constructor() {
    this.items = new Map(); // id -> { id, name, category, price, quantity, color, brand, label }
  }

  addItem(product) {
    if (this.items.has(product.id)) {
      const existing = this.items.get(product.id);
      existing.quantity += 1;
    } else {
      this.items.set(product.id, {
        id: product.id,
        name: product.name,
        category: product.category,
        price: Number(product.price),
        color: product.color || '#3b82f6',
        brand: product.brand || 'SuperMart',
        label: product.label || product.name,
        quantity: 1
      });
    }
  }

  updateQuantity(id, newQty) {
    if (newQty <= 0) {
      this.removeItem(id);
    } else if (this.items.has(id)) {
      this.items.get(id).quantity = newQty;
    }
  }

  removeItem(id) {
    this.items.delete(id);
  }

  clear() {
    this.items.clear();
  }

  getItems() {
    return Array.from(this.items.values());
  }

  getTotalItemCount() {
    let count = 0;
    this.items.forEach(item => { count += item.quantity; });
    return count;
  }

  getSubtotal() {
    let sum = 0;
    this.items.forEach(item => { sum += item.price * item.quantity; });
    return sum;
  }
}

export class UIManager {
  constructor(cart, onCheckoutComplete) {
    this.cart = cart;
    this.onCheckoutComplete = onCheckoutComplete;

    // Audio synthesizer state
    this.audioCtx = null;
    this.isMuted = false;
    this.ambientStarted = false;
    this.ambientMasterGain = null;
    this.ambientInterval = null;

    this.initElements();
    this.initAudio();
    this.bindEvents();
    this.renderCart();
  }

  initElements() {
    // Loading Screen
    this.loadingScreen = document.getElementById('loading-screen');
    this.loadingBar = document.getElementById('loading-bar');
    this.loadingStatus = document.getElementById('loading-status');

    // Reticle & Tooltip
    this.crosshair = document.getElementById('crosshair');
    this.productTooltip = document.getElementById('product-tooltip');
    this.tooltipName = document.getElementById('tooltip-name');
    this.tooltipPrice = document.getElementById('tooltip-price');
    this.tooltipCategory = document.getElementById('tooltip-category');
    this.tooltipAction = document.getElementById('tooltip-action');

    // Top HUD
    this.soundBtn = document.getElementById('sound-btn');
    this.soundIcon = document.getElementById('sound-icon');
    this.helpBtn = document.getElementById('help-btn');
    this.cartBtn = document.getElementById('cart-btn');
    this.cartBadge = document.getElementById('cart-badge');
    this.cartBtnTotal = document.getElementById('cart-btn-total');

    // Bottom HUD
    this.zonePrompt = document.getElementById('zone-prompt');
    this.toastContainer = document.getElementById('toast-container');
    this.miniCartContainer = document.getElementById('mini-cart-container');
    this.trolleyStatusText = document.getElementById('trolley-status-text');

    // Cart Drawer
    this.cartDrawer = document.getElementById('cart-drawer');
    this.cartOverlay = document.getElementById('cart-overlay');
    this.cartCloseBtn = document.getElementById('cart-close-btn');
    this.cartItemsList = document.getElementById('cart-items-list');
    this.cartSubtotal = document.getElementById('cart-subtotal');
    this.cartTax = document.getElementById('cart-tax');
    this.cartTotal = document.getElementById('cart-total');
    this.cartCheckoutBtn = document.getElementById('cart-checkout-btn');
    this.cartClearBtn = document.getElementById('cart-clear-btn');

    // Checkout Modal
    this.checkoutModal = document.getElementById('checkout-modal');
    this.checkoutOverlay = document.getElementById('checkout-overlay');
    this.checkoutReceiptItems = document.getElementById('receipt-items');
    this.receiptSubtotal = document.getElementById('receipt-subtotal');
    this.receiptTax = document.getElementById('receipt-tax');
    this.receiptTotal = document.getElementById('receipt-total');
    this.receiptDate = document.getElementById('receipt-date');
    this.receiptOrderNum = document.getElementById('receipt-order-num');
    this.btnConfirmPayment = document.getElementById('btn-confirm-payment');
    this.btnCloseCheckout = document.getElementById('btn-close-checkout');

    // Help Modal
    this.helpOverlay = document.getElementById('help-overlay');
    this.helpCloseBtn = document.getElementById('help-close-btn');
    this.btnHelpGotIt = document.getElementById('btn-help-got-it');

    // Welcome Screen
    this.instructionsOverlay = document.getElementById('instructions-overlay');
    this.btnStartShopping = document.getElementById('btn-start-shopping');

    // Success Modal
    this.successModal = document.getElementById('success-modal');
    this.successOverlay = document.getElementById('success-overlay');
    this.btnShopAgain = document.getElementById('btn-shop-again');
    this.btnCloseSuccess = document.getElementById('btn-close-success');
    this.successTotalPaid = document.getElementById('success-total-paid');
    this.successItemCount = document.getElementById('success-item-count');

    // Mobile Virtual Joystick elements
    this.mobileTouchContainer = document.getElementById('mobile-touch-container');
    this.joystickBoundary = document.getElementById('joystick-boundary');
    this.joystickKnob = document.getElementById('joystick-knob');
    this.touchLookZone = document.getElementById('touch-look-zone');
  }

  // --- Loading Progress Management ---
  setLoadingProgress(percent, text) {
    if (this.loadingBar) {
      this.loadingBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    }
    if (this.loadingStatus && text) {
      this.loadingStatus.textContent = text;
    }
  }

  hideLoadingScreen() {
    if (this.loadingScreen) {
      this.loadingScreen.classList.add('fade-out');
      setTimeout(() => {
        this.loadingScreen.style.display = 'none';
      }, 550);
    }
  }

  // --- Web Audio Procedural Sound Engine ---
  initAudio() {
    const unlock = () => {
      if (!this.audioCtx) {
        const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
        if (AudioCtxClass) {
          this.audioCtx = new AudioCtxClass();
          this.setupAmbientSound();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };

    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  setupAmbientSound() {
    if (!this.audioCtx || this.ambientStarted) return;
    this.ambientStarted = true;

    try {
      // Master ambient gain
      this.ambientMasterGain = this.audioCtx.createGain();
      this.ambientMasterGain.gain.setValueAtTime(this.isMuted ? 0.0 : 0.04, this.audioCtx.currentTime);
      this.ambientMasterGain.connect(this.audioCtx.destination);

      // 1. Soft HVAC / Store Air Ambience (Filtered noise)
      const bufferSize = 2 * this.audioCtx.sampleRate;
      const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99 * b0 + white * 0.05;
        b1 = 0.95 * b1 + white * 0.08;
        b2 = 0.90 * b2 + white * 0.12;
        output[i] = (b0 + b1 + b2) * 0.15;
      }

      const whiteNoise = this.audioCtx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const lowpass = this.audioCtx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.setValueAtTime(140, this.audioCtx.currentTime);

      whiteNoise.connect(lowpass);
      lowpass.connect(this.ambientMasterGain);
      whiteNoise.start();

      // 2. Periodic Soft Store Background Chime Harmony (every 8 seconds)
      const playSoftChord = () => {
        if (this.isMuted || !this.audioCtx || this.audioCtx.state !== 'running') return;
        const now = this.audioCtx.currentTime;
        // F Major 9 / C Major 7 peaceful retail chords
        const chordPitches = [349.23, 440.00, 523.25, 659.25]; // F4, A4, C5, E5
        chordPitches.forEach((freq, idx) => {
          const osc = this.audioCtx.createOscillator();
          const noteGain = this.audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.06);

          noteGain.gain.setValueAtTime(0.0001, now + idx * 0.06);
          noteGain.gain.exponentialRampToValueAtTime(0.015, now + idx * 0.06 + 0.4);
          noteGain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.06 + 2.8);

          osc.connect(noteGain);
          noteGain.connect(this.ambientMasterGain);
          osc.start(now + idx * 0.06);
          osc.stop(now + idx * 0.06 + 3.0);
        });
      };

      this.ambientInterval = setInterval(playSoftChord, 8500);
      setTimeout(playSoftChord, 1200);
    } catch (e) {
      console.warn('Ambient sound setup skipped:', e);
    }
  }

  toggleSound() {
    this.isMuted = !this.isMuted;
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    if (this.ambientMasterGain && this.audioCtx) {
      const now = this.audioCtx.currentTime;
      this.ambientMasterGain.gain.cancelScheduledValues(now);
      this.ambientMasterGain.gain.linearRampToValueAtTime(this.isMuted ? 0.0 : 0.04, now + 0.15);
    }

    if (this.soundIcon) {
      this.soundIcon.textContent = this.isMuted ? '🔇' : '🔊';
    }
    if (this.soundBtn) {
      this.soundBtn.title = this.isMuted ? 'Unmute Sound' : 'Mute Sound';
    }

    this.showToast(this.isMuted ? 'Store sound muted' : 'Store sound enabled', this.isMuted ? '🔇' : '🔊');
  }

  playSound(type) {
    if (this.isMuted || !this.audioCtx) return;
    try {
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const now = this.audioCtx.currentTime;

      if (type === 'pickup') {
        // High soft chime note (D5 -> A5)
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.exponentialRampToValueAtTime(880.00, now + 0.12);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'beep') {
        // Supermarket barcode scanner beep (~1864Hz pure tone)
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(1864, now);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.setValueAtTime(0.12, now + 0.07);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.09);
      } else if (type === 'click') {
        // Subtle UI click
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.05);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.05);
      } else if (type === 'cash') {
        // Classic cash register bell & celebratory chime
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.08);
          gain.gain.setValueAtTime(0.24, now + i * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.5);
          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          osc.start(now + i * 0.08);
          osc.stop(now + i * 0.08 + 0.55);
        });
      }
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  }

  bindEvents() {
    // Sound Button
    if (this.soundBtn) {
      this.soundBtn.addEventListener('click', () => this.toggleSound());
    }

    // Open / Close Cart Drawer
    this.cartBtn?.addEventListener('click', () => this.openCart());
    this.cartCloseBtn?.addEventListener('click', () => this.closeCart());
    this.cartOverlay?.addEventListener('click', () => this.closeCart());

    // Cart Actions
    this.cartClearBtn?.addEventListener('click', () => {
      this.playSound('click');
      this.cart.clear();
      this.renderCart();
      this.showToast('Cart cleared', '🗑️');
    });

    this.cartCheckoutBtn?.addEventListener('click', () => {
      this.playSound('click');
      this.closeCart();
      this.openCheckout();
    });

    // Checkout Modal Actions
    this.btnCloseCheckout?.addEventListener('click', () => {
      this.playSound('click');
      this.closeCheckout();
    });
    this.checkoutOverlay?.addEventListener('click', (e) => {
      if (e.target === this.checkoutOverlay) {
        this.closeCheckout();
      }
    });

    // Mini Cart HUD button
    this.miniCartContainer?.addEventListener('click', () => this.openCart());

    // Payment method selector
    document.querySelectorAll('.payment-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        this.playSound('click');
        document.querySelectorAll('.payment-opt').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
      });
    });

    this.btnConfirmPayment?.addEventListener('click', () => {
      this.processPayment();
    });

    // Help Modal Actions
    this.helpBtn?.addEventListener('click', () => this.openHelp());
    this.helpCloseBtn?.addEventListener('click', () => {
      this.playSound('click');
      this.closeHelp();
    });
    this.btnHelpGotIt?.addEventListener('click', () => {
      this.playSound('click');
      this.closeHelp();
    });
    this.helpOverlay?.addEventListener('click', (e) => {
      if (e.target === this.helpOverlay) {
        this.playSound('click');
        this.closeHelp();
      }
    });

    // Start Shopping Welcome Dismiss
    this.btnStartShopping?.addEventListener('click', () => {
      this.playSound('click');
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      this.instructionsOverlay?.classList.add('hidden');
    });

    // Success Modal Actions
    this.btnShopAgain?.addEventListener('click', () => {
      this.playSound('click');
      this.closeSuccess();
      this.cart.clear();
      this.renderCart();
      if (this.onCheckoutComplete) this.onCheckoutComplete(true);
      this.showToast('Ready for another shopping trip!', '🛒');
    });

    this.btnCloseSuccess?.addEventListener('click', () => {
      this.playSound('click');
      this.closeSuccess();
      if (this.onCheckoutComplete) this.onCheckoutComplete(false);
    });
    this.successOverlay?.addEventListener('click', (e) => {
      if (e.target === this.successOverlay) {
        this.closeSuccess();
      }
    });
  }

  // --- Product Aim & Hover Tooltip ---
  showProductHover(product, screenX, screenY) {
    if (!this.crosshair || !this.productTooltip) return;
    this.crosshair.classList.add('hovering');
    this.productTooltip.classList.remove('hidden');

    if (this.tooltipName) this.tooltipName.textContent = product.name;
    if (this.tooltipPrice) this.tooltipPrice.textContent = formatINR(product.price);
    if (this.tooltipCategory) this.tooltipCategory.textContent = product.category;
    if (this.tooltipAction) this.tooltipAction.textContent = 'Click / Tap to add to trolley';

    if (screenX !== undefined && screenY !== undefined) {
      let left = screenX + 16;
      let top = screenY + 16;
      if (left + 220 > window.innerWidth) left = screenX - 230;
      if (top + 100 > window.innerHeight) top = screenY - 90;
      this.productTooltip.style.left = `${left}px`;
      this.productTooltip.style.top = `${top}px`;
      this.productTooltip.style.transform = 'none';
    } else {
      this.productTooltip.style.left = '50%';
      this.productTooltip.style.top = 'calc(50% + 24px)';
      this.productTooltip.style.transform = 'translateX(-50%)';
    }
  }

  hideProductHover() {
    if (this.crosshair) this.crosshair.classList.remove('hovering');
    if (this.productTooltip) this.productTooltip.classList.add('hidden');
  }

  // --- Help Modal ---
  openHelp() {
    this.playSound('click');
    this.helpOverlay?.classList.remove('hidden');
  }

  closeHelp() {
    this.helpOverlay?.classList.add('hidden');
  }

  // --- Interaction Zone Prompt (Checkout desk) ---
  showZonePrompt(text, actionKey = 'E') {
    if (!this.zonePrompt) return;
    this.zonePrompt.innerHTML = `<span class="key-badge">${actionKey}</span> ${text}`;
    this.zonePrompt.classList.remove('hidden');
  }

  hideZonePrompt() {
    if (this.zonePrompt) this.zonePrompt.classList.add('hidden');
  }

  // --- Toast Notifications ---
  showToast(message, icon = '🛒') {
    if (!this.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast-msg animate-fade-in';
    toast.innerHTML = `<span class="toast-icon">${icon}</span> <span>${message}</span>`;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-fade-out');
      setTimeout(() => toast.remove(), 350);
    }, 2600);
  }

  // --- Cart Drawer Management ---
  openCart() {
    this.playSound('click');
    this.renderCart();
    this.cartDrawer?.classList.add('open');
    this.cartOverlay?.classList.remove('hidden');
  }

  closeCart() {
    this.cartDrawer?.classList.remove('open');
    this.cartOverlay?.classList.add('hidden');
  }

  renderCart() {
    const items = this.cart.getItems();
    const count = this.cart.getTotalItemCount();

    if (this.cartBadge) {
      this.cartBadge.textContent = count;
      if (count > 0) {
        this.cartBadge.classList.add('active');
      } else {
        this.cartBadge.classList.remove('active');
      }
    }

    if (this.cartCheckoutBtn) {
      this.cartCheckoutBtn.disabled = (count === 0);
    }

    if (this.trolleyStatusText) {
      this.trolleyStatusText.textContent = count > 0 ? `${count} items inside` : 'Ready in front';
    }

    // Totals with 5% GST
    const subtotal = this.cart.getSubtotal();
    const gst = subtotal * 0.05; // 5% GST
    const total = subtotal + gst;

    if (this.cartBtnTotal) {
      this.cartBtnTotal.textContent = formatINR(total);
    }

    if (this.cartSubtotal) this.cartSubtotal.textContent = formatINR(subtotal);
    if (this.cartTax) this.cartTax.textContent = formatINR(gst);
    if (this.cartTotal) this.cartTotal.textContent = formatINR(total);

    if (!this.cartItemsList) return;

    if (items.length === 0) {
      this.cartItemsList.innerHTML = `
        <div class="empty-cart-state">
          <div class="empty-icon">🧺</div>
          <p>Your shopping trolley is empty.</p>
          <small>Walk down the aisles and click items to drop them into your trolley!</small>
        </div>
      `;
    } else {
      this.cartItemsList.innerHTML = '';
      items.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'cart-item-row';
        itemEl.innerHTML = `
          <div class="item-color-pill" style="background: ${item.color};"></div>
          <div class="item-details">
            <h4 class="item-title">${item.name}</h4>
            <div class="item-meta">
              <span class="item-unit-price">${formatINR(item.price)} each</span>
              <span class="item-category">${item.category}</span>
            </div>
          </div>
          <div class="item-qty-controls">
            <button class="btn-qty btn-minus" data-id="${item.id}" aria-label="Decrease quantity">−</button>
            <span class="item-qty-value">${item.quantity}</span>
            <button class="btn-qty btn-plus" data-id="${item.id}" aria-label="Increase quantity">+</button>
          </div>
          <div class="item-line-total">${formatINR(item.price * item.quantity)}</div>
          <button class="btn-remove-item" data-id="${item.id}" title="Remove item">&times;</button>
        `;

        itemEl.querySelector('.btn-minus')?.addEventListener('click', () => {
          this.playSound('click');
          this.cart.updateQuantity(item.id, item.quantity - 1);
          this.renderCart();
        });

        itemEl.querySelector('.btn-plus')?.addEventListener('click', () => {
          this.playSound('click');
          this.cart.updateQuantity(item.id, item.quantity + 1);
          this.renderCart();
        });

        itemEl.querySelector('.btn-remove-item')?.addEventListener('click', () => {
          this.playSound('click');
          this.cart.removeItem(item.id);
          this.renderCart();
          this.showToast(`Removed ${item.name}`, '🗑️');
        });

        this.cartItemsList.appendChild(itemEl);
      });
    }
  }

  // --- Billing / Checkout Receipt Modal ---
  openCheckout() {
    if (this.cart.getTotalItemCount() === 0) {
      this.showToast('Your cart is empty! Add items before checkout.', '⚠️');
      return;
    }

    this.playSound('beep');

    // Populate Receipt
    const now = new Date();
    if (this.receiptDate) this.receiptDate.textContent = now.toLocaleString('en-IN');
    if (this.receiptOrderNum) this.receiptOrderNum.textContent = `SM-${Math.floor(100000 + Math.random() * 900000)}`;

    const items = this.cart.getItems();
    if (this.checkoutReceiptItems) {
      this.checkoutReceiptItems.innerHTML = '';
      items.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td class="receipt-item-col">
            <div class="receipt-name">${item.name}</div>
            <small class="receipt-unit">${item.quantity} x ${formatINR(item.price)}</small>
          </td>
          <td class="receipt-price-col">${formatINR(item.price * item.quantity)}</td>
        `;
        this.checkoutReceiptItems.appendChild(row);
      });
    }

    const subtotal = this.cart.getSubtotal();
    const gst = subtotal * 0.05; // 5% GST
    const total = subtotal + gst;

    if (this.receiptSubtotal) this.receiptSubtotal.textContent = formatINR(subtotal);
    if (this.receiptTax) this.receiptTax.textContent = formatINR(gst);
    if (this.receiptTotal) this.receiptTotal.textContent = formatINR(total);

    this.checkoutModal?.classList.remove('hidden');
    this.checkoutOverlay?.classList.remove('hidden');
  }

  closeCheckout() {
    this.checkoutModal?.classList.add('hidden');
    this.checkoutOverlay?.classList.add('hidden');
  }

  processPayment() {
    if (!this.btnConfirmPayment) return;
    this.btnConfirmPayment.disabled = true;
    this.btnConfirmPayment.textContent = 'Processing Payment...';
    this.playSound('beep');

    setTimeout(() => {
      this.btnConfirmPayment.disabled = false;
      this.btnConfirmPayment.textContent = 'Confirm & Pay';
      this.closeCheckout();
      this.openSuccess();
    }, 1100);
  }

  // --- Order Success Confirmation Modal ---
  openSuccess() {
    this.playSound('cash');
    this.triggerConfetti();

    const orderTotal = this.cart.getSubtotal() * 1.05; // 5% GST
    if (this.successTotalPaid) this.successTotalPaid.textContent = formatINR(orderTotal);
    if (this.successItemCount) this.successItemCount.textContent = `${this.cart.getTotalItemCount()} items`;

    this.successModal?.classList.remove('hidden');
    this.successOverlay?.classList.remove('hidden');
  }

  closeSuccess() {
    this.successModal?.classList.add('hidden');
    this.successOverlay?.classList.add('hidden');
  }

  triggerConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const confettiPieces = [];
    const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

    for (let i = 0; i < 160; i++) {
      confettiPieces.push({
        x: canvas.width / 2,
        y: canvas.height / 2,
        vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() - 0.7) * 20,
        size: Math.random() * 8 + 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 12,
        alpha: 1.0
      });
    }

    let frame = 0;
    const animate = () => {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let alive = false;
      confettiPieces.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.35; // gravity
        p.vx *= 0.98;
        p.rotation += p.rotationSpeed;
        if (frame > 45) {
          p.alpha -= 0.015;
        }

        if (p.alpha > 0) {
          alive = true;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          ctx.restore();
        }
      });

      if (alive) {
        requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
    requestAnimationFrame(animate);
  }

  // --- Mobile Dual-Touch Setup (Left Joystick & Right Touch-Look / Tap Pick) ---
  setupMobileControls({ onMove, onLook, onPickTap }) {
    if (!this.joystickBoundary || !this.joystickKnob) return;

    let touchId = null;
    let startX = 0;
    let startY = 0;
    const maxRadius = 45; // Maximum pixel displacement of joystick knob

    const resetKnob = () => {
      touchId = null;
      this.joystickKnob.style.transform = 'translate(-50%, -50%)';
      if (onMove) onMove({ x: 0, y: 0 });
    };

    const handleTouchStart = (e) => {
      if (touchId !== null) return;
      const touch = e.changedTouches[0];
      touchId = touch.identifier;
      const rect = this.joystickBoundary.getBoundingClientRect();
      startX = rect.left + rect.width / 2;
      startY = rect.top + rect.height / 2;
      handleTouchMove(e);
    };

    const handleTouchMove = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === touchId) {
          let dx = touch.clientX - startX;
          let dy = touch.clientY - startY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > maxRadius) {
            dx = (dx / dist) * maxRadius;
            dy = (dy / dist) * maxRadius;
          }

          this.joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

          const normX = dx / maxRadius;
          const normY = dy / maxRadius;
          if (onMove) onMove({ x: normX, y: normY });
          break;
        }
      }
    };

    const handleTouchEnd = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchId) {
          resetKnob();
          break;
        }
      }
    };

    this.joystickBoundary.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);

    // Right Touch Look Zone + Tap to Pick
    if (this.touchLookZone) {
      let lookTouchId = null;
      let lastLookX = 0;
      let lastLookY = 0;
      let totalDragDist = 0;

      this.touchLookZone.addEventListener('touchstart', (e) => {
        if (lookTouchId !== null) return;
        const touch = e.changedTouches[0];
        lookTouchId = touch.identifier;
        lastLookX = touch.clientX;
        lastLookY = touch.clientY;
        totalDragDist = 0;
      }, { passive: false });

      this.touchLookZone.addEventListener('touchmove', (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          if (touch.identifier === lookTouchId) {
            const dx = touch.clientX - lastLookX;
            const dy = touch.clientY - lastLookY;
            totalDragDist += Math.abs(dx) + Math.abs(dy);

            if (onLook) {
              onLook(dx, dy);
            }

            lastLookX = touch.clientX;
            lastLookY = touch.clientY;
            break;
          }
        }
      }, { passive: false });

      const endLook = (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          if (touch.identifier === lookTouchId) {
            // If total drag distance was less than 12px, user tapped to pick!
            if (totalDragDist < 12 && onPickTap) {
              onPickTap(touch.clientX, touch.clientY);
            }
            lookTouchId = null;
            break;
          }
        }
      };

      this.touchLookZone.addEventListener('touchend', endLook);
      this.touchLookZone.addEventListener('touchcancel', endLook);
    }
  }

  // --- Optional On-Screen D-Pad Navigation Controls Setup ---
  setupDpadControls(onDpadChange) {
    const dpadState = { forward: false, backward: false, left: false, right: false };

    const bindButton = (id, direction) => {
      const btn = document.getElementById(id);
      if (!btn) return;

      const start = (e) => {
        e.preventDefault();
        e.stopPropagation();
        dpadState[direction] = true;
        btn.classList.add('active');
        if (onDpadChange) onDpadChange(dpadState);
      };

      const end = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (dpadState[direction]) {
          dpadState[direction] = false;
          btn.classList.remove('active');
          if (onDpadChange) onDpadChange(dpadState);
        }
      };

      btn.addEventListener('mousedown', start);
      btn.addEventListener('mouseup', end);
      btn.addEventListener('mouseleave', end);
      btn.addEventListener('touchstart', start, { passive: false });
      btn.addEventListener('touchend', end);
      btn.addEventListener('touchcancel', end);
    };

    bindButton('dpad-up', 'forward');
    bindButton('dpad-down', 'backward');
    bindButton('dpad-left', 'left');
    bindButton('dpad-right', 'right');
  }
}
