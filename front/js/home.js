let menuBtn = document.querySelector('#menu-btn');
let navbar = document.querySelector('.header .nav');
let header = document.querySelector('.header');
let navLinks = document.querySelectorAll('.nav a');

menuBtn.onclick = () => {
  menuBtn.classList.toggle('fa-times');
  navbar.classList.toggle('active');
};

window.onscroll = () => {
  menuBtn.classList.remove('fa-times');
  navbar.classList.remove('active');

  if (window.scrollY > 0) {
    header.classList.add('active');
  } else {
    header.classList.remove('active');
  }
};

navLinks.forEach(link => {
  link.addEventListener('click', () => {
    menuBtn.classList.remove('fa-times');
    navbar.classList.remove('active');
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const isLoggedIn = sessionStorage.getItem("isLoggedIn") === "true";
  const userId = sessionStorage.getItem("userId");
  const programareBtns = document.querySelectorAll(".programare-btn");

  // ✅ Dacă NU e logat → redirecționează la login
  if (!isLoggedIn || !userId) {
    programareBtns.forEach(btn => {
      btn.setAttribute("href", "/html/login.html");
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.href = "/html/login.html";
      });
    });
  } else {
    // ✅ Dacă e logat → redirecționează la pagina pacientului
    programareBtns.forEach(btn => {
      btn.setAttribute("href", "/html/pacient.html");
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.href = "/html/pacient.html";
      });
    });
  }

  // ✅ Forțează refresh la revenirea din cache (Back/Forward)
  window.addEventListener("pageshow", function (event) {
    if (event.persisted || performance.getEntriesByType("navigation")[0].type === "back_forward") {
      window.location.reload();
    }
  });
});
