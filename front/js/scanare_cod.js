document.addEventListener('DOMContentLoaded', async () => {
  const welcomeSection = document.getElementById('welcome-section');
  const selectionSection = document.getElementById('selection-section');
  const queueSection = document.getElementById('queue-section');
  const specializareSelect = document.getElementById('specializare');
  const medicSelect = document.getElementById('medic');
  const infoCoada = document.getElementById('info-coada');
  const optiuniUtilizator = document.getElementById('optiuni-utilizator');
  const menuDiv = document.querySelector('.menu');

  let intervalCoada = null;

  // --- NOU: Actualizează meniul cu nume/prenume dacă ești logat ---
  const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
  const userId = sessionStorage.getItem('userId');
  if (isLoggedIn && userId) {
    // Preia datele pacientului și actualizează meniul
    try {
      const res = await fetch(`/api/pacient/${userId}`);
      if (res.ok) {
        const pacient = await res.json();
        if (menuDiv) {
          menuDiv.innerHTML = `<a href='/html/pacient.html'><i class='fas fa-home'></i> Acasă</a><span class='user-menu'><i class='fas fa-user'></i> ${pacient.nume} ${pacient.prenume}</span>`;
        }
      }
    } catch (err) {}
    welcomeSection.style.display = 'none';
    selectionSection.style.display = 'block';
    queueSection.style.display = 'none';
    populeazaSpecializari();
  }

  // Execută logica de programare doar dacă venim din scanare QR (returnTo sau direct pe scanare_cod.html)
  const urlParams = new URLSearchParams(window.location.search);
  const fromReturnTo = urlParams.has('returnTo') || window.location.pathname.includes('scanare_cod.html');
  const azi = new Date().toISOString().split('T')[0];
  if (fromReturnTo && isLoggedIn && userId) {
    try {
      // const res = await fetch(`/api/programari/${userId}?t=${Date.now()}`);
      // const programari = await res.json();
      // const progAzi = programari.find(p => p.data === azi && p.status !== 'anulata');
      // if (progAzi) {
      //   afiseazaSituatiaCozii(progAzi.id_medic, true, true);
      //   welcomeSection.style.display = 'none';
      //   selectionSection.style.display = 'none';
      //   queueSection.style.display = 'block';
      //   return;
      // }
      // Nu mai face redirect automat la coadă, lasă utilizatorul să selecteze medicul
    } catch (err) {
      console.error('Eroare la verificarea programărilor:', err);
    }
  }
  // Dacă nu are programare azi, continuă cu flow-ul normal

  // Funcție pentru a afișa secțiunea de selectare (după scanare QR)
  function afiseazaSelectare() {
    welcomeSection.style.display = 'none';
    selectionSection.style.display = 'block';
    queueSection.style.display = 'none';
    populeazaSpecializari();
  }

  // Populează specializările
  async function populeazaSpecializari() {
    try {
      const res = await fetch('/api/medici/specializari');
      const specializari = await res.json();
      specializareSelect.innerHTML = '<option value="">-- Selectează specializarea --</option>';
      specializari.forEach(sp => {
        const opt = document.createElement('option');
        opt.value = sp;
        opt.textContent = sp;
        specializareSelect.appendChild(opt);
      });
    } catch (err) {
      console.error('Eroare la încărcarea specializărilor:', err);
    }
  }

  // Populează medicii pentru specializarea selectată
  async function populeazaMedici(specializare) {
    try {
      const res = await fetch(`/api/medici/disponibili?specializare=${encodeURIComponent(specializare)}`);
      const medici = await res.json();
      medicSelect.innerHTML = '<option value="">-- Selectează medicul --</option>';
      medici.forEach(medic => {
        const opt = document.createElement('option');
        opt.value = medic.id;
        opt.textContent = `${medic.nume} (Rating: ${Number(medic.rating).toFixed(2)}/5)`;
        medicSelect.appendChild(opt);
      });
    } catch (err) {
      console.error('Eroare la încărcarea medicilor:', err);
    }
  }

  // Creează butonul de afișare coadă cu clasă specială pentru stilizare
  const btnAfiseazaCoada = document.createElement('button');
  btnAfiseazaCoada.className = 'btn btn-primary btn-afiseaza-coada';
  btnAfiseazaCoada.textContent = 'Vezi coada';
  btnAfiseazaCoada.style.display = 'none';
  selectionSection.appendChild(btnAfiseazaCoada);

  let idMedicSelectat = null;
  let specializareSelectata = null;

  specializareSelect.addEventListener('change', (e) => {
    const specializare = e.target.value;
    specializareSelectata = specializare;
    if (specializare) {
      populeazaMedici(specializare);
      btnAfiseazaCoada.style.display = 'none';
    } else {
      medicSelect.innerHTML = '<option value="">-- Selectează medicul --</option>';
      btnAfiseazaCoada.style.display = 'none';
    }
  });

  medicSelect.addEventListener('change', async (e) => {
    idMedicSelectat = e.target.value;
    if (idMedicSelectat) {
      // Ascunde orice opțiuni sau coadă anterioară
      infoCoada.innerHTML = '';
      infoCoada.className = 'info-coada';
      optiuniUtilizator.innerHTML = '';
      btnAfiseazaCoada.style.display = '';
      queueSection.style.display = 'none';
      selectionSection.style.display = 'block';
    } else {
      infoCoada.innerHTML = '';
      optiuniUtilizator.innerHTML = '';
      queueSection.style.display = 'none';
      selectionSection.style.display = 'block';
      btnAfiseazaCoada.style.display = 'none';
    }
  });

  btnAfiseazaCoada.addEventListener('click', async () => {
    if (idMedicSelectat) {
      await afiseazaSituatiaCoziiNoua(idMedicSelectat, isLoggedIn);
    }
  });

  // Noua funcție pentru afișarea situației cozii cu fluxul cerut
  async function afiseazaSituatiaCoziiNoua(idMedic, isLoggedIn) {
    try {
      const userId = sessionStorage.getItem('userId') || '-1';
      const azi = new Date().toISOString().split('T')[0];
      // Verifică dacă pacientul are programare la acest medic azi
      let mesajProgramare = '';
      let oraProgramare = '';
      let medicNume = '';
      let specializare = '';
      let areProgramareLaMedic = false;
      if (userId !== '-1') {
        // Ia datele medicului
        try {
          const resMedic = await fetch(`/api/medic/${idMedic}`);
          if (resMedic.ok) {
            const medic = await resMedic.json();
            medicNume = medic.nume;
            specializare = medic.specializare;
          }
        } catch {}
        // Caută programare
        try {
          const resProg = await fetch(`/api/programari/verifica/${userId}/${idMedic}/${azi}`);
          if (resProg.ok) {
            const prog = await resProg.json();
            if (prog.areProgramare && prog.ora) {
              oraProgramare = prog.ora;
              areProgramareLaMedic = true;
              mesajProgramare = `<div style='margin-bottom:10px;color:#007bff;font-size:1.13em;font-weight:500;'>Ai programare la Dr. ${medicNume} (${specializare}) la ora <b>${oraProgramare}</b>.</div>`;
            }
          }
        } catch {}
      }
      const res = await fetch(`/api/coada_simulare/${idMedic}/${azi}/${userId}`);
      const simulare = await res.json();
      let statusClass = 'ok';
      let icon = '<i class="fas fa-user-clock icon"></i>';
      let mesaj = '';
      // Afișează statusul cozii
      if (simulare.programare) {
        // Pacient cu programare
        mesaj = `<div class="mesaj-programare">Ai programare la ora <b>${simulare.nextProgOra}</b>.</div>`;
        if (!simulare.ora_sosire) {
          mesaj += `<button id="btn-anunta-sosire" class="btn-sosire">Anunță că ai ajuns</button>`;
        } else {
          mesaj += `<div class="ora-sosire">Ai anunțat sosirea la ora <b>${simulare.ora_sosire}</b>.</div>`;
        }
      } else {
        if (simulare.persoane_in_fata === 0) {
          mesaj = `<div style='margin:8px 0;'><b>Status coadă:</b> <span style='color:#1a7f1a;font-size:1.1em;font-weight:600;'>Liber</span></div><div style='margin:8px 0;'><b>Timp estimat:</b> <span style='color:#1a7f1a;font-size:1.1em;font-weight:600;'>Imediat</span></div>`;
        } else {
          mesaj = `<div style='margin:8px 0;'><b>Persoane în față:</b> <span style='color:#d35400;font-size:1.1em;font-weight:600;'>${simulare.persoane_in_fata}</span></div><div style='margin:8px 0;'><b>Timp estimat de așteptare:</b> <span style='color:#d35400;font-size:1.1em;font-weight:600;'>${Math.round(simulare.timp_estimare)} minute</span></div>`;
        }
      }
      infoCoada.className = 'info-coada ' + statusClass;
      infoCoada.innerHTML = `${icon} ${mesajProgramare}${mesaj}`;
      optiuniUtilizator.innerHTML = '';
      selectionSection.style.display = 'none';
      queueSection.style.display = 'block';
      // Afișează butonul "Vezi opțiuni" dacă nu e programare finalizată
      if (!simulare.programare || (simulare.programare && !simulare.ora_sosire)) {
        infoCoada.innerHTML += `
          <div class="dropdown-container">
            <button id="btn-optiuni" class="btn-optiuni" style="margin-top:12px;">Vezi opțiuni</button>
            <div id="dropdown-optiuni" class="dropdown-optiuni" style="display:none;"></div>
          </div>
        `;
        setTimeout(() => {
          const container = infoCoada.querySelector('.dropdown-container');
          const btn = container.querySelector('#btn-optiuni');
          const dropdown = container.querySelector('#dropdown-optiuni');
          if (btn && dropdown) {
            btn.onclick = () => {
              dropdown.style.display = dropdown.style.display === 'none' ? 'flex' : 'none';
              let optiuni = '';
              if (!simulare.programare) {
                optiuni += `<button class='dropdown-item' id='btn-pune-coada'>Pune-te la coadă</button>`;
                if (simulare.timp_estimare > 60) {
                  optiuni += `<button class='dropdown-item' id='btn-programeaza-altadata'>Fă o programare în altă zi</button>`;
                }
                optiuni += `<button class='dropdown-item' id='btn-anuleaza-pleaca'>Anulează și pleacă</button>`;
              }
              optiuni += `<button class='dropdown-item' id='btn-timp-asteptare'>Află timpul de așteptare</button>`;
              dropdown.innerHTML = optiuni;

              if (!simulare.programare) {
                dropdown.querySelector('#btn-pune-coada').onclick = async () => {
                  await fetch('/api/coada/adauga', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id_pacient: userId, id_medic: idMedic, data: azi, programare: false })
                  });
                  afiseazaSituatiaCoziiNoua(idMedic, isLoggedIn);
                };
                if (simulare.timp_estimare > 60) {
                  dropdown.querySelector('#btn-programeaza-altadata').onclick = () => {
                    window.location.href = '/html/pacient.html';
                  };
                }
                dropdown.querySelector('#btn-anuleaza-pleaca').onclick = () => {
                  infoCoada.innerHTML = '';
                  optiuniUtilizator.innerHTML = '';
                  selectionSection.style.display = 'block';
                  queueSection.style.display = 'none';
                  specializareSelect.value = '';
                  medicSelect.innerHTML = '<option value="">-- Selectează medicul --</option>';
                  btnAfiseazaCoada.style.display = 'none';
                  idMedicSelectat = null;
                  if (intervalCoada) clearInterval(intervalCoada);
                };
              }
              dropdown.querySelector('#btn-timp-asteptare').onclick = () => {
                alert(`Timp estimat de așteptare: ${simulare.timp_estimare} minute`);
              };
            };
          }
        }, 100);
      }
      // Butonul "Anunță că ai ajuns" pentru programare
      setTimeout(() => {
        const btnSosire = document.getElementById('btn-anunta-sosire');
        if (btnSosire) {
          btnSosire.onclick = async () => {
            await fetch('/api/coada/adauga', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id_pacient: userId, id_medic: idMedic, data: azi, programare: true })
            });
            afiseazaSituatiaCoziiNoua(idMedic, isLoggedIn);
          };
        }
      }, 100);
      if (intervalCoada) clearInterval(intervalCoada);
      intervalCoada = setInterval(() => afiseazaSituatiaCoziiNoua(idMedic, isLoggedIn), 15000);
    } catch (err) {
      console.error('Eroare la încărcarea situației cozii (simulare):', err);
    }
  }

  // Funcție pentru a pune la coadă
  window.puneLaCoada = async function(idMedic) {
    const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
    const userId = sessionStorage.getItem('userId');
    if (isLoggedIn && userId) {
      // Oprește orice polling global de coadă
      if (typeof intervalCoada !== 'undefined' && intervalCoada) clearInterval(intervalCoada);
      try {
        const res = await fetch('/api/coada', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_pacient: userId, id_medic: idMedic })
        });
        const data = await res.json();
        alert(data.message || 'Adăugat la coadă!');
        // Afișează statusul cozii pentru pacient, cu id-ul medicului transmis corect
        await afiseazaStatusPersonalCoada(idMedic, userId);
      } catch (err) {
        console.error('Eroare la adăugarea la coadă:', err);
        alert('A apărut o eroare la adăugarea la coadă.');
      }
    } else {
      // fallback pentru utilizator neautentificat (nu ar trebui să ajungă aici)
      const nume = prompt('Introduceți numele pentru a vă pune la coadă:');
      if (!nume) return;
      try {
        const res = await fetch('/api/coada', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_medic: idMedic, nume: nume })
        });
        const data = await res.json();
        alert(data.message || 'Adăugat la coadă!');
      } catch (err) {
        console.error('Eroare la adăugarea la coadă:', err);
        alert('A apărut o eroare la adăugarea la coadă.');
      }
    }
  };

  // Afișează statusul personal în coadă pentru pacientul logat
  let intervalStatusPersonal = null;
  window.afiseazaStatusPersonalCoada = async function(idMedic, idPacient) {
    try {
      if (typeof intervalCoada !== 'undefined' && intervalCoada) clearInterval(intervalCoada);
      const resMedic = await fetch(`/api/medic/${idMedic}`);
      let medicNume = '', specializare = '';
      if (resMedic.ok) {
        const medic = await resMedic.json();
        medicNume = medic.nume;
        specializare = medic.specializare;
      }
      const azi = new Date().toISOString().split('T')[0];
      const resPoz = await fetch(`/api/coada_pacient?medic=${idMedic}&pacient=${idPacient}&data=${azi}`);
      let mesaj = '', statusClass = '', icon = '';
      if (resPoz.ok) {
        const data = await resPoz.json();
        console.log('Status personal coada:', data); // LOG DEBUG
        if (data.consultatie_finalizata) {
          // Mesaj consultație finalizată - stil profesional și prietenos
          statusClass = 'liber';
          icon = '<i class="fas fa-check-circle icon" style="color:#27ae60;font-size:2em;vertical-align:middle;"></i>';
          mesaj = `
            <div style='display:flex;align-items:center;gap:12px;margin-bottom:8px;'>
              ${icon}
              <span style='font-size:1.25em;font-weight:600;color:#27ae60;'>Consultația a fost finalizată</span>
            </div>
            <div style='margin-bottom:10px;color:#2c3e50;font-size:1.08em;'>
              Mulțumim că ai ales serviciile noastre! Consultația ta s-a încheiat cu succes.
            </div>
          `;
          if (data.ora_start && data.ora_sfarsit) {
            mesaj += `<div style='margin-bottom:10px;color:#555;'>
              <b>Interval consultație:</b> ${data.ora_start} - ${data.ora_sfarsit}
            </div>`;
          }
          mesaj += `
            <div style='margin:18px 0 10px 0;padding:14px 18px;background:#f4f8f4;border-radius:10px;border-left:5px solid #27ae60;'>
              <span style='display:block;font-weight:500;color:#1a7f1a;margin-bottom:6px;'>Fișa ta medicală a fost actualizată.</span>
              <span style='color:#444;'>Poți consulta detaliile și istoricul consultațiilor oricând în contul tău personal.</span>
            </div>
            <a href='/html/pacient.html' class='btn btn-primary' style='margin-top:10px;text-decoration:none;padding:12px 28px;border-radius:8px;background:linear-gradient(90deg,#27ae60,#1a7f1a);color:white;font-weight:600;font-size:1.1em;box-shadow:0 2px 8px rgba(39,174,96,0.08);transition:background 0.2s;'>
              <i class="fas fa-notes-medical" style="margin-right:8px;"></i> Accesează fișa medicală
            </a>
          `;
          infoCoada.className = 'info-coada ' + statusClass;
          infoCoada.innerHTML = mesaj;
          optiuniUtilizator.innerHTML = '';
          selectionSection.style.display = 'none';
          queueSection.style.display = 'block';
          if (intervalStatusPersonal) clearInterval(intervalStatusPersonal);
          return;
        } else if (data.status === 'asteptat') {
          statusClass = 'liber';
          icon = '<i class="fas fa-door-open icon"></i>';
          mesaj = `<b>Sunteți așteptat(ă) în cabinet!</b>`;
        } else if (data.status === 'finalizat') {
          statusClass = 'liber';
          icon = '<i class="fas fa-check-circle icon"></i>';
          mesaj = `<div style='margin:8px 0;'><b style='color:#27ae60;font-size:1.1em;'>✅ Consultația ta a fost finalizată cu succes!</b></div>` +
            `<div style='margin:12px 0;padding:12px;background:#e8f5e8;border-radius:8px;border-left:4px solid #27ae60;'>` +
            `<p style='margin:0 0 8px 0;color:#27ae60;font-weight:600;'>💡 Sugestie:</p>` +
            `<p style='margin:0 0 12px 0;color:#2c3e50;'>Poți consulta fișa ta medicală și istoricul consultațiilor în contul tău de pacient.</p>` +
            `<a href='/html/pacient.html' class='btn btn-primary' style='text-decoration:none;padding:10px 20px;border-radius:6px;background:#27ae60;color:white;font-weight:600;display:inline-block;'>` +
            `<i class="fas fa-file-medical"></i> Vezi fișa medicală</a></div>`;
        } else if (data.pozitie === 1 && data.persoane_in_fata === 0) {
          statusClass = 'urmator';
          icon = '<i class="fas fa-user-check icon"></i>';
          mesaj = `<b style='font-size:1.25em;'>Ești următorul la rând!</b><br><span style='color:#1a7f1a;font-weight:500;'>Te rugăm să fii pregătit(ă) pentru a intra în cabinet.</span>`;
        } else if (data.pozitie === 1) {
          statusClass = 'ok';
          icon = '<i class="fas fa-user-check icon"></i>';
          mesaj = `<b>Ești următorul la rând!</b><br>Timp estimat de așteptare: <b>${data.timp_estimare} minute</b>.`;
        } else if (data.persoane_in_fata > 0) {
          statusClass = 'ok';
          icon = '<i class="fas fa-user-clock icon"></i>';
          mesaj = `<div style='margin:8px 0;'><b>Persoane în față:</b> <span style='color:#d35400;font-size:1.1em;font-weight:600;'>${data.persoane_in_fata}</span></div><div style='margin:8px 0;'><b>Timp estimat de așteptare:</b> <span style='color:#d35400;font-size:1.1em;font-weight:600;'>${data.timp_estimare} minute</span></div>`;
        } else {
          statusClass = 'ok';
          icon = '<i class="fas fa-user icon"></i>';
          mesaj = `Ați anunțat că ați ajuns. Vă rugăm să așteptați confirmarea medicului pentru a intra în cabinet.<br>Timp estimat de așteptare: <b>${data.timp_estimare} minute</b>.`;
        }
      } else {
        // Verifică dacă răspunsul conține informații despre consultația finalizată
        if (resPoz.status === 200) {
          const consultatieData = await resPoz.json();
          console.log('Răspuns backend /api/coada_pacient:', consultatieData);
          if (consultatieData.consultatie_finalizata) {
            statusClass = 'liber';
            icon = '<i class="fas fa-check-circle icon"></i>';
            mesaj = `<div style='margin:8px 0;'><b style='color:#27ae60;font-size:1.1em;'>✅ Consultația ta a fost finalizată cu succes!</b></div>`;
            if (consultatieData.ora_start && consultatieData.ora_sfarsit) {
              mesaj += `<div style='margin:8px 0;'><b>Ora consultației:</b> ${consultatieData.ora_start} - ${consultatieData.ora_sfarsit}</div>`;
            }
            mesaj += `<div style='margin:12px 0;padding:12px;background:#e8f5e8;border-radius:8px;border-left:4px solid #27ae60;'>
              <p style='margin:0 0 8px 0;color:#27ae60;font-weight:600;'>💡 Sugestie:</p>
              <p style='margin:0 0 12px 0;color:#2c3e50;'>Consultația s-a încheiat. Poți consulta fișa ta medicală și istoricul consultațiilor în contul tău de pacient.</p>
              <a href='/html/pacient.html' class='btn btn-primary' style='text-decoration:none;padding:10px 20px;border-radius:6px;background:#27ae60;color:white;font-weight:600;display:inline-block;'>
                <i class="fas fa-file-medical"></i> Vezi fișa medicală
              </a>
            </div>`;
            // Ascunde butonul de "Anulează și pleacă"
            optiuniUtilizator.innerHTML = '';
          } else if (consultatieData.pozitie === null && consultatieData.status === null) {
            // Dacă nu mai e în coadă și nu avem consultatie_finalizata, afișează doar mesajul sugestiv și ascunde butonul
            statusClass = 'liber';
            icon = '<i class="fas fa-check-circle icon"></i>';
            mesaj = `<div style='margin:8px 0;'><b style='color:#27ae60;font-size:1.1em;'>✅ Consultația ta a fost finalizată!</b></div>
              <div style='margin:12px 0;padding:12px;background:#e8f5e8;border-radius:8px;border-left:4px solid #27ae60;'>
                <p style='margin:0 0 8px 0;color:#27ae60;font-weight:600;'>💡 Sugestie:</p>
                <p style='margin:0 0 12px 0;color:#2c3e50;'>Poți consulta fișa ta medicală și istoricul consultațiilor în contul tău de pacient.</p>
                <a href='/html/pacient.html' class='btn btn-primary' style='text-decoration:none;padding:10px 20px;border-radius:6px;background:#27ae60;color:white;font-weight:600;display:inline-block;'>
                  <i class="fas fa-file-medical"></i> Vezi fișa medicală
                </a>
              </div>`;
            optiuniUtilizator.innerHTML = '';
          } else {
            mesaj = '<span style="color:red">Nu ești înregistrat(ă) la coadă la acest medic.</span>';
          }
        } else {
          mesaj = '<span style="color:red">Nu ești înregistrat(ă) la coadă la acest medic.</span>';
        }
      }
      infoCoada.className = 'info-coada ' + statusClass;
      infoCoada.innerHTML = `${icon} Ești la coadă la <b>${medicNume}</b> (${specializare})<br>${mesaj}`;
      optiuniUtilizator.innerHTML = `<button id="btn-anuleaza-coada" class="btn btn-secondary">Anulează și pleacă</button>`;
      selectionSection.style.display = 'none';
      queueSection.style.display = 'block';
      if (intervalStatusPersonal) clearInterval(intervalStatusPersonal);
      intervalStatusPersonal = setInterval(() => window.afiseazaStatusPersonalCoada(idMedic, idPacient), 10000);
      document.getElementById('btn-anuleaza-coada').onclick = async function() {
        if (intervalStatusPersonal) clearInterval(intervalStatusPersonal);
        const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
        const userId = sessionStorage.getItem('userId');
        if (isLoggedIn && userId) {
          const azi = new Date().toISOString().split('T')[0];
          try {
            const res = await fetch('/api/coada/anuleaza', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id_pacient: userId, id_medic: idMedic, data: azi })
            });
            if (res.ok) {
              // În loc de reload, revino la selecția medicului și curăță cache-ul
              infoCoada.innerHTML = '';
              optiuniUtilizator.innerHTML = '';
              selectionSection.style.display = 'block';
              queueSection.style.display = 'none';
              // Resetează selecțiile
              specializareSelect.value = '';
              medicSelect.innerHTML = '<option value="">-- Selectează medicul --</option>';
              btnAfiseazaCoada.style.display = 'none';
              idMedicSelectat = null;
              // Forțează o verificare nouă a cozii
              if (intervalCoada) clearInterval(intervalCoada);
            } else {
              alert('Nu s-a putut anula prezența la coadă.');
              window.location.reload();
            }
          } catch (err) {
            alert('Eroare la anulare coadă.');
            window.location.reload();
          }
        } else {
          window.location.reload();
        }
      };
    } catch (err) {
      infoCoada.innerHTML = '<span style=\"color:red\">Eroare la afișarea statusului cozii.</span>';
    }
  }

  // Simulează scanarea QR (pentru test)
  // În realitate, aceasta va fi apelată după scanarea efectivă a codului QR
  window.simuleazaScanareQR = function() {
    afiseazaSelectare();
  };

  // Pentru test, poți apela simuleazaScanareQR() din consolă
  console.log('Pentru a testa scanarea QR, apelă simuleazaScanareQR() în consolă');

  // Afișează situația cozii pentru un medic selectat (fără să te pui la coadă)
  async function afiseazaSituatiaCoziiMedic(idMedic) {
    try {
      const res = await fetch(`/api/coada/${idMedic}`);
      const data = await res.json();
      const numarPacienti = data.numar_pacienti_in_fata;
      const timpEstimare = data.timp_estimare;
      const resMedic = await fetch(`/api/medic/${idMedic}`);
      let medicNume = '', specializare = '';
      if (resMedic.ok) {
        const medic = await resMedic.json();
        medicNume = medic.nume;
        specializare = medic.specializare;
      }
      let mesaj = '';
      if (numarPacienti === 0) {
        mesaj = `<div style='margin:8px 0;'><b>Status coadă:</b> <span style='color:#1a7f1a;font-size:1.1em;font-weight:600;'>Liber</span></div><div style='margin:8px 0;'><b>Timp estimat:</b> <span style='color:#1a7f1a;font-size:1.1em;font-weight:600;'>Imediat</span></div>`;
      } else {
        mesaj = `<div style='margin:8px 0;'><b>Persoane în față:</b> <span style='color:#d35400;font-size:1.1em;font-weight:600;'>${numarPacienti}</span></div><div style='margin:8px 0;'><b>Timp estimat de așteptare:</b> <span style='color:#d35400;font-size:1.1em;font-weight:600;'>${timpEstimare} minute</span></div>`;
      }
      infoCoada.className = 'info-coada ok';
      infoCoada.innerHTML = `<i class='fas fa-info-circle icon'></i> Situația cozii la <b>${medicNume}</b> (${specializare})<br>${mesaj}`;
      queueSection.style.display = 'block';
    } catch (err) {
      console.error('Eroare la afișarea situației cozii:', err);
    }
  }

  // Adaugă funcția pentru anunțarea sosirii la programare
  window.anuntaSosire = async function(idMedic) {
    const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
    const userId = sessionStorage.getItem('userId');
    if (isLoggedIn && userId) {
      // Oprește orice polling global de coadă
      if (typeof intervalCoada !== 'undefined' && intervalCoada) clearInterval(intervalCoada);
      try {
        const azi = new Date().toISOString().split('T')[0];
        // Trimite POST la /api/coada (backend va prioritiza programările)
        const res = await fetch('/api/coada', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_pacient: userId, id_medic: idMedic, data: azi, programare: true })
        });
        const data = await res.json();
        // Afișează statusul personal în coadă (va arăta mesajul de așteptare)
        await window.afiseazaStatusPersonalCoada(idMedic, userId);
      } catch (err) {
        console.error('Eroare la anunțarea sosirii:', err);
        alert('A apărut o eroare la anunțarea sosirii.');
      }
    } else {
      alert('Trebuie să fii autentificat pentru a anunța sosirea.');
    }
  };
});

// --- SCANARE QR PE MOBIL ---
function isMobile() {
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
}

const btnScanQR = document.getElementById('btn-scan-qr');
const qrReaderDiv = document.getElementById('qr-reader');

if (btnScanQR && qrReaderDiv && isMobile()) {
  btnScanQR.style.display = '';
  btnScanQR.addEventListener('click', () => {
    btnScanQR.style.display = 'none';
    qrReaderDiv.style.display = '';
    const html5QrCode = new Html5Qrcode("qr-reader");
    html5QrCode.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 250 },
      qrCodeMessage => {
        html5QrCode.stop();
        qrReaderDiv.style.display = 'none';
        btnScanQR.style.display = '';
        // Poți procesa rezultatul QR aici (ex: redirecționare, afișare, etc)
        alert('Cod QR scanat: ' + qrCodeMessage);
        // Exemplu: window.location.href = qrCodeMessage;
      },
      errorMessage => {
        // Ignoră erorile de scanare continue
      }
    ).catch(err => {
      alert('Nu s-a putut accesa camera: ' + err);
      qrReaderDiv.style.display = 'none';
      btnScanQR.style.display = '';
    });
  });
}
