// Controller pentru coada de așteptare per medic
const { getDb } = require('../db');

// Status coadă pentru un medic
exports.statusCoadaMedic = async (req, res) => {
  try {
    const id_medic = req.params.id;
    const azi = new Date().toISOString().split('T')[0];
    const oraCurenta = new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
    const queryTotal = `
      SELECT COUNT(*) as nr FROM (
        SELECT id_pacient FROM coada_asteptare WHERE id_medic = ? AND data = ? AND status = 'in_asteptare'
        UNION ALL
        SELECT id_pacient FROM programare WHERE id_medic = ? AND data = ? AND status = 'programata' AND ora >= ?
      ) as total
    `;
    const resultTotal = await getDb().get(queryTotal, [id_medic, azi, id_medic, azi, oraCurenta]);
    const numar_pacienti_in_fata = resultTotal ? resultTotal.nr : 0;
    const queryMedie = `
      SELECT AVG(durata) as durata_medie
      FROM consultatie
      WHERE id_medic = ?
        AND durata > 0
        AND data >= date('now', '-30 days')
    `;
    const resultMedie = await getDb().get(queryMedie, [id_medic]);
    let durata_medie_consultatie = resultMedie && resultMedie.durata_medie ? Math.round(resultMedie.durata_medie) : 30;
    if (durata_medie_consultatie <= 0 || isNaN(durata_medie_consultatie)) durata_medie_consultatie = 30;
    const timp_estimare = numar_pacienti_in_fata * durata_medie_consultatie;
    res.json({
      numar_pacienti_in_fata,
      durata_medie_consultatie,
      timp_estimare
    });
  } catch (err) {
    res.status(500).json({ message: 'Eroare la status coadă', error: err.message });
  }
};

// Adaugă pacient la coadă
exports.adaugaLaCoada = async (req, res) => {
  try {
    const id_medic = req.params.id;
    const { id_pacient, data, programare } = req.body;
    if (!id_pacient || !id_medic) {
      return res.status(400).json({ message: 'Lipsesc datele necesare (id_pacient, id_medic)' });
    }
    // Folosește data locală pentru a evita probleme cu timezone-ul
    const now = new Date();
    const dataLocala = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    const azi = data || dataLocala;
    const ora = new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const deja = await getDb().get('SELECT * FROM coada_asteptare WHERE id_pacient = ? AND id_medic = ? AND data = ? AND status = "in_asteptare"', [id_pacient, id_medic, azi]);
    if (deja) {
      return res.status(200).json({ message: 'Ești deja în coadă la acest medic pentru astăzi.' });
    }
    // --- NOU: logica robustă pentru walk-in vs programare ---
    // 1. Obține toți pacienții deja în coadă (in_asteptare, asteptat, in_consultatie)
    let coada = await getDb().all('SELECT id_pacient, status, ora_sosire FROM coada_asteptare WHERE id_medic = ? AND data = ? AND status IN ("in_asteptare", "asteptat", "in_consultatie")', [id_medic, azi]);
    // 2. Obține programările viitoare (neanulate, nefinalizate)
    const limitaIntarziereMin = 10;
    const programari = await getDb().all('SELECT id_pacient, ora FROM programare WHERE id_medic = ? AND data = ? AND status = "programata"', [id_medic, azi]);
    // 3. Calculează timpul mediu de consultație
    const resultMedie = await getDb().get('SELECT AVG(durata) as durata_medie FROM consultatie WHERE id_medic = ? AND durata > 0 AND data >= date("now", "-30 days")', [id_medic]);
    let durata_medie = resultMedie && resultMedie.durata_medie ? Math.round(resultMedie.durata_medie) : 30;
    if (durata_medie <= 0 || isNaN(durata_medie)) durata_medie = 30;
    // 4. Simulează coada extinsă (inclusiv programări "rezervate")
    let coadaExtinsa = [...coada];
    for (const prog of programari) {
      if (!coadaExtinsa.some(c => c.id_pacient == prog.id_pacient)) {
        // Dacă ora programării + limita de întârziere nu a trecut, adaugă ca "rezervat"
        const [h, m] = prog.ora.split(":").map(Number);
        const progDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
        const limitaDate = new Date(progDate.getTime() + limitaIntarziereMin*60000);
        if (now <= limitaDate) {
          coadaExtinsa.push({ id_pacient: prog.id_pacient, status: 'rezervat', ora_sosire: prog.ora });
        }
      }
    }
    // Ordonează: in_consultatie primul, apoi după ora_sosire (inclusiv "rezervat")
    coadaExtinsa = coadaExtinsa.sort((a, b) => {
      if (a.status === 'in_consultatie') return -1;
      if (b.status === 'in_consultatie') return 1;
      return a.ora_sosire.localeCompare(b.ora_sosire);
    });
    // 5. Calculează timpul estimat de așteptare pentru walk-in dacă ar fi pus la finalul cozii
    let pozitieWalkIn = coadaExtinsa.length + 1;
    let timpEstimareWalkIn = (pozitieWalkIn - 1) * durata_medie;
    // 6. Pentru fiecare programare "rezervată" din coadă, verifică dacă walk-in-ul ar depăși limita de întârziere
    let trebuiePusDupa = false;
    for (const prog of programari) {
      // Caută poziția programării în coada extinsă
      const idx = coadaExtinsa.findIndex(c => c.id_pacient == prog.id_pacient);
      if (idx !== -1) {
        // Timp estimat până la programare (nr. pacienți în față * durata_medie)
        const timpPanaLaProg = idx * durata_medie;
        const [h, m] = prog.ora.split(":").map(Number);
        const progDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
        const limitaDate = new Date(progDate.getTime() + limitaIntarziereMin*60000);
        // Dacă walk-in-ul ar depăși limita, marchează să fie pus după programare
        if ((pozitieWalkIn - 1) * durata_medie > (limitaDate.getTime() - now.getTime())/60000) {
          trebuiePusDupa = true;
          console.log(`[COADA LOGICĂ] Walk-in ${id_pacient} ar depăși limita de întârziere a programării ${prog.id_pacient}, va fi plasat după programare.`);
          break;
        }
      }
    }
    if (trebuiePusDupa) {
      // Plasează walk-in-ul după ultima programare "rezervată"
      // Găsește ultima poziție a unei programări "rezervate"
      let lastProgIdx = -1;
      for (let i = coadaExtinsa.length - 1; i >= 0; i--) {
        if (coadaExtinsa[i].status === 'rezervat') {
          lastProgIdx = i;
          break;
        }
      }
      // Inserează walk-in-ul după ultima programare "rezervată"
      coadaExtinsa.splice(lastProgIdx + 1, 0, { id_pacient, status: 'in_asteptare', ora_sosire: ora });
      // Adaugă în baza de date la ora potrivită
      await getDb().run('INSERT INTO coada_asteptare (id_pacient, id_medic, data, ora_sosire, status) VALUES (?, ?, ?, ?, "in_asteptare")', [id_pacient, id_medic, azi, ora]);
      // Emitere eveniment Socket.IO
      const io = req.app.get('io');
      if (io) {
        io.to('medic_' + id_medic).emit('queue-updated', { id_medic });
        io.to('pacient_' + id_pacient).emit('status-updated', { id_pacient, id_medic });
      }
      return res.status(201).json({ message: 'Ai fost adăugat(ă) la coadă după programările rezervate!' });
    }
    // --- LOGICA EXISTENTĂ ---
    // Verifică dacă pacientul are programare
    const programarePacient = await getDb().get(`
      SELECT p.ora, p.status 
      FROM programare p 
      WHERE p.id_pacient = ? AND p.id_medic = ? AND p.data = ? AND p.status != 'anulata'
    `, [id_pacient, id_medic, azi]);
    // Verifică dacă există un pacient în consultație (walk-in)
    const pacientInConsultatie = await getDb().get(`
      SELECT ca.id_pacient, ca.ora_sosire
      FROM coada_asteptare ca
      WHERE ca.id_medic = ? AND ca.data = ? AND ca.status = 'in_consultatie'
    `, [id_medic, azi]);
    // Dacă pacientul are programare și există un walk-in în consultație, 
    // și programarea este în timpul consultației walk-in-ului, plasează-l după walk-in
    if (programarePacient && pacientInConsultatie) {
      const [hProg, mProg] = programarePacient.ora.split(':').map(Number);
      const oraProg = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hProg, mProg);
      const [hWalkIn, mWalkIn] = pacientInConsultatie.ora_sosire.split(':').map(Number);
      const oraWalkIn = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hWalkIn, mWalkIn);
      // Calculează durata medie de consultație
      const resultMedie = await getDb().get(`
        SELECT AVG(durata) as durata_medie
        FROM consultatie
        WHERE id_medic = ? AND durata > 0 AND data >= date('now', '-30 days')
      `, [id_medic]);
      let durata_medie = resultMedie && resultMedie.durata_medie ? Math.round(resultMedie.durata_medie) : 30;
      if (durata_medie <= 0 || isNaN(durata_medie)) durata_medie = 30;
      // Estimează când se va termina consultația walk-in-ului
      const timpEstimareConsultatieWalkIn = oraWalkIn.getTime() + (durata_medie * 60 * 1000);
      // Dacă programarea este în timpul consultației walk-in-ului, plasează-l după walk-in
      if (oraProg.getTime() < timpEstimareConsultatieWalkIn) {
        console.log(`[COADA] Pacientul cu programare ${id_pacient} ajunge în timpul consultației walk-in-ului ${pacientInConsultatie.id_pacient}, va fi plasat după walk-in`);
        // Adaugă pacientul cu programare după walk-in-ul în consultație
        await getDb().run('INSERT INTO coada_asteptare (id_pacient, id_medic, data, ora_sosire, status) VALUES (?, ?, ?, ?, "in_asteptare")', [id_pacient, id_medic, azi, ora]);
        // Emitere eveniment Socket.IO
        const io = req.app.get('io');
        if (io) {
          io.to('medic_' + id_medic).emit('queue-updated', { id_medic });
          io.to('pacient_' + id_pacient).emit('status-updated', { id_pacient, id_medic });
        }
        res.status(201).json({ message: 'Ai fost adăugat(ă) la coadă după pacientul în curs de consultație!' });
        return;
      }
    }
    // Adaugă normal la sfârșitul cozii
    await getDb().run('INSERT INTO coada_asteptare (id_pacient, id_medic, data, ora_sosire, status) VALUES (?, ?, ?, ?, "in_asteptare")', [id_pacient, id_medic, azi, ora]);
    // Emitere eveniment Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to('medic_' + id_medic).emit('queue-updated', { id_medic });
      io.to('pacient_' + id_pacient).emit('status-updated', { id_pacient, id_medic });
    }
    res.status(201).json({ message: 'Ai fost adăugat(ă) la coadă!' });
  } catch (err) {
    res.status(500).json({ message: 'Eroare la adăugarea la coadă', error: err.message });
  }
};

// Status/poziție pacient în coadă (ordonare cu in_consultatie primul)
exports.statusPacientCoada = async (req, res) => {
  try {
    const id_medic = req.params.id;
    const id_pacient = req.params.id_pacient;
    const now = new Date();
    const azi = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    const oraCurenta = now.toTimeString().slice(0,5); // HH:MM
    // Găsește toți pacienții în coadă
    let coada = await getDb().all('SELECT id_pacient, status, ora_sosire FROM coada_asteptare WHERE id_medic = ? AND data = ? AND status IN ("in_asteptare", "asteptat", "in_consultatie")', [id_medic, azi]);
    // --- NOU: Adaugă programările viitoare (neanulate, nefinalizate) ca "rezervat" ---
    const limitaIntarziereMin = 10; // minute de "grație" după ora programării
    const programari = await getDb().all('SELECT id_pacient, ora FROM programare WHERE id_medic = ? AND data = ? AND status = "programata"', [id_medic, azi]);
    for (const prog of programari) {
      // Verifică dacă pacientul nu e deja în coada_asteptare
      if (!coada.some(c => c.id_pacient == prog.id_pacient)) {
        // Dacă ora programării + limita de întârziere nu a trecut, adaugă ca "rezervat"
        const [h, m] = prog.ora.split(":").map(Number);
        const progDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
        const limitaDate = new Date(progDate.getTime() + limitaIntarziereMin*60000);
        if (now <= limitaDate) {
          coada.push({ id_pacient: prog.id_pacient, status: 'rezervat', ora_sosire: prog.ora });
        }
      }
    }
    // Ordonează: in_consultatie primul, apoi după ora_sosire (inclusiv "rezervat")
    coada = coada.sort((a, b) => {
      if (a.status === 'in_consultatie') return -1;
      if (b.status === 'in_consultatie') return 1;
      return a.ora_sosire.localeCompare(b.ora_sosire);
    });
    console.log('[COADA DEBUG] Coada extinsă pentru medic', id_medic, 'data', azi, ':', coada);
    let pozitie = null, status = null, ora_inceput = null;
    // Caută poziția pacientului
    for (let i = 0; i < coada.length; i++) {
      if (coada[i].id_pacient == id_pacient) {
        pozitie = i + 1;
        status = coada[i].status;
        break;
      }
    }
    if (pozitie === null) {
      // Nu ești în coadă la acest medic pentru azi
      return res.status(404).json({ message: 'Nu ești în coadă la acest medic.' });
    }
    
    // Calculează persoane în față și timp estimat pentru statusul 'in_asteptare'
    const persoane_in_fata = pozitie - 1;
    
    // Calculează durata medie consultație
    const queryMedie = `
      SELECT AVG(durata) as durata_medie
      FROM consultatie
      WHERE id_medic = ?
        AND durata > 0
        AND data >= date('now', '-30 days')
    `;
    const resultMedie = await getDb().get(queryMedie, [id_medic]);
    let durata_medie_consultatie = resultMedie && resultMedie.durata_medie ? Math.round(resultMedie.durata_medie) : 30;
    if (durata_medie_consultatie <= 0 || isNaN(durata_medie_consultatie)) durata_medie_consultatie = 30;
    
    const timp_estimare = persoane_in_fata * durata_medie_consultatie;
    
    console.log('Controller - Calcul coadă:', {
      id_medic,
      id_pacient,
      pozitie,
      persoane_in_fata,
      durata_medie_consultatie,
      timp_estimare
    });
    
    res.json({ 
      pozitie, 
      status, 
      persoane_in_fata, 
      timp_estimare,
      durata_medie_consultatie
    });
  } catch (err) {
    console.error('Eroare la status pacient coadă:', err);
    res.status(500).json({ message: 'Eroare la status pacient coadă', error: err.message });
  }
};

// Anulează prezența la coadă pentru un pacient
exports.anuleazaCoada = async (req, res) => {
  try {
    const { id_pacient, data } = req.body;
    const id_medic = req.params.id;
    if (!id_pacient || !id_medic || !data) {
      return res.status(400).json({ message: 'Lipsesc datele necesare (id_pacient, id_medic, data)' });
    }
    const result = await getDb().run(
      `UPDATE coada_asteptare SET status = 'anulat' WHERE id_pacient = ? AND id_medic = ? AND data = ? AND status IN ('in_asteptare', 'asteptat')`,
      [id_pacient, id_medic, data]
    );
    if (result.changes > 0) {
      // Emitere eveniment Socket.IO
      const io = req.app.get('io');
      if (io) {
        io.to('medic_' + id_medic).emit('queue-updated', { id_medic });
        io.to('pacient_' + id_pacient).emit('status-updated', { id_pacient, id_medic });
      }
      res.json({ message: 'Prezența la coadă a fost anulată cu succes.' });
    } else {
      res.status(404).json({ message: 'Nu există o prezență activă la coadă pentru acest utilizator.' });
    }
  } catch (err) {
    res.status(500).json({ message: 'Eroare la anularea prezenței la coadă', error: err.message });
  }
};

// Acceptă un pacient din coadă
exports.acceptaPacient = async (req, res) => {
  try {
    const { id_pacient, data } = req.body;
    const id_medic = req.params.id;
    if (!id_medic || !id_pacient || !data) {
      return res.status(400).json({ message: 'Lipsesc datele necesare (id_medic, id_pacient, data)' });
    }
    // Setează statusul 'in_consultatie' pentru pacientul acceptat
    const result = await getDb().run(
      'UPDATE coada_asteptare SET status = "in_consultatie" WHERE id_medic = ? AND id_pacient = ? AND data = ? AND status = "in_asteptare"',
      [id_medic, id_pacient, data]
    );
    if (result.changes > 0) {
      console.log(`[COADA] Pacientul ${id_pacient} a fost acceptat în consultație la medicul ${id_medic} pentru data ${data}`);
      // Emitere eveniment Socket.IO
      const io = req.app.get('io');
      if (io) {
        io.to('medic_' + id_medic).emit('queue-updated', { id_medic });
        io.to('pacient_' + id_pacient).emit('status-updated', { id_pacient, id_medic });
      }
      res.json({ message: 'Pacientul a fost acceptat în consultație.' });
    } else {
      res.status(404).json({ message: 'Pacientul nu este în coadă sau nu poate fi acceptat.' });
    }
  } catch (err) {
    res.status(500).json({ message: 'Eroare la acceptarea pacientului', error: err.message });
  }
}; 