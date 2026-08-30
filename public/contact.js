"use strict";

(() => {
  const form = document.getElementById("contactForm");
  const firstName = document.getElementById("contactFirstName");
  const email = document.getElementById("contactEmail");
  const subject = document.getElementById("contactSubject");
  const message = document.getElementById("contactMessage");
  const submit = document.getElementById("contactSubmit");
  const status = document.getElementById("contactFormMessage");

  if (!form) return;

  function t(key, fallback = "") {
    return typeof window.BYFIGGY_T === "function"
      ? window.BYFIGGY_T(key, fallback)
      : (fallback || key);
  }

  const query = new URLSearchParams(window.location.search);
  const objet = query.get("objet");

  const subjectByObject = {
    decouverte: "Call découverte",
    consulting: "Consulting ATE",
    coaching: "Coaching ATE",
    workshop: "Workshop"
  };

  if (objet && subjectByObject[objet] && subject) {
    subject.value = subjectByObject[objet];
  }

  function showStatus(text, type = "") {
    status.textContent = text;
    status.className = `contact-form-message ${type}`.trim();
  }

  function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
      firstName: firstName.value.trim(),
      email: email.value.trim(),
      subject: subject.value,
      message: message.value.trim()
    };

    if (!payload.firstName) {
      showStatus(t("invalidFirstName", "Indiquez votre prénom."), "error");
      firstName.focus();
      return;
    }

    if (!validEmail(payload.email)) {
      showStatus(t("invalidEmail", "Indiquez une adresse e-mail valide."), "error");
      email.focus();
      return;
    }

    if (!payload.subject) {
      showStatus(t("chooseSubject", "Choisissez un sujet."), "error");
      subject.focus();
      return;
    }

    if (!payload.message) {
      showStatus(t("messagePlaceholder", "Écrivez votre message."), "error");
      message.focus();
      return;
    }

    submit.disabled = true;
    showStatus(t("contactSending", "Envoi en cours…"));

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        credentials: "same-origin",
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Le message n’a pas pu être envoyé.");
      }

      form.reset();
      showStatus(t("contactSuccess", "Message envoyé. BY FIGGY vous répondra dès que possible."), "success");
    } catch (error) {
      console.error("Contact :", error);
      showStatus(
        t("contactUnavailable", "Envoi indisponible pour le moment. Vous pouvez écrire à bonjour@byfiggy.fr."),
        "error"
      );
    } finally {
      submit.disabled = false;
    }
  });
})();
