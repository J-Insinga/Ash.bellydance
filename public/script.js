"use strict";

(() => {
  /* =========================================================
     CATALOGUE DES COURS
  ========================================================= */

  const COURSES = {
    initiation: {
      nameKey: "courseInitiation",
      fallbackName: "Initiation orientale",
      price: 15,
      dates: ["2026-09-07"]
    },
    technique: {
      nameKey: "courseTechnique",
      fallbackName: "Technique & musicalité",
      price: 18,
      dates: ["2026-09-09", "2026-09-16"]
    },
    choreographie: {
      nameKey: "courseChoreo",
      fallbackName: "Chorégraphie",
      price: 20,
      dates: ["2026-09-12"]
    },
    "atelier-paris": {
      nameKey: "courseParis",
      fallbackName: "Atelier — Paris",
      price: 20,
      dates: ["2026-09-13", "2026-10-04", "2026-11-08"]
    },
    "atelier-clichy": {
      nameKey: "courseClichy",
      fallbackName: "Atelier — Clichy",
      price: 20,
      dates: ["2026-09-20"]
    },
    "atelier-pantin": {
      nameKey: "coursePantin",
      fallbackName: "Atelier — Pantin",
      price: 20,
      dates: ["2026-09-22", "2026-10-20", "2026-11-17"]
    }
  };

  const CART_STORAGE_KEY = "byfiggy-cart";
  const PAYPAL_STORAGE_KEY = "byfiggy-paypal-cart";
  const MAX_QUANTITY_PER_LINE = 4;

  /* =========================================================
     ÉLÉMENTS HTML
  ========================================================= */

  const bookingModal = document.getElementById("bookingModal");
  const bookingForm = document.getElementById("bookingForm");
  const selectedCourse = document.getElementById("selectedCourse");
  const selectedDate = document.getElementById("selectedDate");
  const selectedPrice = document.getElementById("selectedPrice");
  const quantityInput = document.getElementById("quantity");
  const formMessage = document.getElementById("formMessage");

  const cartTrigger = document.getElementById("cartTrigger");
  const cartCount = document.getElementById("cartCount");
  const cartModal = document.getElementById("cartModal");
  const cartItems = document.getElementById("cartItems");
  const cartEmpty = document.getElementById("cartEmpty");
  const cartSummary = document.getElementById("cartSummary");
  const cartTotal = document.getElementById("cartTotal");
  const cartCheckoutForm = document.getElementById("cartCheckoutForm");
  const cartFirstName = document.getElementById("cartFirstName");
  const cartEmail = document.getElementById("cartEmail");
  const cartPayPalButton = document.getElementById("cartPayPalButton");
  const cartMessage = document.getElementById("cartMessage");

  const menuToggle = document.querySelector(".menu-toggle");
  const mainNav = document.getElementById("mainNav");

  /* =========================================================
     ÉTAT
  ========================================================= */

  let currentCourseId = null;
  let currentDate = null;
  let bookingModalOpener = null;
  let cartModalOpener = null;
  let paymentInProgress = false;
  let cart = loadCart();

  /* =========================================================
     TRADUCTIONS / FORMATAGE
  ========================================================= */

  function t(key, fallback = "") {
    return typeof window.BYFIGGY_T === "function"
      ? window.BYFIGGY_T(key, fallback)
      : (fallback || key);
  }

  function getCurrentLanguage() {
    const lang = typeof window.BYFIGGY_GET_LANGUAGE === "function"
      ? window.BYFIGGY_GET_LANGUAGE()
      : "fr";

    return {
      fr: "fr-FR",
      en: "en-GB",
      es: "es-ES",
      it: "it-IT",
      de: "de-DE",
      ar: "ar"
    }[lang] || "fr-FR";
  }

  function getCourse(courseId) {
    return COURSES[courseId] || null;
  }

  function getCourseName(courseId) {
    const course = getCourse(courseId);

    if (!course) {
      return "";
    }

    return course.nameKey
      ? t(course.nameKey, course.fallbackName)
      : course.fallbackName;
  }

  function isValidCourseDate(courseId, date) {
    const course = getCourse(courseId);

    return Boolean(
      course &&
      course.dates.includes(date)
    );
  }

  function formatMoney(amount) {
    try {
      return new Intl.NumberFormat(
        getCurrentLanguage(),
        {
          style: "currency",
          currency: "EUR",
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        }
      ).format(amount);
    } catch {
      return `${amount} €`;
    }
  }

  function formatDate(isoDate) {
    if (
      typeof isoDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)
    ) {
      return isoDate || "";
    }

    const [year, month, day] =
      isoDate
        .split("-")
        .map(Number);

    const date =
      new Date(
        year,
        month - 1,
        day
      );

    try {
      return new Intl.DateTimeFormat(
        getCurrentLanguage(),
        {
          weekday: "long",
          day: "2-digit",
          month: "long",
          year: "numeric"
        }
      ).format(date);
    } catch {
      return isoDate;
    }
  }

  /* =========================================================
     MESSAGES
  ========================================================= */

  function setBookingMessage(
    message = "",
    type = ""
  ) {
    if (!formMessage) {
      return;
    }

    formMessage.textContent =
      message;

    formMessage.classList.remove(
      "error",
      "success"
    );

    if (type) {
      formMessage.classList.add(type);
    }
  }

  function setCartMessage(
    message = "",
    type = ""
  ) {
    if (!cartMessage) {
      return;
    }

    cartMessage.textContent =
      message;

    cartMessage.classList.remove(
      "error",
      "success"
    );

    if (type) {
      cartMessage.classList.add(type);
    }
  }

  /* =========================================================
     PANIER — STOCKAGE
  ========================================================= */

  function sanitizeCart(rawCart) {
    if (!Array.isArray(rawCart)) {
      return [];
    }

    const merged =
      new Map();

    for (
      const rawItem of rawCart
    ) {
      if (
        !rawItem ||
        typeof rawItem !== "object"
      ) {
        continue;
      }

      const courseId =
        String(
          rawItem.courseId ||
          ""
        );

      const date =
        String(
          rawItem.date ||
          ""
        );

      const quantity =
        Number.parseInt(
          rawItem.quantity,
          10
        );

      if (
        !isValidCourseDate(
          courseId,
          date
        )
      ) {
        continue;
      }

      if (
        !Number.isInteger(quantity) ||
        quantity < 1
      ) {
        continue;
      }

      const key =
        `${courseId}__${date}`;

      const current =
        merged.get(key) ||
        {
          courseId,
          date,
          quantity: 0
        };

      current.quantity =
        Math.min(
          MAX_QUANTITY_PER_LINE,
          current.quantity +
            quantity
        );

      merged.set(
        key,
        current
      );
    }

    return [
      ...merged.values()
    ];
  }

  function loadCart() {
    try {
      const value =
        localStorage.getItem(
          CART_STORAGE_KEY
        );

      return value
        ? sanitizeCart(
            JSON.parse(value)
          )
        : [];
    } catch {
      return [];
    }
  }

  function saveCart() {
    cart =
      sanitizeCart(cart);

    try {
      localStorage.setItem(
        CART_STORAGE_KEY,
        JSON.stringify(cart)
      );
    } catch {
      /* stockage indisponible */
    }

    renderCart();
  }

  function clearCart() {
    cart = [];

    try {
      localStorage.removeItem(
        CART_STORAGE_KEY
      );
    } catch {
      /* stockage indisponible */
    }

    renderCart();
  }

  function getCartQuantity() {
    return cart.reduce(
      (
        sum,
        item
      ) =>
        sum +
        item.quantity,
      0
    );
  }

  function getCartTotal() {
    return cart.reduce(
      (
        sum,
        item
      ) => {
        const course =
          getCourse(
            item.courseId
          );

        return (
          sum +
          (
            course
              ? course.price *
                item.quantity
              : 0
          )
        );
      },
      0
    );
  }

  function addToCart(
    courseId,
    date,
    quantity
  ) {
    if (
      !isValidCourseDate(
        courseId,
        date
      )
    ) {
      throw new Error(t("invalidCourseDate", "Cours ou date invalide."));
    }

    if (
      !Number.isInteger(
        quantity
      ) ||
      quantity < 1 ||
      quantity >
        MAX_QUANTITY_PER_LINE
    ) {
      throw new Error(t("invalidQuantity", "Quantité invalide."));
    }

    const existing =
      cart.find(
        (item) =>
          item.courseId ===
            courseId &&
          item.date ===
            date
      );

    if (existing) {
      const nextQuantity =
        existing.quantity +
        quantity;

      if (
        nextQuantity >
        MAX_QUANTITY_PER_LINE
      ) {
        throw new Error(
          t("maxSeats", "Maximum {n} places pour ce cours et cette date.").replace("{n}", String(MAX_QUANTITY_PER_LINE))
        );
      }

      existing.quantity =
        nextQuantity;
    } else {
      cart.push({
        courseId,
        date,
        quantity
      });
    }

    saveCart();
  }

  function updateCartItem(
    courseId,
    date,
    quantity
  ) {
    const item =
      cart.find(
        (entry) =>
          entry.courseId ===
            courseId &&
          entry.date ===
            date
      );

    if (!item) {
      return;
    }

    if (quantity <= 0) {
      removeCartItem(
        courseId,
        date
      );

      return;
    }

    item.quantity =
      Math.min(
        MAX_QUANTITY_PER_LINE,
        quantity
      );

    saveCart();
  }

  function removeCartItem(
    courseId,
    date
  ) {
    cart =
      cart.filter(
        (item) =>
          !(
            item.courseId ===
              courseId &&
            item.date ===
              date
          )
      );

    saveCart();
  }

  /* =========================================================
     PANIER — AFFICHAGE
  ========================================================= */

  function createCartItemElement(
    item
  ) {
    const course =
      getCourse(
        item.courseId
      );

    const row =
      document.createElement(
        "article"
      );

    row.className =
      "cart-item";

    const info =
      document.createElement(
        "div"
      );

    info.className =
      "cart-item-info";

    const title =
      document.createElement(
        "strong"
      );

    title.textContent =
      getCourseName(
        item.courseId
      );

    const date =
      document.createElement(
        "span"
      );

    date.textContent =
      formatDate(
        item.date
      );

    info.append(
      title,
      date
    );

    const controls =
      document.createElement(
        "div"
      );

    controls.className =
      "cart-item-controls";

    const minus =
      document.createElement(
        "button"
      );

    minus.type =
      "button";

    minus.className =
      "cart-qty-button";

    minus.textContent =
      "−";

    minus.setAttribute(
      "aria-label",
      t("removeSeat", "Retirer une place")
    );

    minus.addEventListener(
      "click",
      () => {
        updateCartItem(
          item.courseId,
          item.date,
          item.quantity - 1
        );
      }
    );

    const quantity =
      document.createElement(
        "span"
      );

    quantity.className =
      "cart-qty-value";

    quantity.textContent =
      String(
        item.quantity
      );

    const plus =
      document.createElement(
        "button"
      );

    plus.type =
      "button";

    plus.className =
      "cart-qty-button";

    plus.textContent =
      "+";

    plus.setAttribute(
      "aria-label",
      t("addSeat", "Ajouter une place")
    );

    plus.disabled =
      item.quantity >=
      MAX_QUANTITY_PER_LINE;

    plus.addEventListener(
      "click",
      () => {
        updateCartItem(
          item.courseId,
          item.date,
          item.quantity + 1
        );
      }
    );

    controls.append(
      minus,
      quantity,
      plus
    );

    const price =
      document.createElement(
        "strong"
      );

    price.className =
      "cart-item-price";

    price.textContent =
      formatMoney(
        course.price *
        item.quantity
      );

    const remove =
      document.createElement(
        "button"
      );

    remove.type =
      "button";

    remove.className =
      "cart-remove-button";

    remove.textContent =
      t("remove", "SUPPRIMER");

    remove.addEventListener(
      "click",
      () => {
        removeCartItem(
          item.courseId,
          item.date
        );
      }
    );

    row.append(
      info,
      controls,
      price,
      remove
    );

    return row;
  }

  function renderCart() {
    const totalQuantity =
      getCartQuantity();

    if (cartCount) {
      cartCount.textContent =
        String(
          totalQuantity
        );

      cartCount.setAttribute(
        "aria-label",
        t("cartItemsAria", "{n} article(s) dans le panier").replace("{n}", String(totalQuantity))
      );
    }

    if (!cartItems) {
      return;
    }

    cartItems.replaceChildren();

    for (
      const item of cart
    ) {
      cartItems.appendChild(
        createCartItemElement(
          item
        )
      );
    }

    const hasItems =
      cart.length > 0;

    if (cartEmpty) {
      cartEmpty.hidden =
        hasItems;
    }

    if (cartSummary) {
      cartSummary.hidden =
        !hasItems;
    }

    if (cartCheckoutForm) {
      cartCheckoutForm.hidden =
        !hasItems;
    }

    if (cartTotal) {
      cartTotal.textContent =
        formatMoney(
          getCartTotal()
        );
    }
  }

  /* =========================================================
     MODALE RÉSERVATION
  ========================================================= */

  function getQuantity() {
    if (!quantityInput) {
      return 1;
    }

    const quantity =
      Number.parseInt(
        quantityInput.value,
        10
      );

    return (
      Number.isInteger(
        quantity
      ) &&
      quantity >= 1 &&
      quantity <=
        MAX_QUANTITY_PER_LINE
    )
      ? quantity
      : null;
  }

  function updateBookingSummary() {
    if (
      !currentCourseId ||
      !currentDate
    ) {
      return;
    }

    const course =
      getCourse(
        currentCourseId
      );

    if (!course) {
      return;
    }

    const quantity =
      getQuantity() || 1;

    if (selectedCourse) {
      selectedCourse.textContent =
        getCourseName(
          currentCourseId
        );
    }

    if (selectedDate) {
      selectedDate.textContent =
        formatDate(
          currentDate
        );
    }

    if (selectedPrice) {
      selectedPrice.textContent =
        formatMoney(
          course.price *
          quantity
        );
    }
  }

  function openBooking(
    courseId,
    date,
    opener = null
  ) {
    if (
      !bookingModal ||
      !bookingForm
    ) {
      return;
    }

    if (
      !isValidCourseDate(
        courseId,
        date
      )
    ) {
      return;
    }

    closeCart(false);

    currentCourseId =
      courseId;

    currentDate =
      date;

    bookingModalOpener =
      opener ||
      document.activeElement;

    bookingForm.reset();

    if (quantityInput) {
      quantityInput.value =
        "1";
    }

    setBookingMessage("");

    updateBookingSummary();

    bookingModal.classList.add(
      "open"
    );

    bookingModal.setAttribute(
      "aria-hidden",
      "false"
    );

    document.body.classList.add(
      "modal-open"
    );

    window.requestAnimationFrame(
      () =>
        quantityInput?.focus()
    );
  }

  function closeBooking(
    restoreFocus = true
  ) {
    if (!bookingModal) {
      return;
    }

    bookingModal.classList.remove(
      "open"
    );

    bookingModal.setAttribute(
      "aria-hidden",
      "true"
    );

    if (
      !cartModal
        ?.classList
        .contains("open")
    ) {
      document.body.classList.remove(
        "modal-open"
      );
    }

    if (
      restoreFocus &&
      bookingModalOpener &&
      typeof bookingModalOpener.focus ===
        "function"
    ) {
      bookingModalOpener.focus();
    }

    bookingModalOpener =
      null;
  }

  /* =========================================================
     MODALE PANIER
  ========================================================= */

  function openCart(
    opener = null
  ) {
    if (!cartModal) {
      return;
    }

    closeBooking(false);

    renderCart();

    cartModalOpener =
      opener ||
      document.activeElement;

    cartModal.classList.add(
      "open"
    );

    cartModal.setAttribute(
      "aria-hidden",
      "false"
    );

    document.body.classList.add(
      "modal-open"
    );

    window.requestAnimationFrame(
      () => {
        if (
          cart.length &&
          cartFirstName
        ) {
          cartFirstName.focus();
        } else {
          cartModal
            .querySelector(
              "[data-cart-close]"
            )
            ?.focus();
        }
      }
    );
  }

  function closeCart(
    restoreFocus = true
  ) {
    if (!cartModal) {
      return;
    }

    cartModal.classList.remove(
      "open"
    );

    cartModal.setAttribute(
      "aria-hidden",
      "true"
    );

    if (
      !bookingModal
        ?.classList
        .contains("open")
    ) {
      document.body.classList.remove(
        "modal-open"
      );
    }

    if (
      restoreFocus &&
      cartModalOpener &&
      typeof cartModalOpener.focus ===
        "function"
    ) {
      cartModalOpener.focus();
    }

    cartModalOpener =
      null;
  }


  function getFocusableElements(modal) {
    if (!modal) return [];

    return [...modal.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )].filter((element) => !element.hidden && element.offsetParent !== null);
  }

  function trapFocus(event, modal) {
    if (event.key !== "Tab" || !modal?.classList.contains("open")) return;

    const focusable = getFocusableElements(modal);
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleEscape(
    event
  ) {
    if (event.key === "Tab") {
      if (cartModal?.classList.contains("open")) {
        trapFocus(event, cartModal);
        return;
      }

      if (bookingModal?.classList.contains("open")) {
        trapFocus(event, bookingModal);
        return;
      }
    }

    if (
      event.key !== "Escape"
    ) {
      return;
    }

    if (
      cartModal
        ?.classList
        .contains("open")
    ) {
      event.preventDefault();

      closeCart();

      return;
    }

    if (
      bookingModal
        ?.classList
        .contains("open")
    ) {
      event.preventDefault();

      closeBooking();
    }
  }

  /* =========================================================
     VALIDATION CHECKOUT
  ========================================================= */

  function isValidEmail(
    value
  ) {
    if (
      typeof value !== "string"
    ) {
      return false;
    }

    const email =
      value.trim();

    return (
      email.length > 3 &&
      email.length <= 254 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email
      )
    );
  }

  function validateCheckoutForm() {
    const firstName =
      cartFirstName
        ?.value
        .trim() ||
      "";

    const email =
      cartEmail
        ?.value
        .trim() ||
      "";

    if (
      cart.length === 0
    ) {
      setCartMessage(
        t("emptyCart", "Votre panier est vide."),
        "error"
      );

      return false;
    }

    if (
      firstName.length < 1 ||
      firstName.length > 60
    ) {
      setCartMessage(
        t("invalidFirstName", "Veuillez saisir votre prénom."),
        "error"
      );

      cartFirstName
        ?.focus();

      return false;
    }

    if (
      !isValidEmail(email)
    ) {
      setCartMessage(
        t("invalidEmail", "Veuillez saisir une adresse e-mail valide."),
        "error"
      );

      cartEmail
        ?.focus();

      return false;
    }

    return true;
  }

  /* =========================================================
     PAYPAL — API SERVEUR
  ========================================================= */

  async function createServerOrder() {
    if (!cart.length) {
      throw new Error(t("emptyCart", "Votre panier est vide."));
    }

    const response =
      await fetch(
        "/api/paypal/create-order",
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json"
          },

          credentials:
            "same-origin",

          body:
            JSON.stringify({
              items:
                cart.map(
                  (item) => ({
                    courseId:
                      item.courseId,

                    date:
                      item.date,

                    quantity:
                      item.quantity
                  })
                )
            })
        }
      );

    const data =
      await response
        .json()
        .catch(
          () => ({})
        );

    if (
      !response.ok
    ) {
      throw new Error(
        data.error ||
        t("orderCreateFailed", "Impossible de créer la commande PayPal.")
      );
    }

    if (
      typeof data.orderId !==
        "string" ||
      !data.orderId
    ) {
      throw new Error(
        t("invalidServerOrder", "Le serveur n'a pas retourné de commande PayPal valide.")
      );
    }

    if (
      typeof data.approvalUrl !==
        "string" ||
      !data.approvalUrl
    ) {
      throw new Error(
        t("missingPayPalLink", "Le serveur n'a pas retourné le lien PayPal.")
      );
    }

    return data;
  }

  async function captureServerOrder(
    orderId
  ) {
    const response =
      await fetch(
        "/api/paypal/capture-order",
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json"
          },

          credentials:
            "same-origin",

          body:
            JSON.stringify({
              orderId
            })
        }
      );

    const data =
      await response
        .json()
        .catch(
          () => ({})
        );

    if (
      !response.ok
    ) {
      throw new Error(
        data.error ||
        t("captureFailed", "Impossible de confirmer le paiement.")
      );
    }

    return data;
  }

  /* =========================================================
     PAYPAL — SAUVEGARDE AVANT REDIRECTION
  ========================================================= */

  function savePayPalCheckout(
    orderId
  ) {
    const snapshot = {
      orderId,

      items:
        cart.map(
          (item) => ({
            ...item
          })
        )
    };

    sessionStorage.setItem(
      PAYPAL_STORAGE_KEY,
      JSON.stringify(
        snapshot
      )
    );
  }

  function getSavedPayPalCheckout() {
    try {
      const value =
        sessionStorage.getItem(
          PAYPAL_STORAGE_KEY
        );

      return value
        ? JSON.parse(value)
        : null;
    } catch {
      return null;
    }
  }

  function clearSavedPayPalCheckout() {
    try {
      sessionStorage.removeItem(
        PAYPAL_STORAGE_KEY
      );
    } catch {
      /* rien */
    }
  }

  function cleanPayPalUrl() {
    const hash =
      window.location.hash ||
      "#planning";

    const cleanUrl =
      `${window.location.pathname}${hash}`;

    window.history.replaceState(
      {},
      "",
      cleanUrl
    );
  }

  async function startPayPalPayment() {
    if (
      paymentInProgress
    ) {
      return;
    }

    if (!cart.length) {
      setCartMessage(t("emptyCart", "Votre panier est vide."), "error");
      return;
    }

    paymentInProgress =
      true;

    setCartMessage(
      t("paypalRedirect", "Redirection vers PayPal…")
    );

    if (
      cartPayPalButton
    ) {
      cartPayPalButton.disabled =
        true;
    }

    try {
      const {
        orderId,
        approvalUrl
      } =
        await createServerOrder();

      savePayPalCheckout(
        orderId
      );

      window.location.assign(
        approvalUrl
      );
    } catch (error) {
      paymentInProgress =
        false;

      if (
        cartPayPalButton
      ) {
        cartPayPalButton.disabled =
          false;
      }

      console.error(
        "PayPal :",
        error
      );

      openCart();

      setCartMessage(
        error?.message ||
        t("paymentError", "Une erreur est survenue pendant le paiement."),
        "error"
      );
    }
  }

  async function handlePayPalReturn() {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const paypalStatus =
      params.get(
        "paypal"
      );

    if (
      paypalStatus !== "success" &&
      paypalStatus !== "cancel"
    ) {
      return;
    }

    const saved =
      getSavedPayPalCheckout();

    if (!saved) {
      cleanPayPalUrl();

      openCart();

      setCartMessage(
        t("missingSavedPayment", "Impossible de retrouver les informations du paiement PayPal."),
        "error"
      );

      return;
    }

    if (
      Array.isArray(
        saved.items
      ) &&
      saved.items.length
    ) {
      cart =
        sanitizeCart(
          saved.items
        );

      saveCart();
    }

    openCart();

    if (
      paypalStatus === "cancel"
    ) {
      paymentInProgress =
        false;

      clearSavedPayPalCheckout();

      cleanPayPalUrl();

      if (
        cartPayPalButton
      ) {
        cartPayPalButton.disabled =
          false;
      }

      setCartMessage(
        t("paymentCancelled", "Le paiement PayPal a été annulé. Votre panier a été conservé."),
        "error"
      );

      return;
    }

    const token =
      params.get(
        "token"
      );

    if (!token) {
      cleanPayPalUrl();

      setCartMessage(
        t("missingPayPalToken", "PayPal n'a pas retourné l'identifiant de commande."),
        "error"
      );

      return;
    }

    if (
      saved.orderId &&
      saved.orderId !==
        token
    ) {
      clearSavedPayPalCheckout();

      cleanPayPalUrl();

      setCartMessage(
        t("orderMismatch", "La commande PayPal retournée ne correspond pas au panier."),
        "error"
      );

      return;
    }

    paymentInProgress =
      true;

    if (
      cartPayPalButton
    ) {
      cartPayPalButton.disabled =
        true;
    }

    setCartMessage(
      t("paymentConfirm", "Confirmation du paiement PayPal…")
    );

    try {
      await captureServerOrder(
        token
      );

      paymentInProgress =
        false;

      clearSavedPayPalCheckout();

      cleanPayPalUrl();

      clearCart();

      if (
        cartPayPalButton
      ) {
        cartPayPalButton.disabled =
          false;
      }

      setCartMessage(
        t("paymentAllSuccess", "Paiement confirmé. Toutes vos réservations sont enregistrées."),
        "success"
      );
    } catch (error) {
      paymentInProgress =
        false;

      cleanPayPalUrl();

      if (
        cartPayPalButton
      ) {
        cartPayPalButton.disabled =
          false;
      }

      console.error(
        "Erreur capture PayPal :",
        error
      );

      setCartMessage(
        error?.message ||
        t("captureFailed", "Impossible de confirmer le paiement PayPal."),
        "error"
      );
    }
  }

  /* =========================================================
     FORMULAIRE RÉSERVATION
  ========================================================= */

  function initializeBookingForm() {
    if (!bookingForm) {
      return;
    }

    bookingForm.addEventListener(
      "submit",
      (event) => {
        event.preventDefault();

        const quantity =
          getQuantity();

        if (
          !quantity ||
          !currentCourseId ||
          !currentDate
        ) {
          setBookingMessage(
            t("invalidBooking", "Réservation invalide."),
            "error"
          );

          return;
        }

        try {
          addToCart(
            currentCourseId,
            currentDate,
            quantity
          );

          setBookingMessage("");

          closeBooking(false);

          openCart();

          setCartMessage(
            t("addedCart", "Ajouté au panier."),
            "success"
          );
        } catch (error) {
          setBookingMessage(
            error.message,
            "error"
          );
        }
      }
    );

    quantityInput
      ?.addEventListener(
        "change",
        updateBookingSummary
      );

    quantityInput
      ?.addEventListener(
        "input",
        updateBookingSummary
      );
  }

  /* =========================================================
     BOUTONS / ÉVÉNEMENTS
  ========================================================= */

  async function reserveDirectlyWithPayPal(button) {
    const courseId = button?.dataset?.course;
    const date = button?.dataset?.date;

    if (!isValidCourseDate(courseId, date) || paymentInProgress) {
      return;
    }

    cart = [{
      courseId,
      date,
      quantity: 1
    }];

    saveCart();

    button.disabled = true;
    button.setAttribute("aria-busy", "true");

    try {
      await startPayPalPayment();
    } finally {
      if (!paymentInProgress) {
        button.disabled = false;
        button.removeAttribute("aria-busy");
      }
    }
  }

  function initializeBookingButtons() {
    document
      .querySelectorAll(".reserve-btn")
      .forEach((button) => {
        button.addEventListener("click", () => {
          void reserveDirectlyWithPayPal(button);
        });
      });
  }

  function initializeEventButtons() {
    document
      .querySelectorAll(
        ".event-button"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () => {
              const course =
                button.dataset.course;

              const date =
                button.dataset.date;

              if (
                !isValidCourseDate(
                  course,
                  date
                )
              ) {
                return;
              }

              const params =
                new URLSearchParams({
                  course,
                  date
                });

              window.location.href =
                `index.html?${params.toString()}#planning`;
            }
          );
        }
      );
  }

  function initializeModalButtons() {
    bookingModal
      ?.querySelectorAll(
        "[data-close]"
      )
      .forEach(
        (element) => {
          element.addEventListener(
            "click",
            () =>
              closeBooking()
          );
        }
      );

    cartModal
      ?.querySelectorAll(
        "[data-cart-close]"
      )
      .forEach(
        (element) => {
          element.addEventListener(
            "click",
            () =>
              closeCart()
          );
        }
      );

    cartTrigger
      ?.addEventListener(
        "click",
        () =>
          openCart(
            cartTrigger
          )
      );

    document.addEventListener(
      "keydown",
      handleEscape
    );
  }

  function initializeCheckoutForm() {
    cartCheckoutForm
      ?.addEventListener(
        "submit",
        async (
          event
        ) => {
          event.preventDefault();

          await startPayPalPayment();
        }
      );
  }

  /* =========================================================
     MENU MOBILE
  ========================================================= */

  function updateMenuAccessibility() {
    if (
      !menuToggle ||
      !mainNav
    ) {
      return;
    }

    const isOpen =
      mainNav.classList.contains(
        "mobile-open"
      );

    menuToggle.setAttribute(
      "aria-expanded",
      String(isOpen)
    );

    menuToggle.setAttribute(
      "aria-label",
      isOpen
        ? t(
            "closeMenu",
            "Fermer le menu"
          )
        : t(
            "openMenu",
            "Ouvrir le menu"
          )
    );
  }

  function closeMobileMenu() {
    if (!mainNav) {
      return;
    }

    mainNav.classList.remove(
      "mobile-open"
    );

    updateMenuAccessibility();
  }

  function initializeMobileMenu() {
    if (
      !menuToggle ||
      !mainNav
    ) {
      return;
    }

    menuToggle.addEventListener(
      "click",
      () => {
        mainNav.classList.toggle(
          "mobile-open"
        );

        updateMenuAccessibility();
      }
    );

    mainNav
      .querySelectorAll(
        "a"
      )
      .forEach(
        (link) => {
          link.addEventListener(
            "click",
            closeMobileMenu
          );
        }
      );

    window.addEventListener(
      "resize",
      () => {
        if (
          window.innerWidth >
          1024
        ) {
          closeMobileMenu();
        }
      }
    );

    updateMenuAccessibility();
  }


  /* =========================================================
     OUVERTURE DEPUIS EVENT.HTML
  ========================================================= */

  function initializeQueryBooking() {
    const params = new URLSearchParams(window.location.search);
    const course = params.get("course");
    const date = params.get("date");

    if (!course || !date || !isValidCourseDate(course, date)) {
      return;
    }

    const cleanUrl = `${window.location.pathname}${window.location.hash || "#planning"}`;
    window.history.replaceState({}, "", cleanUrl);

    cart = [{ courseId: course, date, quantity: 1 }];
    saveCart();
    void startPayPalPayment();
  }

  /* =========================================================
     LANGUES / LIENS
  ========================================================= */

  function refreshTranslatedInterface() {
    updateBookingSummary();

    renderCart();

    updateMenuAccessibility();
  }


  function initializeCourseDateLinks() {
    document
      .querySelectorAll(
        ".course-date-link"
      )
      .forEach(
        (link) => {
          link.addEventListener(
            "click",
            closeMobileMenu
          );
        }
      );
  }

  /* =========================================================
     CHANGEMENT DE LANGUE
  ========================================================= */

  window.addEventListener("byfiggy:languagechange", () => {
    renderCart();

    if (currentCourseId && currentDate) {
      const course = getCourse(currentCourseId);
      if (selectedCourse) selectedCourse.textContent = getCourseName(currentCourseId);
      if (selectedDate) selectedDate.textContent = formatDate(currentDate);
      if (selectedPrice && course) selectedPrice.textContent = formatMoney(course.price);
    }
  });

  /* =========================================================
     INITIALISATION
  ========================================================= */

  function init() {
    renderCart();

    initializeBookingButtons();

    initializeEventButtons();

    initializeModalButtons();

    initializeBookingForm();

    initializeCheckoutForm();

    initializeMobileMenu();


    initializeCourseDateLinks();


    initializeQueryBooking();

    void handlePayPalReturn();
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      {
        once: true
      }
    );
  } else {
    init();
  }
})();

/* =========================================================
   INTERACTIONS VISUELLES — BY FIGGY
========================================================= */
(() => {
  const header = document.getElementById("siteHeader");
  const scrollTopBtn = document.getElementById("scrollTopBtn");
  const revealElements = document.querySelectorAll(".reveal");

  function updateHeader() {
    header?.classList.toggle("scrolled", window.scrollY > 40);

    if (scrollTopBtn) {
      scrollTopBtn.style.display = window.scrollY > 500 ? "grid" : "none";
      scrollTopBtn.style.placeItems = "center";
    }
  }

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        });
      },
      { threshold: 0.12 }
    );

    revealElements.forEach((element) => observer.observe(element));
  } else {
    revealElements.forEach((element) => element.classList.add("is-visible"));
  }

  scrollTopBtn?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  window.addEventListener("scroll", updateHeader, { passive: true });
  updateHeader();
})();
