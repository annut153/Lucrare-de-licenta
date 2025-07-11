const API_URL = window.location.origin;

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const formTitle = document.getElementById('form-title');
  const switchToRegister = document.getElementById('switch-to-register');
  const switchToLogin = document.getElementById('switch-to-login');
  const birthdateInput = document.getElementById("birthdate");

  // Switch între formulare
  if (switchToRegister) {
    switchToRegister.addEventListener('click', (e) => {
      e.preventDefault();
      loginForm.style.display = 'none';
      registerForm.style.display = 'block';
      formTitle.textContent = 'Înregistrare';
    });
  }

  if (switchToLogin) {
    switchToLogin.addEventListener('click', (e) => {
      e.preventDefault();
      loginForm.style.display = 'block';
      registerForm.style.display = 'none';
      formTitle.textContent = 'Autentificare';
    });
  }

  // Înregistrare
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      console.log("Trimitem formularul de înregistrare...");

      const nume = document.getElementById('nume').value;
      const prenume = document.getElementById('prenume').value;
      const birthdate = document.getElementById('birthdate').value;
      const email = document.getElementById('email').value;
      const telefon = document.getElementById('telefon').value;
      const parola = document.getElementById('parola').value;
      const confirma = document.getElementById('confirma').value;

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailRegex.test(email)) {
        alert('Te rog introdu un email valid.');
        return;
      }

      if (parola.length < 6) {
        alert('Parola trebuie să aibă cel puțin 6 caractere.');
        return;
      }

      if (parola !== confirma) {
        alert('Parolele nu coincid!');
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nume, prenume, birthdate, email, telefon, parola })
        });

        const data = await response.json();

        if (response.ok) {
          alert(data.message || "Înregistrare reușită!");
          switchToLogin.click();
        } else {
          alert(data.message || "Eroare la înregistrare.");
        }
      } catch (err) {
        console.error(err);
        alert("A apărut o eroare de rețea.");
      }
    });
  }

  // Autentificare
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = document.getElementById('username').value;
      const password = document.getElementById('password').value;

      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
          const { tipUtilizator } = data;
          sessionStorage.setItem("isLoggedIn", "true");
          sessionStorage.setItem("userType", tipUtilizator);

          if (tipUtilizator === "pacient") {
            sessionStorage.setItem("userId", data.pacient.id_pacient);
            // Redirecționare după login
            const params = new URLSearchParams(window.location.search);
            const returnTo = params.get('returnTo');
            if (returnTo) {
              window.location.href = returnTo;
            } else {
            window.location.href = "pacient.html";
            }
          } else if (tipUtilizator === "medic") {
            sessionStorage.setItem("userId", data.medic.id_medic);
            window.location.href = "medic.html";
          }
        } else {
          alert(data.message || "Eroare la autentificare.");
        }
      } catch (err) {
        console.error(err);
        alert("A apărut o eroare de rețea.");
      }
    });
  }

  // Datepicker pentru data nașterii
  if (birthdateInput) {
    flatpickr(birthdateInput, {
      dateFormat: "Y-m-d",
      maxDate: "today",
      allowInput: false,
      disableMobile: true
    });
  }

  // Autodetectare mod înregistrare din URL
  const params = new URLSearchParams(window.location.search);
  if (params.get('register') === 'true' && switchToRegister) {
    switchToRegister.click();
  }
});
