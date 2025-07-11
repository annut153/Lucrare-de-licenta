const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

// Middleware: actualizează programările 'intarziat' în 'anulata' dacă au trecut 5 minute de la ora programată
async function updateIntarziateToAnulate(req, res, next) {
  try {
    const db = getDb();
    if (!db) return next();
    // Selectează programările 'intarziat' care au depășit 5 minute de la ora programată
    const now = new Date();
    const azi = now.toISOString().split('T')[0];
    const hhmm = now.toTimeString().slice(0,5);
    // Ia toate programările intarziate de azi
    const intarziate = await db.all(`
      SELECT id_programare, ora, data FROM programare
      WHERE status = 'intarziat' AND data = ?
    `, [azi]);
    for (const prog of intarziate) {
      // Calculează dacă au trecut 5 minute de la ora programată
      const [h, m] = prog.ora.split(':').map(Number);
      const progDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
      if (now - progDate > 5*60*1000) {
        // Marchează ca anulata
        await db.run(`UPDATE programare SET status = 'anulata' WHERE id_programare = ?`, [prog.id_programare]);
        console.log(`[AUTO] Programare ${prog.id_programare} trecută din 'intarziat' în 'anulata' (au trecut peste 5 min de la ora programată)`);
      }
    }
    next();
  } catch (err) {
    console.error('[AUTO] Eroare la actualizarea statusului programărilor intarziate:', err);
    next();
  }
}

// Toate programările unui medic (cu filtrare opțională după status) - TREBUIE SĂ FIE ÎNAINTEA RUTEI /medic/:id_medic/:data
router.get('/medic/:id_medic/all', updateIntarziateToAnulate, async (req, res) => {
  try {
    const db = getDb();
    if (!db) {
      return res.status(500).json({ message: 'Baza de date nu este disponibilă' });
    }

    const { id_medic } = req.params;
    const { status } = req.query;
    
    let query = `
      SELECT p.id_programare, p.data, p.ora, p.status,
             pa.nume || ' ' || pa.prenume as nume_pacient,
             pa.telefon
      FROM programare p
      LEFT JOIN pacient pa ON p.id_pacient = pa.id_pacient
      WHERE p.id_medic = ?
    `;
    
    const params = [id_medic];
    
    if (status && status !== 'toate') {
      query += ' AND p.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY p.data DESC, p.ora DESC';
    
    console.log('Executing query:', query, 'with params:', params);
    const programari = await db.all(query, params);
    console.log('Found programari:', programari.length);
    res.json(programari || []);
  } catch (err) {
    console.error('Eroare la încărcarea programărilor medicului:', err);
    res.status(500).json({ message: 'Eroare la încărcarea programărilor' });
  }
});

// Verifică dacă un pacient are programare la un medic într-o anumită zi
router.get('/verifica/:id_pacient/:id_medic/:data', async (req, res) => {
  try {
    const db = getDb();
    if (!db) {
      return res.status(500).json({ message: 'Baza de date nu este disponibilă' });
    }

    const { id_pacient, id_medic, data } = req.params;
    const programare = await db.get(
      `SELECT * FROM programare WHERE id_pacient = ? AND id_medic = ? AND data = ? AND status != 'anulata'`,
      [id_pacient, id_medic, data]
    );
    res.json({ areProgramare: !!programare, programare });
  } catch (err) {
    res.status(500).json({ message: 'Eroare la verificarea programării', error: err.message });
  }
});

// Programările unui medic într-o anumită zi
router.get('/medic/:id_medic/:data', updateIntarziateToAnulate, async (req, res) => {
  try {
    const db = getDb();
    if (!db) {
      return res.status(500).json({ message: 'Baza de date nu este disponibilă' });
    }

    const { id_medic, data } = req.params;
    const programari = await db.all(`
      SELECT p.id_programare, p.id_pacient, p.ora, p.status,
             pa.nume || ' ' || pa.prenume as nume_pacient
      FROM programare p
      JOIN pacient pa ON p.id_pacient = pa.id_pacient
      WHERE p.id_medic = ? AND p.data = ? AND p.status != 'anulata'
      ORDER BY p.ora ASC
    `, [id_medic, data]);
    res.json(programari || []);
  } catch (err) {
    console.error('Eroare la încărcarea programărilor zilnice:', err);
    res.status(500).json({ message: 'Eroare la încărcarea programărilor' });
  }
});

// Istoric programări
router.get('/:id', updateIntarziateToAnulate, async (req, res) => {
  try {
    const db = getDb();
    if (!db) {
      return res.status(500).json({ message: 'Baza de date nu este disponibilă' });
    }

    const rows = await db.all(
      `SELECT p.id_programare, p.data, p.ora, p.status, m.nume AS medic, m.specializare
       FROM programare p
       JOIN medic m ON p.id_medic = m.id_medic
       WHERE p.id_pacient = ?
       ORDER BY p.data DESC, p.ora DESC`,
      [req.params.id]
    );
    res.json(rows || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Eroare la încărcarea programărilor' });
  }
});

// Salvare programare
router.post('/', async (req, res) => {
  const { id_pacient, id_medic, data, ora } = req.body;
  try {
    const db = getDb();
    if (!db) {
      return res.status(500).json({ message: 'Baza de date nu este disponibilă' });
    }

    await db.run(
      `INSERT INTO programare (id_pacient, id_medic, data, ora, status)
       VALUES (?, ?, ?, ?, 'programata')`,
      [id_pacient, id_medic, data, ora]
    );
    // --- Emitere eveniment Socket.IO pentru medic ---
    const io = req.app.get('io');
    if (io && id_medic) {
      io.to('medic_' + id_medic).emit('programare-noua', { id_medic, data, ora });
    }
    res.status(201).json({ message: 'Programare înregistrată cu succes' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Eroare la salvarea programării' });
  }
});

// Șterge o programare
router.delete('/:id', async (req, res) => {
  try {
    const db = getDb();
    if (!db) {
      return res.status(500).json({ message: 'Baza de date nu este disponibilă' });
    }

    const { id } = req.params;
    const result = await db.run(
      `UPDATE programare SET status = 'anulata' WHERE id_programare = ?`,
      [id]
    );
    
    if (result.changes > 0) {
      res.json({ message: 'Programarea a fost anulată cu succes' });
    } else {
      res.status(404).json({ message: 'Programarea nu a fost găsită' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Eroare la anularea programării' });
  }
});

module.exports = router; 