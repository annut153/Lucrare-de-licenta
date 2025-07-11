const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const bcrypt = require('bcrypt');

// Fișa medicală a pacientului
router.get('/fisa/:id_pacient', async (req, res) => {
  try {
    const fisa = await getDb().get(
      `SELECT * FROM fisa_medicala WHERE id_pacient = ?`,
      [req.params.id_pacient]
    );
    if (!fisa) return res.status(404).json({ error: "Fișă medicală inexistentă" });
    res.json(fisa);
  } catch (err) {
    res.status(500).json({ error: "Eroare server" });
  }
});

// Date pacient
router.get('/:id', async (req, res) => {
  try {
    const pacient = await getDb().get(
      `SELECT * FROM pacient WHERE id_pacient = ?`,
      [req.params.id]
    );
    if (!pacient) return res.status(404).json({ error: "Pacient inexistent" });
    res.json(pacient);
  } catch (err) {
    console.error("Eroare la preluarea pacientului:", err.message);
    res.status(500).json({ error: "Eroare server" });
  }
});

// Schimbă parola pentru un pacient
router.post('/:id/schimba-parola', async (req, res) => {
  console.log('POST /api/pacienti/:id/schimba-parola - Request primit');
  console.log('ID pacient:', req.params.id);
  console.log('Body:', req.body);
  
  const { parola } = req.body;
  if (!parola || parola.length < 6) {
    console.log('Eroare validare: parola lipsă sau prea scurtă');
    return res.status(400).json({ message: 'Parola trebuie să aibă minim 6 caractere.' });
  }
  
  try {
    console.log('Începe hashing-ul parolei...');
    const hash = await bcrypt.hash(parola, 10);
    console.log('Parola hash-uită cu succes');
    
    console.log('Actualizează parola în baza de date...');
    const result = await getDb().run('UPDATE pacient SET parola = ? WHERE id_pacient = ?', [hash, req.params.id]);
    console.log('Rezultat update:', result);
    
    if (result.changes > 0) {
      console.log('Parola schimbată cu succes pentru pacientul', req.params.id);
      res.json({ message: 'Parola a fost schimbată cu succes.' });
    } else {
      console.log('Pacient inexistent:', req.params.id);
      res.status(404).json({ message: 'Pacient inexistent.' });
    }
  } catch (err) {
    console.error('Eroare la schimbarea parolei:', err);
    res.status(500).json({ message: 'Eroare la schimbarea parolei.' });
  }
});

// Actualizează mențiunile pentru un pacient
router.put('/mentiuni/:id_pacient', async (req, res) => {
  try {
    const { mentiuni } = req.body;
    const { id_pacient } = req.params;
    
    if (mentiuni === undefined) {
      return res.status(400).json({ message: 'Lipsesc mențiunile' });
    }
    
    const result = await getDb().run(
      'UPDATE pacient SET mentiuni = ? WHERE id_pacient = ?',
      [mentiuni, id_pacient]
    );
    
    if (result.changes > 0) {
      res.json({ message: 'Mențiunile au fost actualizate cu succes!' });
    } else {
      res.status(404).json({ message: 'Pacient inexistent.' });
    }
  } catch (err) {
    console.error('Eroare la actualizarea mențiunilor:', err);
    res.status(500).json({ message: 'Eroare la actualizarea mențiunilor.' });
  }
});

module.exports = router; 