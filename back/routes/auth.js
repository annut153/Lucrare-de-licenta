const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const bcrypt = require('bcrypt');

// Înregistrare pacient
router.post('/register', async (req, res) => {
  try {
    const { nume, prenume, birthdate, email, telefon, parola } = req.body;
    const hashedPassword = await bcrypt.hash(parola, 10);
    const result = await getDb().run(
      `INSERT INTO pacient (nume, prenume, data_nasterii, email, telefon, parola)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nume, prenume, birthdate, email, telefon, hashedPassword]
    );
    res.status(201).json({ message: 'Cont creat cu succes!', id: result.lastID });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Eroare la înregistrare' });
  }
});

// Autentificare
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const isMedic = email.endsWith('@ace.clinic.ro');
    const tipUtilizator = isMedic ? 'medic' : 'pacient';

    const row = await getDb().get(
      `SELECT * FROM ${tipUtilizator} WHERE email = ?`,
      [email]
    );

    if (!row) return res.status(401).json({ message: 'Email sau parolă incorecte' });

    // Verificare parolă criptată
    const parolaCorecta = await bcrypt.compare(password, row.parola);
    if (!parolaCorecta) return res.status(401).json({ message: 'Email sau parolă incorecte' });

    res.status(200).json({ message: 'Autentificare reușită', [tipUtilizator]: row, tipUtilizator });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Eroare la autentificare' });
  }
});

module.exports = router; 